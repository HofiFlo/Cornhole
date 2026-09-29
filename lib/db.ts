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
  return db;
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
