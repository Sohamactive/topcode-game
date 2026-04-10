import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync } from '../db.js';

export function createPromptsRouter() {
  const router = express.Router();

  // Get all prompts (with optional filter)
  router.get('/', async (req, res) => {
    try {
      const { type, enabled } = req.query;
      let sql = 'SELECT * FROM prompts';
      const params = [];

      if (type && type !== 'All') {
        sql += ' WHERE type = ?';
        params.push(type);
      }

      if (enabled !== undefined) {
        if (params.length > 0) sql += ' AND';
        else sql += ' WHERE';
        sql += ' enabled = ?';
        params.push(enabled === 'true' ? 1 : 0);
      }

      sql += ' ORDER BY type, created_at';

      const prompts = await allAsync(sql, params);
      res.json(prompts);
    } catch (error) {
      console.error('Error fetching prompts:', error);
      res.status(500).json({ error: 'Failed to fetch prompts' });
    }
  });

  // Get a single prompt by ID
  router.get('/:id', async (req, res) => {
    try {
      const prompt = await getAsync('SELECT * FROM prompts WHERE id = ?', [req.params.id]);
      if (!prompt) {
        return res.status(404).json({ error: 'Prompt not found' });
      }
      res.json(prompt);
    } catch (error) {
      console.error('Error fetching prompt:', error);
      res.status(500).json({ error: 'Failed to fetch prompt' });
    }
  });

  // Create a new prompt (admin only)
  router.post('/', async (req, res) => {
    try {
      const { text, type } = req.body;

      if (!text || !type) {
        return res.status(400).json({ error: 'text and type are required' });
      }

      if (!['Move', 'Talk', 'Create', 'Wildcard'].includes(type)) {
        return res.status(400).json({ error: 'Invalid prompt type' });
      }

      const id = uuidv4();
      await runAsync(
        'INSERT INTO prompts (id, text, type, enabled) VALUES (?, ?, ?, 1)',
        [id, text, type]
      );

      const prompt = await getAsync('SELECT * FROM prompts WHERE id = ?', [id]);
      res.status(201).json(prompt);
    } catch (error) {
      console.error('Error creating prompt:', error);
      res.status(500).json({ error: 'Failed to create prompt' });
    }
  });

  // Update a prompt (admin only)
  router.put('/:id', async (req, res) => {
    try {
      const { text, type, enabled } = req.body;
      const id = req.params.id;

      // Validate type if provided
      if (type && !['Move', 'Talk', 'Create', 'Wildcard'].includes(type)) {
        return res.status(400).json({ error: 'Invalid prompt type' });
      }

      // Build update query dynamically
      const updates = [];
      const params = [];

      if (text !== undefined) {
        updates.push('text = ?');
        params.push(text);
      }
      if (type !== undefined) {
        updates.push('type = ?');
        params.push(type);
      }
      if (enabled !== undefined) {
        updates.push('enabled = ?');
        params.push(enabled ? 1 : 0);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const sql = `UPDATE prompts SET ${updates.join(', ')} WHERE id = ?`;
      await runAsync(sql, params);

      const prompt = await getAsync('SELECT * FROM prompts WHERE id = ?', [id]);
      res.json(prompt);
    } catch (error) {
      console.error('Error updating prompt:', error);
      res.status(500).json({ error: 'Failed to update prompt' });
    }
  });

  // Delete a prompt (admin only)
  router.delete('/:id', async (req, res) => {
    try {
      const id = req.params.id;
      await runAsync('DELETE FROM prompts WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting prompt:', error);
      res.status(500).json({ error: 'Failed to delete prompt' });
    }
  });

  return router;
}
