import dotenv from 'dotenv';
dotenv.config();

console.log('Target Database:', process.env.DB_URL);

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '../../migrations');
  console.log('Migrations path:', path.resolve(migrationsDir));

  let files;
  try {
    files = await fs.readdir(migrationsDir);
  } catch (err) {
    console.error('Failed to read migrations directory:', err.message);
    throw err;
  }

  const sqlFiles = files.filter((file) => file.endsWith('.sql')).sort();

  if (sqlFiles.length === 0) {
    console.log('No migration files found.');
    return;
  }

  for (const file of sqlFiles) {
    const fullPath = path.join(migrationsDir, file);
    let sql;

    try {
      sql = await fs.readFile(fullPath, 'utf8');
    } catch (err) {
      console.error(`Failed to read migration file ${file}:`, err.message);
      throw err;
    }

    const trimmedSql = sql.trim();
    if (!trimmedSql) {
      console.log(`Skipped empty migration: ${file}`);
      continue;
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(trimmedSql);
      await client.query('COMMIT');
      console.log(`Committed migration: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`Error applying migration ${file}:`, err.message);
      throw err;
    } finally {
      client.release();
    }
  }
}

runMigrations()
  .then(() => {
    console.log('All migrations applied successfully.');
    return pool.end().then(() => {
      process.exit(0);
    });
  })
  .catch((err) => {
    console.error('Migration process failed:', err.message);
    pool
      .end()
      .catch(() => {})
      .finally(() => {
        process.exit(1);
      });
  });

