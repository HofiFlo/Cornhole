import 'server-only';
import { config } from './config';
import { db, getSetting } from './db';
import { normalizeClub } from './group-assignment';
import { sendMail } from './mail';
import type { RegistrationStatus, Team } from './types';
import { addDays } from './util';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const ACTIVE: RegistrationStatus[] = ['pending', 'confirmed', 'waitlist'];

export type RegistrationInput = {
  teamName: string; clubName: string;
  player1Name: string; player1Email: string; player1Phone: string;
  player2Name: string; player2Email: string; player2Phone: string;
};

export type RegistrationResult =
  | { waitlisted: true; teamName: string }
  | { paymentReference: string; iban: string; accountHolder: string; entryFee: string; dueDate: string; teamName: string };

export class UserError extends Error {}

export function findAllTeams(): Team[] {
  return db().prepare('SELECT * FROM teams ORDER BY id').all() as Team[];
}

export function getTeam(id: number): Team {
  const team = db().prepare('SELECT * FROM teams WHERE id = ?').get(id) as Team | undefined;
  if (!team) throw new UserError('Team nicht gefunden');
  return team;
}

export function isRegistrationOpen() {
  return getSetting('registration_open') !== 'false';
}

export function listClubs(): string[] {
  const rows = db().prepare(
    `SELECT DISTINCT TRIM(club_name) AS club FROM teams
     WHERE club_name IS NOT NULL AND TRIM(club_name) <> '' AND registration_status IN ('pending','confirmed','waitlist')
     ORDER BY club COLLATE NOCASE`
  ).all() as { club: string }[];
  return rows.map(r => r.club);
}

export function suggestSuffixForClub(club: string): string | null {
  const key = normalizeClub(club);
  if (!key) return null;
  const existing = (db().prepare(
    `SELECT club_name FROM teams WHERE club_name IS NOT NULL AND registration_status IN (${ACTIVE.map(() => '?').join(',')})`
  ).all(...ACTIVE) as { club_name: string }[]).filter(t => normalizeClub(t.club_name) === key).length;
  return existing === 0 ? null : (ROMAN[existing] ?? String(existing + 1));
}

const paymentReferenceFor = (id: number) => `${config.paymentRefPrefix}-${String(id).padStart(4, '0')}`;
const dueDate = () => addDays(new Date(), config.paymentDays).toISOString().slice(0, 10);

function clean(value: unknown, max = 100): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseRegistrationInput(body: Record<string, unknown>): RegistrationInput {
  const input: RegistrationInput = {
    teamName: clean(body.teamName, 60), clubName: clean(body.clubName, 80),
    player1Name: clean(body.player1Name), player1Email: clean(body.player1Email, 200), player1Phone: clean(body.player1Phone, 40),
    player2Name: clean(body.player2Name), player2Email: clean(body.player2Email, 200), player2Phone: clean(body.player2Phone, 40),
  };
  if (input.teamName.length < 2) throw new UserError('Bitte einen Teamnamen angeben');
  if (!input.player1Name || !input.player2Name) throw new UserError('Bitte die Namen beider Spieler angeben');
  if (!EMAIL.test(input.player1Email)) throw new UserError('Bitte eine gültige E-Mail-Adresse für Spieler 1 angeben');
  if (input.player2Email && !EMAIL.test(input.player2Email)) throw new UserError('Die E-Mail-Adresse von Spieler 2 ist ungültig');
  return input;
}

