// Legt Demo-Teams an – nur für Tests und Proben.
// Aufruf: npm run seed -- [Anzahl=64] [--reset] [--demo]
//   --demo: 60 bezahlte Teams + 3 offene (davon 1 überfällig) + 2 auf der Warteliste, Turnierbeginn heute 10:00
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const demo = args.includes('--demo');
const count = demo ? 60 : Number(args.find(a => /^\d+$/.test(a)) ?? 64);
const reset = args.includes('--reset');

const file = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'cornhole.db');
fs.mkdirSync(path.dirname(file), { recursive: true });
const db = new Database(file);
db.exec(fs.readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8'));
const cols = new Set(db.prepare('PRAGMA table_info(teams)').all().map(c => c.name));
for (const col of ['email_verify_token', 'email_verified_at', 'last_reminder_at']) {
  if (!cols.has(col)) db.exec(`ALTER TABLE teams ADD COLUMN ${col} TEXT`);
}

if (reset) {
  db.exec(`DELETE FROM four_baggers; DELETE FROM ko_sets; DELETE FROM kehren; DELETE FROM ko_matches;
           DELETE FROM group_matches; DELETE FROM teams; DELETE FROM settings; DELETE FROM mail_outbox;`);
}

const clubs = ['CC Donaustadt', null, 'Bag Busters Graz', null, null, 'Cornhole Club Linz', null, null];
const adjectives = ['Flinke', 'Wilde', 'Goldene', 'Lässige', 'Treffsichere', 'Fliegende', 'Stille', 'Rote'];
const nouns = ['Säcke', 'Bretter', 'Löcher', 'Werfer', 'Maiskörner', 'Bohnen', 'Asse', 'Kehren'];
const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const prefix = process.env.PAYMENT_REF_PREFIX || 'CH2026';
const ref = id => `${prefix}-${String(id).padStart(4, '0')}`;
const day = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const now = new Date().toISOString();

const insert = db.prepare(`INSERT INTO teams (team_name, club_name, player1_name, player1_email, player2_name,
  payment_status, registration_status, confirmed_at, email_verified_at, payment_due_date)
  VALUES (@name, @club, @p1, @mail, @p2, @payment, @status, @confirmedAt, @now, @due)`);
const setRef = db.prepare('UPDATE teams SET payment_reference = ? WHERE id = ?');
const clubCount = {};
let n = db.prepare('SELECT COUNT(*) AS n FROM teams').get().n;

function add(status, due = null) {
  const i = n++;
  const club = clubs[i % clubs.length];
  let name;
  if (club) {
    clubCount[club] = (clubCount[club] ?? 0) + 1;
    name = `${club} ${roman[clubCount[club] - 1] ?? clubCount[club]}`;
  } else {
    name = `${adjectives[i % adjectives.length]} ${nouns[Math.floor(i / adjectives.length) % nouns.length]} ${i + 1}`;
  }
  const { lastInsertRowid: id } = insert.run({
    name, club, p1: `Spieler ${i + 1}a`, mail: `team${i + 1}@example.org`, p2: `Spieler ${i + 1}b`,
    payment: status === 'confirmed' ? 'paid' : 'pending', status,
    confirmedAt: status === 'confirmed' ? now : null, now, due: status === 'waitlist' ? null : due ?? day(14),
  });
  if (status !== 'waitlist') setRef.run(ref(id), id);
}

db.transaction(() => {
  for (let i = 0; i < count; i++) add('confirmed', day(-5));
  if (demo) {
    add('pending', day(-2)); // überfällig
    add('pending', day(5));
    add('pending', day(10));
    add('waitlist');
    add('waitlist');
    const start = new Date(); start.setHours(10, 0, 0, 0);
    const local = new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('tournament_start', ?)`).run(local);
  }
})();

console.log(demo
  ? `Demo-Daten in ${file}: 60 bezahlte Teams, 3 offene (1 überfällig), 2 auf der Warteliste.`
  : `${count} bestätigte Demo-Teams in ${file} angelegt.`);
