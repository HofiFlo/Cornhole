import 'server-only';
import crypto from 'node:crypto';
import { config } from './config';
import { db, getSetting } from './db';
import { normalizeClub } from './group-assignment';
import { sendMail } from './mail';
import type { RegistrationStatus, Team } from './types';
import { addDays } from './util';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI'];
const ACTIVE: RegistrationStatus[] = ['unverified', 'pending', 'confirmed', 'waitlist'];
/** Unbestätigte Anmeldungen (Link nicht geklickt) geben den Teamnamen nach dieser Zeit wieder frei. */
const UNVERIFIED_TTL_HOURS = 48;

export type RegistrationInput = {
  teamName: string; clubName: string;
  player1Name: string; player1Email: string; player1Phone: string;
  player2Name: string; player2Email: string; player2Phone: string;
};

export type RegistrationResult =
  | { waitlisted: true; teamName: string }
  | { confirmed: true; teamName: string }
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

/**
 * Schritt 1 der Anmeldung: Daten speichern (Status `unverified`) und Bestätigungslink an Spieler 1 schicken.
 * Ein Platz (bzw. die Warteliste) wird erst beim Klick auf den Link vergeben.
 */
export async function createRegistration(input: RegistrationInput, baseUrl: string) {
  const team = db().transaction(() => {
    if (!isRegistrationOpen()) throw new UserError('Die Anmeldung ist geschlossen');
    db().prepare(`DELETE FROM teams WHERE registration_status = 'unverified' AND created_at < datetime('now', ?)`)
      .run(`-${UNVERIFIED_TTL_HOURS} hours`);
    const taken = db().prepare('SELECT 1 FROM teams WHERE LOWER(team_name) = LOWER(?)').get(input.teamName);
    if (taken) throw new UserError(`Der Teamname „${input.teamName}“ ist bereits vergeben`);

    const token = crypto.randomBytes(24).toString('base64url');
    const { lastInsertRowid } = db().prepare(
      `INSERT INTO teams (team_name, club_name, player1_name, player1_email, player1_phone,
                          player2_name, player2_email, player2_phone, registration_status, payment_status, email_verify_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unverified', 'pending', ?)`
    ).run(input.teamName, input.clubName || null, input.player1Name, input.player1Email, input.player1Phone || null,
          input.player2Name, input.player2Email || null, input.player2Phone || null, token);
    return getTeam(Number(lastInsertRowid));
  })();

  const verifyUrl = `${baseUrl.replace(/\/+$/, '')}/anmeldung/bestaetigen?token=${team.email_verify_token}`;
  // Bestätigungslink nur an Spieler 1 (dessen Adresse wird damit verifiziert)
  const ok = await sendMail({ ...team, player2_email: null }, 'verify_email', { verifyUrl });
  if (!ok) {
    db().prepare('DELETE FROM teams WHERE id = ?').run(team.id);
    throw new UserError('Die Bestätigungsmail konnte nicht verschickt werden – bitte E-Mail-Adresse prüfen');
  }
  return { verificationSent: true as const, email: team.player1_email, teamName: team.team_name };
}

export function findTeamByVerifyToken(token: string): Team | null {
  if (!token) return null;
  return (db().prepare('SELECT * FROM teams WHERE email_verify_token = ?').get(token) as Team | undefined) ?? null;
}

function resultFor(team: Team): RegistrationResult {
  if (team.registration_status === 'waitlist') return { waitlisted: true, teamName: team.team_name };
  if (team.registration_status === 'confirmed') return { confirmed: true, teamName: team.team_name };
  if (team.registration_status === 'pending') {
    return {
      teamName: team.team_name, paymentReference: team.payment_reference!, iban: config.iban,
      accountHolder: config.accountHolder, entryFee: config.entryFee, dueDate: team.payment_due_date!,
    };
  }
  throw new UserError('Diese Anmeldung ist nicht mehr gültig – bitte bei der Turnierleitung melden');
}

/** Schritt 2 der Anmeldung: Link geklickt → Platz vergeben (oder Warteliste), Zahlungsdaten schicken. */
export async function verifyRegistration(token: string): Promise<RegistrationResult> {
  const found = findTeamByVerifyToken(token);
  if (!found) throw new UserError('Der Bestätigungslink ist ungültig oder abgelaufen – bitte erneut anmelden');
  if (found.registration_status !== 'unverified') return resultFor(found); // Link erneut geöffnet

  const team = db().transaction(() => {
    if (!isRegistrationOpen()) throw new UserError('Die Anmeldung ist inzwischen geschlossen');
    const { n: activeCount } = db().prepare(
      `SELECT COUNT(*) AS n FROM teams WHERE registration_status IN ('pending','confirmed')`
    ).get() as { n: number };
    const now = new Date().toISOString();
    if (activeCount < config.maxTeams) {
      db().prepare(`UPDATE teams SET registration_status = 'pending', email_verified_at = ?, payment_reference = ?, payment_due_date = ?
                    WHERE id = ?`).run(now, paymentReferenceFor(found.id), dueDate(), found.id);
    } else {
      db().prepare(`UPDATE teams SET registration_status = 'waitlist', email_verified_at = ? WHERE id = ?`).run(now, found.id);
    }
    return getTeam(found.id);
  })();

  await sendMail(team, team.registration_status === 'waitlist' ? 'waitlisted' : 'registration_pending');
  return resultFor(team);
}

