import { v4 as uuidv4 } from 'uuid';
import { runAsync, getDatabase, initDatabase } from '../db.js';

// Seed prompts with all 4 categories: 10 Move, 10 Talk, 10 Create, 5 Wildcard
const SEED_PROMPTS = [
  // Move prompts (10)
  { type: 'Move', text: 'Everyone stand up and jump 3 times together!' },
  { type: 'Move', text: 'Team captain does 5 jumping jacks while team cheers.' },
  { type: 'Move', text: 'Swap seats with someone from another team, then swap back.' },
  { type: 'Move', text: 'Strike your team\'s power pose and hold it for 10 seconds.' },
  { type: 'Move', text: 'March around the room making eye contact with 3 other people.' },
  { type: 'Move', text: 'Do your best impression of a superhero and fly to another team.' },
  { type: 'Move', text: 'Team does a synchronized wave with your arms, left to right.' },
  { type: 'Move', text: 'Spin around once, then give your team a high-five.' },
  { type: 'Move', text: 'Reach as high as you can, then touch your toes—repeat 3 times.' },
  { type: 'Move', text: 'Walk backward to the next team and introduce yourselves.' },

  // Talk prompts (10)
  { type: 'Talk', text: 'Go around your team: complete this sentence: "If I could change one thing at work..."' },
  { type: 'Talk', text: 'Tell your team your superpower and why you have it.' },
  { type: 'Talk', text: 'Shout out one fun fact about each teammate you just learned.' },
  { type: 'Talk', text: 'Together, come up with a team motto and say it 3 times.' },
  { type: 'Talk', text: 'What\'s one thing you\'re excited to explore in today\'s session? Share!' },
  { type: 'Talk', text: 'Tell your team about a time you solved a problem together.' },
  { type: 'Talk', text: 'Describe your ideal product in 30 seconds—have your team add one feature each.' },
  { type: 'Talk', text: 'Ask your team: "What would our perfect customer day look like?"' },
  { type: 'Talk', text: 'Discuss: What\'s one skill every team member brings to the table?' },
  { type: 'Talk', text: 'Share your team\'s biggest win from the last quarter.' },

  // Create prompts (10)
  { type: 'Create', text: 'Sketch a product that doesn\'t exist yet. Title it and present it!' },
  { type: 'Create', text: 'Build a tower with office supplies. Make it at least 12 inches tall.' },
  { type: 'Create', text: 'Name a new ice cream flavor together, then pitch it like a commercial.' },
  { type: 'Create', text: 'Create a team logo using only paper and markers. Explain the inspiration.' },
  { type: 'Create', text: 'Invent a new holiday and describe 3 traditions for it.' },
  { type: 'Create', text: 'Design a new feature for a product your team loves. Draw or describe it.' },
  { type: 'Create', text: 'Write a 4-line team song or rap. Perform it for the room.' },
  { type: 'Create', text: 'Build a Rube Goldberg machine with paper, pens, and tape. Test it once.' },
  { type: 'Create', text: 'Create a meme or funny sign about innovation. Show and explain it.' },
  { type: 'Create', text: 'Design a new parking lot for your company. What would make it amazing?' },

  // Wildcard prompts (5)
  { type: 'Wildcard', text: 'Your choice: Move, Talk, or Create. What does your team need right now?' },
  { type: 'Wildcard', text: 'Team votes: Pick any previous prompt and do it again, but twice as energetic!' },
  { type: 'Wildcard', text: 'Surprise! You get to lead the whole room in a 20-second dance or chant.' },
  { type: 'Wildcard', text: 'Your pick: Teach another team something cool, or learn from them.' },
  { type: 'Wildcard', text: 'Combine a Move with a Talk: Do an activity while explaining why you chose it.' }
];

export async function seedPrompts() {
  try {
    // Initialize database first
    await initDatabase();
    
    // Check if prompts already seeded
    const result = await new Promise((resolve, reject) => {
      const db = getDatabase();
      db.get('SELECT COUNT(*) as count FROM prompts', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    if (result > 0) {
      console.log(`Database already has ${result} prompts. Skipping seed.`);
      return;
    }

    console.log('Seeding prompts...');
    for (const prompt of SEED_PROMPTS) {
      const id = uuidv4();
      await runAsync(
        'INSERT INTO prompts (id, text, type, enabled) VALUES (?, ?, ?, 1)',
        [id, prompt.text, prompt.type]
      );
    }
    console.log(`✓ Seeded ${SEED_PROMPTS.length} prompts`);
  } catch (error) {
    console.error('Error seeding prompts:', error);
    process.exit(1);
  }
}

// Run seed if called directly
seedPrompts().then(() => process.exit(0));