export async function createRegistration(input: RegistrationInput): Promise<RegistrationResult> {
  await releaseExpiredRegistrations();

  const team = db().transaction(() => {
    if (!isRegistrationOpen()) throw new UserError('Die Anmeldung ist geschlossen');
    const taken = db().prepare('SELECT 1 FROM teams WHERE LOWER(team_name) = LOWER(?)').get(input.teamName);
    if (taken) throw new UserError(`Der Teamname „${input.teamName}“ ist bereits vergeben`);

    const { n: activeCount } = db().prepare(
      `SELECT COUNT(*) AS n FROM teams WHERE registration_status IN ('pending','confirmed')`
    ).get() as { n: number };
    const status: RegistrationStatus = activeCount < config.maxTeams ? 'pending' : 'waitlist';

    const { lastInsertRowid } = db().prepare(
      `INSERT INTO teams (team_name, club_name, player1_name, player1_email, player1_phone,
                          player2_name, player2_email, player2_phone, registration_status, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).run(input.teamName, input.clubName || null, input.player1Name, input.player1Email, input.player1Phone || null,
          input.player2Name, input.player2Email || null, input.player2Phone || null, status);
    const id = Number(lastInsertRowid);

    if (status === 'pending') {
      db().prepare('UPDATE teams SET payment_reference = ?, payment_due_date = ? WHERE id = ?')
        .run(paymentReferenceFor(id), dueDate(), id);
    }
    return getTeam(id);
  })();

  if (team.registration_status === 'waitlist') {
    await sendMail(team, 'waitlisted');
    return { waitlisted: true, teamName: team.team_name };
  }
  await sendMail(team, 'registration_pending', {
    paymentReference: team.payment_reference!, iban: config.iban, paymentDueDate: team.payment_due_date!,
  });
  return {
    teamName: team.team_name, paymentReference: team.payment_reference!, iban: config.iban,
    accountHolder: config.accountHolder, entryFee: config.entryFee, dueDate: team.payment_due_date!,
  };
}

export function confirmPayment(teamId: number) {
  const team = getTeam(teamId);
  if (team.registration_status !== 'pending') throw new UserError('Nur ausstehende Anmeldungen können bestätigt werden');
  db().prepare(
    `UPDATE teams SET payment_status = 'paid', registration_status = 'confirmed', confirmed_at = ? WHERE id = ?`
  ).run(new Date().toISOString(), teamId);
  return getTeam(teamId);
}

/** Verfallene Anmeldungen (Frist abgelaufen, nicht bezahlt) freigeben und Warteliste nachrücken lassen. */
export async function releaseExpiredRegistrations() {
  const today = new Date().toISOString().slice(0, 10);
  const expired = db().prepare(
    `SELECT * FROM teams WHERE registration_status = 'pending' AND payment_due_date IS NOT NULL AND payment_due_date < ?`
  ).all(today) as Team[];
  for (const team of expired) {
    db().prepare(`UPDATE teams SET registration_status = 'expired' WHERE id = ?`).run(team.id);
    await sendMail(team, 'registration_expired');
    await promoteNextWaitlisted();
  }
}

async function promoteNextWaitlisted() {
  const next = db().prepare(
    `SELECT * FROM teams WHERE registration_status = 'waitlist' ORDER BY created_at, id LIMIT 1`
  ).get() as Team | undefined;
  if (!next) return;
  db().prepare(`UPDATE teams SET registration_status = 'pending', payment_reference = ?, payment_due_date = ? WHERE id = ?`)
    .run(paymentReferenceFor(next.id), dueDate(), next.id);
  const team = getTeam(next.id);
  await sendMail(team, 'registration_pending', {
    paymentReference: team.payment_reference!, iban: config.iban, paymentDueDate: team.payment_due_date!,
  });
}

const SYNC_COLUMNS = [
  'team_name', 'club_name', 'player1_name', 'player1_email', 'player1_phone', 'player2_name', 'player2_email',
  'player2_phone', 'payment_reference', 'payment_status', 'payment_due_date', 'registration_status',
  'created_at', 'confirmed_at',
] as const;

/** Übernimmt Teams der gehosteten Instanz. Lokal gesetzte Felder (group_id) bleiben erhalten. */
export function upsertTeams(remoteTeams: Team[]) {
  const stmt = db().prepare(
    `INSERT INTO teams (id, ${SYNC_COLUMNS.join(', ')}) VALUES (@id, ${SYNC_COLUMNS.map(c => '@' + c).join(', ')})
     ON CONFLICT(id) DO UPDATE SET ${SYNC_COLUMNS.map(c => `${c} = excluded.${c}`).join(', ')}`
  );
  db().transaction(() => {
    for (const t of remoteTeams) {
      const row: Record<string, unknown> = { id: t.id };
      for (const c of SYNC_COLUMNS) row[c] = t[c] ?? null;
      stmt.run(row);
    }
  })();
}
