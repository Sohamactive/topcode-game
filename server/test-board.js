import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api/admin';

async function test() {
  try {
    // Create game
    const createRes = await axios.post(`${BASE_URL}/games`, {
      teams: ['Team A', 'Team B', 'Team C']
    });
    const game = createRes.data.game;
    const token = createRes.data.host_session_token;
    console.log(`✓ Created game: ${game.id}`);
    console.log(`  Board spaces: ${game.boardSpaces.length}`);
    console.log(`  Teams: ${game.teams.length}`);
    console.log(`  Starting positions: ${game.teams.map(t => t.position).join(', ')}`);

    // Join team members
    const teamA = game.teams[0];
    const captainRes = await axios.post(`${BASE_URL}/games/${game.id}/join-team`, {
      teamId: teamA.id,
      userId: 'captain-1',
      name: 'Captain A',
      isCaptain: true
    });
    console.log(`✓ ${captainRes.data.message}`);

    // Start game
    const startRes = await axios.post(`${BASE_URL}/games/${game.id}/start`, {
      hostSessionToken: token
    });
    const gameAfterStart = startRes.data.game;
    console.log(`✓ Game started`);
    
    // Check prompt assignments
    console.log(`\nPrompt assignments (first 10 spaces):`);
    gameAfterStart.boardSpaces.slice(0, 10).forEach((space, idx) => {
      const promptText = space.prompt?.text || 'NO PROMPT';
      console.log(`  Space #${space.number}: ${promptText.substring(0, 40)}...`);
    });

    // Test roll
    const rollRes = await axios.post(`${BASE_URL}/games/${game.id}/roll`, {
      user_id: 'captain-1'
    });
    const gameAfterRoll = rollRes.data.game;
    console.log(`\n✓ Roll result:`);
    console.log(`  Roll: ${rollRes.data.roll}`);
    console.log(`  Position: ${rollRes.data.position}`);
    console.log(`  Landed on space: #${rollRes.data.space.number}`);
    console.log(`  Prompt: ${gameAfterRoll.current_prompt?.text || 'NO PROMPT (START)'}`);

  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
}

test();
