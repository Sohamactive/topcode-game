import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'momentum.db');

let db;

export function getDatabase() {
  if (!db) {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Database connection error:', err);
        process.exit(1);
      }
      console.log('Connected to SQLite database');
    });
  }
  return db;
}

export function initDatabase() {
  return new Promise((resolve, reject) => {
    const database = getDatabase();

    const runDbAsync = (sql, params = []) => new Promise((resolveRun, rejectRun) => {
      database.run(sql, params, (err) => {
        if (err) rejectRun(err);
        else resolveRun();
      });
    });

    const allDbAsync = (sql, params = []) => new Promise((resolveAll, rejectAll) => {
      database.all(sql, params, (err, rows) => {
        if (err) rejectAll(err);
        else resolveAll(rows || []);
      });
    });

    const migrateGameSessions = async () => {
      const columns = await allDbAsync(`PRAGMA table_info(game_sessions)`);
      const hasHostSessionColumn = columns.some((col) => col.name === 'host_session_id');

      if (!hasHostSessionColumn) {
        await runDbAsync('ALTER TABLE game_sessions ADD COLUMN host_session_id TEXT');
      }

      const rows = await allDbAsync('SELECT id, teams FROM game_sessions');
      for (const row of rows) {
        let changed = false;
        let parsedTeams;
        try {
          parsedTeams = JSON.parse(row.teams);
        } catch {
          continue;
        }

        if (!Array.isArray(parsedTeams)) continue;

        const normalizedTeams = parsedTeams.map((team, idx) => {
          const clone = { ...team };
          if ('score' in clone) {
            delete clone.score;
            changed = true;
          }
          if (!('captain_id' in clone)) {
            clone.captain_id = null;
            changed = true;
          }
          if (!Array.isArray(clone.members)) {
            clone.members = [];
            changed = true;
          }
          if (!Array.isArray(clone.visitedSpaceIds)) {
            clone.visitedSpaceIds = [];
            changed = true;
          }
          if (!clone.id) {
            clone.id = `team-${idx + 1}`;
            changed = true;
          }
          if (!clone.name) {
            clone.name = `Team ${idx + 1}`;
            changed = true;
          }
          return clone;
        });

        if (changed) {
          await runDbAsync('UPDATE game_sessions SET teams = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
            JSON.stringify(normalizedTeams),
            row.id
          ]);
        }
      }
    };

    database.serialize(() => {
      // Prompts table
      database.run(`
        CREATE TABLE IF NOT EXISTS prompts (
          id TEXT PRIMARY KEY,
          text TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('Move', 'Talk', 'Create', 'Wildcard')),
          enabled INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err && !err.message.includes('already exists')) {
          reject(err);
        }
      });

      // Game sessions table
      database.run(`
        CREATE TABLE IF NOT EXISTS game_sessions (
          id TEXT PRIMARY KEY,
          session_code TEXT UNIQUE NOT NULL,
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'ended')),
          teams TEXT NOT NULL,
          current_team_index INTEGER DEFAULT 0,
          current_round INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err && !err.message.includes('already exists')) {
          reject(err);
        }
      });

      // Game state table (tracks which prompts have been used in current game)
      database.run(`
        CREATE TABLE IF NOT EXISTS game_state (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          used_prompt_ids TEXT,
          FOREIGN KEY (game_id) REFERENCES game_sessions(id)
        )
      `, (err) => {
        if (err && !err.message.includes('already exists')) {
          reject(err);
          return;
        }

        migrateGameSessions()
          .then(() => resolve())
          .catch((migrationError) => reject(migrationError));
      });
    });
  });
}

export function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDatabase().run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

export function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDatabase().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDatabase().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}
