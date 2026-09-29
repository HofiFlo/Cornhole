// Legt Demo-Teams an (bestätigt/bezahlt) – nur für Tests und Proben.
// Aufruf: npm run seed -- [Anzahl=64] [--reset]
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const count = Number(args.find(a => /^\d+$/.test(a)) ?? 64);
const reset = args.includes('--reset');

const file = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'cornhole.db');
fs.mkdirSync(path.dirname(file), { recursive: true });
const db = new Database(file);
db.exec(fs.readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8'));

if (reset) {
  db.exec(`DELETE FROM four_baggers; DELETE FROM ko_sets; DELETE FROM kehren; DELETE FROM ko_matches;
           DELETE FROM group_matches; DELETE FROM teams; DELETE FROM settings;`);
}

const clubs = ['CC Donaustadt', null, 'Bag Busters Graz', null, null, 'Cornhole Club Linz', null, null];
const adjectives = ['Flinke', 'Wilde', 'Goldene', 'Lässige', 'Treffsichere', 'Fliegende', 'Stille', 'Rote'];
const nouns = ['Säcke', 'Bretter', 'Löcher', 'Werfer', 'Maiskörner', 'Bohnen', 'Asse', 'Kehren'];
const prefix = process.env.PAYMENT_REF_PREFIX || 'CH2026';

const insert = db.prepare(`INSERT INTO teams (team_name, club_name, player1_name, player1_email, player2_name,
  payment_status, registration_status, confirmed_at) VALUES (?, ?, ?, ?, ?, 'paid', 'confirmed', ?)`);
const setRef = db.prepare('UPDATE teams SET payment_reference = ? WHERE id = ?');
const clubCount = {};

db.transaction(() => {
  for (let i = 0; i < count; i++) {
    const club = clubs[i % clubs.length];
    let name;
    if (club) {
      clubCount[club] = (clubCount[club] ?? 0) + 1;
      name = `${club} ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][clubCount[club] - 1] ?? clubCount[club]}`;
    } else {
      name = `${adjectives[i % adjectives.length]} ${nouns[Math.floor(i / adjectives.length) % nouns.length]} ${i + 1}`;
    }
    const { lastInsertRowid } = insert.run(name, club, `Spieler ${i + 1}a`, `team${i + 1}@example.org`, `Spieler ${i + 1}b`,
      new Date().toISOString());
    setRef.run(`${prefix}-${String(lastInsertRowid).padStart(4, '0')}`, lastInsertRowid);
  }
})();

console.log(`${count} bestätigte Demo-Teams in ${file} angelegt.`);
