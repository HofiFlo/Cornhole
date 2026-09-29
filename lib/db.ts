import 'server-only';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const globalForDb = globalThis as unknown as { __cornholeDb?: Database.Database };

function open(): Database.Database {
  const file = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'cornhole.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8'));
  migrate(db);
  return db;
}

/** Nachrüsten von Spalten, die nach der ersten Version dazugekommen sind. */
function migrate(db: Database.Database) {
  const columns = new Set((db.prepare('PRAGMA table_info(teams)').all() as { name: string }[]).map(c => c.name));
  for (const col of ['email_verify_token', 'email_verified_at', 'last_reminder_at']) {
    if (!columns.has(col)) db.exec(`ALTER TABLE teams ADD COLUMN ${col} TEXT`);
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_verify_token ON teams(email_verify_token)');
}

export function db(): Database.Database {
  return (globalForDb.__cornholeDb ??= open());
}

export function getSetting(key: string): string | null {
  const row = db().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string | null) {
  db().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value);
}
