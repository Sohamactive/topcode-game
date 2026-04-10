import express from 'express';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { runAsync, allAsync } from '../db.js';

export function createGamesRouter(app) {
  const router = express.Router();

  // Store active games and their WebSocket clients in memory
  const activeGames = new Map();
  const gameClients = new Map(); // game_id -> Set of WebSocket clients

  // Generate a unique session code (e.g., ABC123)
  function generateSessionCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Broadcast state to all clients connected to a game
  function broadcastGameState(gameId) {
    const game = activeGames.get(gameId);
    if (!game) return;

    const clients = gameClients.get(gameId);
    if (!clients) return;

    const message = JSON.stringify({
      type: 'game_state',
      game: game
    });

    clients.forEach(client => {
      try {
        client.send(message);
      } catch (err) {
        console.error('Error broadcasting to client:', err);
      }
    });
  }

  // Create a new game session
  router.post('/', async (req, res) => {
    try {
      const { teams } = req.body;
      const maxRounds = Number(req.body.maxRounds || 5);

      if (!teams || !Array.isArray(teams) || teams.length === 0) {
        return res.status(400).json({ error: 'teams array is required and must not be empty' });
      }

      const gameId = uuidv4();
      const sessionCode = generateSessionCode();

      // Generate QR code
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
      const joinUrl = `${baseUrl}/join/${gameId}`;
      const qrCode = await QRCode.toDataURL(joinUrl);

      const gameData = {
        id: gameId,
        session_code: sessionCode,
        status: 'pending',
        teams: teams.map((name, idx) => ({
          id: uuidv4(),
          name: name || `Team ${idx + 1}`,
          position: 0
        })),
        current_team_index: 0,
        current_round: 0,
        max_rounds: Number.isFinite(maxRounds) && maxRounds > 0 ? maxRounds : 5,
        current_prompt: null,
        awaiting_resolution: false,
        disabled_prompt_ids: [],
        used_prompt_ids: [],
        qr_code: qrCode,
        join_url: joinUrl
      };

      // Save to database
      await runAsync(
        'INSERT INTO game_sessions (id, session_code, status, teams, current_team_index, current_round) VALUES (?, ?, ?, ?, ?, ?)',
        [gameId, sessionCode, 'pending', JSON.stringify(gameData.teams), 0, 0]
      );

      // Initialize game state
      activeGames.set(gameId, gameData);
      gameClients.set(gameId, new Set());

      res.status(201).json({
        game: gameData,
        qr_code: qrCode,
        join_url: joinUrl,
        session_code: sessionCode
      });
    } catch (error) {
      console.error('Error creating game:', error);
      res.status(500).json({ error: 'Failed to create game' });
    }
  });

  // Get a game session
  router.get('/:gameId', async (req, res) => {
    try {
      const game = activeGames.get(req.params.gameId);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }
      res.json(game);
    } catch (error) {
      console.error('Error fetching game:', error);
      res.status(500).json({ error: 'Failed to fetch game' });
    }
  });

  // Start a game
  router.post('/:gameId/start', async (req, res) => {
    try {
      const game = activeGames.get(req.params.gameId);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }

      game.status = 'active';
      
      // Fetch all enabled prompts and shuffle them
      const enabledPrompts = await allAsync('SELECT * FROM prompts WHERE enabled = 1');
      
      // Fisher-Yates shuffle algorithm for randomizing prompts
      function shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
      }
      
      game.shuffled_prompts = shuffleArray(enabledPrompts);
      game.current_prompt_index = 0;
      game.used_prompt_ids = [];
      game.awaiting_resolution = false;
      
      console.log(`🎮 Started game ${req.params.gameId} with ${game.shuffled_prompts.length} prompts`);
      
      await runAsync('UPDATE game_sessions SET status = ? WHERE id = ?', ['active', req.params.gameId]);

      broadcastGameState(req.params.gameId);
      res.json(game);
    } catch (error) {
      console.error('Error starting game:', error);
      res.status(500).json({ error: 'Failed to start game' });
    }
  });

  // Roll dice (DO NOT advance team yet)
  router.post('/:gameId/roll', async (req, res) => {
    try {
      return res.status(403).json({ error: 'Use /api/admin/games/:gameId/roll for admin-controlled gameplay' });

      const game = activeGames.get(req.params.gameId);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }

      // Roll 1-6
      const roll = Math.floor(Math.random() * 6) + 1;

      // Move current team forward by roll amount
      const boardSize = 16; // Fixed board with 16 spaces (0-15)
      const currentTeam = game.teams[game.current_team_index];
      const newPosition = currentTeam.position + roll;
      currentTeam.position = newPosition % boardSize;

      // Get next prompt from shuffled list (non-repetition)
      let prompt = null;
      if (game.shuffled_prompts && game.shuffled_prompts.length > 0) {
        // Use current prompt index to cycle through shuffled prompts
        const promptIndex = game.current_prompt_index % game.shuffled_prompts.length;
        prompt = game.shuffled_prompts[promptIndex];
        game.current_prompt_index += 1;
      } else {
        // Fallback if prompts not initialized (shouldn't happen)
        const enabledPrompts = await allAsync('SELECT * FROM prompts WHERE enabled = 1');
        if (enabledPrompts.length > 0) {
          prompt = enabledPrompts[Math.floor(Math.random() * enabledPrompts.length)];
        }
      }

      game.current_prompt = prompt;
      game.last_roll = roll; // Store roll for display

      // Broadcast but DO NOT advance team_index yet
      broadcastGameState(req.params.gameId);
      res.json({ roll, game });
    } catch (error) {
      console.error('Error rolling dice:', error);
      res.status(500).json({ error: 'Failed to roll dice' });
    }
  });

  // Advance to next team (called after host clicks "Next Team")
  router.post('/:gameId/next', async (req, res) => {
    try {
      return res.status(403).json({ error: 'Use /api/admin/games/:gameId/next for admin-controlled gameplay' });

      const game = activeGames.get(req.params.gameId);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }

      // Move to next team
      game.current_team_index = (game.current_team_index + 1) % game.teams.length;
      if (game.current_team_index === 0) {
        game.current_round += 1;
      }

      // Clear prompt for next round
      game.current_prompt = null;
      game.last_roll = null;

      broadcastGameState(req.params.gameId);
      res.json(game);
    } catch (error) {
      console.error('Error advancing to next team:', error);
      res.status(500).json({ error: 'Failed to advance team' });
    }
  });

  // End a game
  router.post('/:gameId/end', async (req, res) => {
    try {
      return res.status(403).json({ error: 'Use /api/admin/games/:gameId/end for admin-controlled gameplay' });

      const game = activeGames.get(req.params.gameId);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }

      game.status = 'ended';
      await runAsync('UPDATE game_sessions SET status = ? WHERE id = ?', ['ended', req.params.gameId]);

      broadcastGameState(req.params.gameId);

      // Cleanup after a delay
      setTimeout(() => {
        activeGames.delete(req.params.gameId);
        gameClients.delete(req.params.gameId);
      }, 30000); // Keep in memory for 30s for any lingering clients

      res.json(game);
    } catch (error) {
      console.error('Error ending game:', error);
      res.status(500).json({ error: 'Failed to end game' });
    }
  });

  // WebSocket endpoint for real-time updates
  router.ws('/:gameId/ws', (ws, req) => {
    const gameId = req.params.gameId;
    const game = activeGames.get(gameId);

    if (!game) {
      console.log('Game not found for WebSocket:', gameId);
      console.log('Available games:', Array.from(activeGames.keys()));
      ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
      ws.close();
      return;
    }

    console.log('WebSocket connected for game:', gameId);

    // Register client
    if (!gameClients.has(gameId)) {
      gameClients.set(gameId, new Set());
    }
    gameClients.get(gameId).add(ws);

    // Send initial state
    ws.send(JSON.stringify({ type: 'game_state', game }));

    // Handle messages from client
    ws.on('message', (msg) => {
      try {
        const data = JSON.parse(msg);
        console.log('Message from client:', data);
      } catch (err) {
        console.error('Error parsing message:', err);
      }
    });

    // Handle disconnect
    ws.on('close', () => {
      console.log('WebSocket disconnected for game:', gameId);
      const clients = gameClients.get(gameId);
      if (clients) {
        clients.delete(ws);
      }
    });
  });

  return { router, activeGames, broadcastGameState };
}