export function confirmPayment(teamId: number) {
  const team = getTeam(teamId);
  if (team.registration_status !== 'pending') throw new UserError('Nur ausstehende Anmeldungen können bestätigt werden');
  db().prepare(
    `UPDATE teams SET payment_status = 'paid', registration_status = 'confirmed', confirmed_at = ? WHERE id = ?`
  ).run(new Date().toISOString(), teamId);
  return getTeam(teamId);
}

/**
 * Anmeldung ohne Zahlung verfallen lassen – nur auf Entscheidung der Turnierleitung (kein Automatismus).
 * Der Platz geht an das älteste Team der Warteliste.
 */
export async function expireRegistration(teamId: number) {
  const team = getTeam(teamId);
  if (team.registration_status !== 'pending') throw new UserError('Nur offene (unbezahlte) Anmeldungen können verfallen');
  db().prepare(`UPDATE teams SET registration_status = 'expired' WHERE id = ?`).run(teamId);
  await sendMail(team, 'registration_expired');
  const promoted = await promoteNextWaitlisted();
  return { promoted: promoted?.team_name ?? null };
}

async function promoteNextWaitlisted() {
  const next = db().prepare(
    `SELECT * FROM teams WHERE registration_status = 'waitlist' ORDER BY created_at, id LIMIT 1`
  ).get() as Team | undefined;
  if (!next) return null;
  db().prepare(`UPDATE teams SET registration_status = 'pending', payment_reference = ?, payment_due_date = ? WHERE id = ?`)
    .run(paymentReferenceFor(next.id), dueDate(), next.id);
  const team = getTeam(next.id);
  await sendMail(team, 'registration_pending');
  return team;
}

export type TeamMailRequest =
  | { teamIds: number[]; template: 'payment_reminder' }
  | { teamIds: number[]; template: 'custom'; subject: string; body: string };

/** Zahlungserinnerung oder freie Mail an ausgewählte Teams (einzeln oder Rundmail). */
export async function sendTeamMails(req: TeamMailRequest) {
  const ids = [...new Set((req.teamIds ?? []).map(Number).filter(n => Number.isInteger(n) && n > 0))];
  if (ids.length === 0) throw new UserError('Keine Empfänger ausgewählt');
  if (req.template === 'custom' && (!req.subject?.trim() || !req.body?.trim())) {
    throw new UserError('Bitte Betreff und Text angeben');
  }
  const result = { sent: 0, failed: [] as string[], skipped: [] as string[] };
  for (const id of ids) {
    const team = db().prepare('SELECT * FROM teams WHERE id = ?').get(id) as Team | undefined;
    if (!team) continue;
    if (req.template === 'payment_reminder' && team.registration_status !== 'pending') {
      result.skipped.push(team.team_name);
      continue;
    }
    const ok = req.template === 'custom'
      ? await sendMail(team, 'custom', { subject: req.subject.trim(), body: req.body.trim() })
      : await sendMail(team, 'payment_reminder');
    if (!ok) { result.failed.push(team.team_name); continue; }
    result.sent++;
    if (req.template === 'payment_reminder') {
      db().prepare('UPDATE teams SET last_reminder_at = ? WHERE id = ?').run(new Date().toISOString(), id);
    }
  }
  return result;
}

const SYNC_COLUMNS = [
  'team_name', 'club_name', 'player1_name', 'player1_email', 'player1_phone', 'player2_name', 'player2_email',
  'player2_phone', 'payment_reference', 'payment_status', 'payment_due_date', 'registration_status',
  'created_at', 'confirmed_at', 'email_verified_at', 'last_reminder_at',
] as const;

/** Übernimmt Teams der gehosteten Instanz. Lokal gesetzte Felder (group_id) bleiben erhalten. */
export function upsertTeams(remoteTeams: Team[]) {
  const stmt = db().prepare(
    `INSERT INTO teams (id, ${SYNC_COLUMNS.join(', ')}) VALUES (@id, ${SYNC_COLUMNS.map(c => '@' + c).join(', ')})
     ON CONFLICT(id) DO UPDATE SET ${SYNC_COLUMNS.map(c => `${c} = excluded.${c}`).join(', ')}`
  );
  db().transaction(() => {
    // Auf der gehosteten Instanz gelöschte Teams (abgelaufene unbestätigte Anmeldungen) auch lokal entfernen,
    // sofern sie noch keiner Gruppe zugeteilt sind
    const remoteIds = new Set(remoteTeams.map(t => t.id));
    const local = db().prepare('SELECT id FROM teams WHERE group_id IS NULL').all() as { id: number }[];
    const del = db().prepare('DELETE FROM teams WHERE id = ?');
    for (const { id } of local) if (!remoteIds.has(id)) del.run(id);
    for (const t of remoteTeams) {
      const row: Record<string, unknown> = { id: t.id };
      for (const c of SYNC_COLUMNS) row[c] = t[c] ?? null;
      stmt.run(row);
    }
  })();
}
