import express from 'express';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { allAsync, getAsync, runAsync } from '../db.js';
import {
  assignPromptsToSpaces,
  generateSessionCode,
  getHostSessionToken,
  getRequestUserId,
  initializeBoardSpaces,
  isCurrentTeamCaptain
} from '../lib/game-helpers.js';

export function createAdminRouter(app, activeGames, broadcastGameState) {
  const router = express.Router();

  function isHostAuthorized(req, game) {
    const token = getHostSessionToken(req);
    return Boolean(token && game?.host_session_id && token === game.host_session_id);
  }

  function ensureHostAuthorized(req, res, game) {
    if (!isHostAuthorized(req, game)) {
      res.status(401).json({ error: 'Unauthorized: invalid host session token' });
      return false;
    }
    return true;
  }

  function pickNextUnusedPrompt(game, type) {
    const pools = game.prompt_pool_by_type || {};
    const pool = pools[type] || [];
    game.prompt_index_by_type = game.prompt_index_by_type || { Move: 0, Talk: 0, Create: 0, Wildcard: 0 };

    let pointer = game.prompt_index_by_type[type] || 0;
    const usedPromptIds = new Set(game.used_prompt_ids || []);

    while (pointer < pool.length && usedPromptIds.has(pool[pointer].id)) {
      pointer += 1;
    }

    game.prompt_index_by_type[type] = pointer + 1;
    return pool[pointer] || null;
  }

  function shuffleArray(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function logGameEvent(game, message, meta = {}) {
    if (!game.activity_feed) game.activity_feed = [];
    game.activity_feed.push({
      id: uuidv4(),
      message,
      at: new Date().toISOString(),
      ...meta
    });
    if (game.activity_feed.length > 40) {
      game.activity_feed = game.activity_feed.slice(game.activity_feed.length - 40);
    }
  }

  async function refreshPromptPool(game) {
    const enabledPrompts = await allAsync('SELECT * FROM prompts WHERE enabled = 1');
    const hiddenIds = new Set(game.disabled_prompt_ids || []);
    const filtered = enabledPrompts.filter((prompt) => !hiddenIds.has(prompt.id));

    // Keep a global shuffled list for compatibility and grouped shuffled lists per space type.
    game.shuffled_prompts = shuffleArray(filtered);
    game.current_prompt_index = 0;
    game.prompt_pool_by_type = {
      Move: shuffleArray(filtered.filter((p) => p.type === 'Move')),
      Talk: shuffleArray(filtered.filter((p) => p.type === 'Talk')),
      Create: shuffleArray(filtered.filter((p) => p.type === 'Create')),
      Wildcard: shuffleArray(filtered.filter((p) => p.type === 'Wildcard'))
    };
    game.prompt_index_by_type = game.prompt_index_by_type || { Move: 0, Talk: 0, Create: 0, Wildcard: 0 };
  }

  function getPromptForSpace(game, spaceType) {
    const validTypes = ['Move', 'Talk', 'Create', 'Wildcard'];
    const normalizedType = validTypes.includes(spaceType) ? spaceType : 'Wildcard';

    if (normalizedType !== 'Wildcard') {
      return pickNextUnusedPrompt(game, normalizedType);
    }

    // Wildcard can map to any remaining prompt type except Wildcard first.
    const candidateTypes = ['Move', 'Talk', 'Create', 'Wildcard'];
    const shuffledTypes = shuffleArray(candidateTypes);
    for (const type of shuffledTypes) {
      const prompt = pickNextUnusedPrompt(game, type);
      if (prompt) return prompt;
    }

    return null;
  }

  // Create game (host flow)
  router.post('/games', async (req, res) => {
    try {
      const { teams } = req.body;

      if (!teams || !Array.isArray(teams) || teams.length < 2) {
        return res.status(400).json({ error: 'At least 2 teams are required' });
      }

      const gameId = uuidv4();
      const hostSessionToken = uuidv4();
      const sessionCode = generateSessionCode();
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
      const joinUrl = `${baseUrl}/join/${gameId}`;
      const qrCode = await QRCode.toDataURL(joinUrl);

      const gameData = {
        id: gameId,
        host_session_id: hostSessionToken,
        session_code: sessionCode,
        status: 'pending',
        teams: teams.map((name, idx) => ({
          id: uuidv4(),
          name: name || `Team ${idx + 1}`,
          captain_id: null,
          members: [],
          position: 0,
          visitedSpaceIds: []
        })),
        boardSpaces: initializeBoardSpaces(),
        current_team_index: 0,
        current_prompt: null,
        current_prompt_result: null,
        awaiting_resolution: false,
        last_assigned_space: null,
        disabled_prompt_ids: [],
        used_prompt_ids: [],
        activity_feed: [],
        qr_code: qrCode,
        join_url: joinUrl
      };

      logGameEvent(gameData, 'Host created a new game session.');

      activeGames.set(gameId, gameData);

      await runAsync(
        'INSERT INTO game_sessions (id, session_code, status, teams, current_team_index, current_round, host_session_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [gameId, sessionCode, 'pending', JSON.stringify(gameData.teams), 0, 0, hostSessionToken]
      );

      res.status(201).json({
        game: gameData,
        session_code: sessionCode,
        join_url: joinUrl,
        qr_code: qrCode,
        host_session_token: hostSessionToken
      });
    } catch (error) {
      console.error('Error creating host game:', error);
      res.status(500).json({ error: 'Failed to create game' });
    }
  });

  // Join team (public endpoint - no admin auth required)
  router.post('/games/:gameId/join-team', async (req, res) => {
    try {
      const game = activeGames.get(req.params.gameId);
      if (!game) return res.status(404).json({ error: 'Game not found' });

      const { teamId, userId, name, isCaptain } = req.body;
      if (!teamId || !userId || !name) {
        return res.status(400).json({ error: 'teamId, userId, and name are required' });
      }

      const team = game.teams.find((t) => t.id === teamId);
      if (!team) return res.status(404).json({ error: 'Team not found' });

      // Initialize members array if not present
      if (!team.members) team.members = [];

      // Check if user already joined this team
      const existingMember = team.members.find((m) => m.user_id === userId);
      if (existingMember) {
        return res.status(400).json({ error: 'User already joined this team' });
      }

      // Add member to team
      team.members.push({ user_id: userId, name, is_captain: Boolean(isCaptain) });

      // Set captain if requested and no captain exists
      if (isCaptain && !team.captain_id) {
        team.captain_id = userId;
      }

      logGameEvent(
        game,
        `${name} joined ${team.name}${isCaptain && team.captain_id === userId ? ' as captain' : ''}.`
      );

      broadcastGameState(req.params.gameId);
      res.json({
        team: { id: team.id, name: team.name, members: team.members, captain_id: team.captain_id },
        message: `${name} joined ${team.name}${isCaptain && team.captain_id === userId ? ' as captain' : ''}`,
        user_id: userId
      });
    } catch (error) {
      console.error('Error joining team:', error);
      res.status(500).json({ error: 'Failed to join team' });
    }
  });

  // Start game
  router.post('/games/:gameId/start', async (req, res) => {
    try {
      const game = activeGames.get(req.params.gameId);
      if (!game) return res.status(404).json({ error: 'Game not found' });
      if (!ensureHostAuthorized(req, res, game)) return;

      game.status = 'active';
      game.current_team_index = 0;
      game.current_prompt = null;
      game.current_prompt_result = null;
      game.awaiting_resolution = false;
      game.last_assigned_space = null;

      // Reset teams and assign prompts to board spaces
      game.teams = game.teams.map((team) => ({ ...team, position: 0, visitedSpaceIds: [] }));
      await refreshPromptPool(game);
      assignPromptsToSpaces(game.boardSpaces, game.shuffled_prompts);
      logGameEvent(game, 'Host started the game. Prompts assigned to board spaces.');

      await runAsync('UPDATE game_sessions SET status = ? WHERE id = ?', ['active', req.params.gameId]);
      broadcastGameState(req.params.gameId);
      res.json({ game, message: 'Game started' });
    } catch (error) {
      console.error('Error starting game:', error);
      res.status(500).json({ error: 'Failed to start game' });
    }
  });

  // Roll dice
  router.post('/games/:gameId/roll', async (req, res) => {
    try {
      const game = activeGames.get(req.params.gameId);
      if (!game) return res.status(404).json({ error: 'Game not found' });
      if (game.status !== 'active') return res.status(400).json({ error: 'Game is not active' });
      if (game.awaiting_resolution) return res.status(400).json({ error: 'Resolve current challenge before rolling again' });

      // Captain-only roll check
      const userId = req.body.user_id || req.headers['x-user-id'];
      const currentTeam = game.teams[game.current_team_index];

      if (!userId) {
        return res.status(401).json({ error: 'user_id is required for captain roll' });
      }
      if (!currentTeam.captain_id) {
        return res.status(403).json({ error: 'Current team has no captain assigned' });
      }
      if (currentTeam.captain_id !== userId) {
        return res.status(403).json({ error: 'Only the team captain can roll dice' });
      }

      const roll = Math.floor(Math.random() * 6) + 1;
      const boardLength = 25;
      const currentPosition = Number.isFinite(currentTeam.position) ? currentTeam.position : 0;
      const newPosition = (currentPosition + roll) % boardLength;
      const assignedSpace = game.boardSpaces[newPosition];

      // Update team position and visited spaces
      currentTeam.position = newPosition;
      currentTeam.visitedSpaceIds = currentTeam.visitedSpaceIds || [];
      if (!currentTeam.visitedSpaceIds.includes(assignedSpace.id)) {
        currentTeam.visitedSpaceIds.push(assignedSpace.id);
      }

      game.last_assigned_space = assignedSpace;
      game.last_roll = roll;

      // Get prompt from the landed space.
      const prompt = assignedSpace.prompt || null;

      if (!prompt) {
        return res.status(400).json({ error: 'Space has no prompt assigned.' });
      } else {
        game.current_prompt = prompt;
        game.awaiting_resolution = true;
        game.current_prompt_result = null;
        logGameEvent(game, `${currentTeam.name} rolled ${roll} and landed on space #${assignedSpace.number} with a ${prompt.type} prompt.`);
      }

      broadcastGameState(req.params.gameId);
      res.json({
        game,
        roll,
        position: newPosition,
        space: assignedSpace,
        message: `${currentTeam.name} rolled ${roll} and landed on space #${assignedSpace.number}!`
      });
    } catch (error) {
      console.error('Error rolling dice:', error);
      res.status(500).json({ error: 'Failed to roll dice' });
    }
  });

  // Resolve challenge (completed or not)
  router.post('/games/:gameId/resolve', async (req, res) => {
    try {
      const game = activeGames.get(req.params.gameId);
      if (!game) return res.status(404).json({ error: 'Game not found' });
      const hostAuthorized = isHostAuthorized(req, game);
      const captainAuthorized = isCurrentTeamCaptain(req, game);
      if (!hostAuthorized && !captainAuthorized) {
        return res.status(401).json({ error: 'Unauthorized: only host or current team captain can resolve challenge' });
      }
      if (!game.awaiting_resolution) return res.status(400).json({ error: 'No active challenge to resolve' });

      const completed = Boolean(req.body.completed);
      const currentTeam = game.teams[game.current_team_index];

      game.current_prompt_result = completed ? 'completed' : 'not_completed';
      game.awaiting_resolution = false;
      logGameEvent(game, `${currentTeam.name} ${completed ? 'completed' : 'did not complete'} the challenge.`);

      // Auto-advance turn once host resolves challenge.
      game.current_team_index = (game.current_team_index + 1) % game.teams.length;
      game.current_prompt = null;
      game.current_prompt_result = null;
      game.last_assigned_space = null;
      logGameEvent(game, `Turn moved to ${game.teams[game.current_team_index].name}.`);

      broadcastGameState(req.params.gameId);
      res.json({
        game,
        message: `${completed ? 'Challenge marked as completed' : 'Challenge marked as not completed'}. Next team: ${game.teams[game.current_team_index].name}`
      });
    } catch (error) {
      console.error('Error resolving challenge:', error);
      res.status(500).json({ error: 'Failed to resolve challenge' });
    }
  });

  // Next team
  router.post('/games/:gameId/next', async (req, res) => {
    res.status(410).json({ error: 'Next-team endpoint removed. Team advances automatically after resolve.' });
  });

  // End current round manually
  router.post('/games/:gameId/end-round', async (req, res) => {
    res.status(410).json({ error: 'Round concept removed. Host can end game anytime.' });
  });

  // Prompt list with per-game visibility state
  router.get('/games/:gameId/prompts', async (req, res) => {
    try {
      const game = activeGames.get(req.params.gameId);
      if (!game) return res.status(404).json({ error: 'Game not found' });
      if (!ensureHostAuthorized(req, res, game)) return;

      const prompts = await allAsync('SELECT * FROM prompts ORDER BY type, created_at');
      const hiddenSet = new Set(game.disabled_prompt_ids || []);

      res.json(prompts.map((prompt) => ({
        ...prompt,
        visible_in_game: prompt.enabled === 1 && !hiddenSet.has(prompt.id)
      })));
    } catch (error) {
      console.error('Error fetching prompts for game:', error);
      res.status(500).json({ error: 'Failed to fetch prompt list' });
    }
  });

  // Add prompt during game
  router.post('/games/:gameId/prompts', async (req, res) => {
    try {
      const game = activeGames.get(req.params.gameId);
      if (!game) return res.status(404).json({ error: 'Game not found' });
      if (!ensureHostAuthorized(req, res, game)) return;

      const { text, type } = req.body;
      if (!text || !type) return res.status(400).json({ error: 'text and type are required' });
      if (!['Move', 'Talk', 'Create', 'Wildcard'].includes(type)) {
        return res.status(400).json({ error: 'Invalid prompt type' });
      }

      const id = uuidv4();
      await runAsync('INSERT INTO prompts (id, text, type, enabled) VALUES (?, ?, ?, 1)', [id, text, type]);
      const prompt = await getAsync('SELECT * FROM prompts WHERE id = ?', [id]);

      await refreshPromptPool(game);
      logGameEvent(game, `Host added a new ${type} prompt.`);
      broadcastGameState(req.params.gameId);
      res.status(201).json({ prompt, message: 'Prompt added and available immediately' });
    } catch (error) {
      console.error('Error adding prompt during game:', error);
      res.status(500).json({ error: 'Failed to add prompt' });
    }
  });

  // Toggle per-game prompt visibility
  router.post('/games/:gameId/prompts/visibility', async (req, res) => {
    try {
      const game = activeGames.get(req.params.gameId);
      if (!game) return res.status(404).json({ error: 'Game not found' });
      if (!ensureHostAuthorized(req, res, game)) return;

      const { promptId, visible } = req.body;
      if (!promptId || typeof visible !== 'boolean') {
        return res.status(400).json({ error: 'promptId and boolean visible are required' });
      }

      const hiddenSet = new Set(game.disabled_prompt_ids || []);
      if (visible) hiddenSet.delete(promptId);
      else hiddenSet.add(promptId);

      game.disabled_prompt_ids = Array.from(hiddenSet);
      await refreshPromptPool(game);
      logGameEvent(game, visible ? 'Host enabled a prompt in this game.' : 'Host hid a prompt in this game.');
      broadcastGameState(req.params.gameId);

      res.json({ game, message: visible ? 'Prompt enabled in this game' : 'Prompt hidden in this game' });
    } catch (error) {
      console.error('Error toggling prompt visibility:', error);
      res.status(500).json({ error: 'Failed to update prompt visibility' });
    }
  });

  // Host game state
  router.get('/games/:gameId', async (req, res) => {
    try {
      const game = activeGames.get(req.params.gameId);
      if (!game) return res.status(404).json({ error: 'Game not found' });
      if (!ensureHostAuthorized(req, res, game)) return;
      res.json(game);
    } catch (error) {
      console.error('Error fetching game:', error);
      res.status(500).json({ error: 'Failed to fetch game' });
    }
  });

  // End game manually
  router.post('/games/:gameId/end', async (req, res) => {
    try {
      const game = activeGames.get(req.params.gameId);
      if (!game) return res.status(404).json({ error: 'Game not found' });
      if (!ensureHostAuthorized(req, res, game)) return;

      game.status = 'ended';
      logGameEvent(game, 'Host ended the game.');
      broadcastGameState(req.params.gameId);

      console.log(`❌ Host ended game ${req.params.gameId}`);
      res.json({ game, message: 'Game ended' });
    } catch (error) {
      console.error('Error ending game:', error);
      res.status(500).json({ error: 'Failed to end game' });
    }
  });

  return router;
}
