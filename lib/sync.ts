// Synchronisation lokale App <-> gehostete Anmeldung (per Sync-Token, kein Nutzer-Login)
import 'server-only';
import crypto from 'node:crypto';
import { config } from './config';
import { setSetting } from './db';
import { confirmPayment, expireRegistration, sendTeamMails, upsertTeams, type TeamMailRequest } from './registration';
import type { Team } from './types';

/** Ohne HOSTED_URL läuft die lokale App eigenständig (z. B. zum Testen oder bei Anmeldung vor Ort). */
export const isStandalone = () => !config.hostedUrl;

const authHeader = () => ({ Authorization: `Bearer ${config.syncToken}` });

export async function pullRegistrations() {
  if (isStandalone()) {
    setSetting('last_sync_at', new Date().toISOString());
    return;
  }
  const res = await fetch(`${config.hostedUrl}/api/sync/teams`, { headers: authHeader(), cache: 'no-store' });
  if (!res.ok) throw new Error(`Sync fehlgeschlagen (${res.status})`);
  const remoteTeams: Team[] = await res.json();
  upsertTeams(remoteTeams);
  setSetting('last_sync_at', new Date().toISOString());
}

export async function confirmPaymentSynced(teamId: number) {
  if (isStandalone()) {
    confirmPayment(teamId);
    return;
  }
  const res = await fetch(`${config.hostedUrl}/api/sync/teams/${teamId}/confirm`, { method: 'POST', headers: authHeader() });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? 'Bestätigung konnte nicht gesendet werden – Internet prüfen');
  }
  await pullRegistrations();
}

async function postHosted<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${config.hostedUrl}${path}`, {
    method: 'POST', headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `Gehostete Instanz nicht erreichbar (${res.status}) – Internet prüfen`);
  return data as T;
}

export async function expireRegistrationSynced(teamId: number): Promise<{ promoted: string | null }> {
  if (isStandalone()) return expireRegistration(teamId);
  const result = await postHosted<{ promoted: string | null }>(`/api/sync/teams/${teamId}/expire`);
  await pullRegistrations();
  return result;
}

/** Mails verschickt die gehostete Instanz (dort liegen die SMTP-Zugangsdaten). */
export async function sendTeamMailsSynced(req: TeamMailRequest) {
  if (isStandalone()) return sendTeamMails(req);
  const result = await postHosted<Awaited<ReturnType<typeof sendTeamMails>>>('/api/sync/mail', req);
  await pullRegistrations();
  return result;
}

export async function setRegistrationOpenSynced(open: boolean) {
  if (!isStandalone()) {
    const res = await fetch(`${config.hostedUrl}/api/sync/registration`, {
      method: 'POST', headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ open }),
    });
    if (!res.ok) throw new Error(`Anmeldestatus konnte nicht übertragen werden (${res.status})`);
    await pullRegistrations();
  }
  setSetting('registration_open', String(open));
}

/** Serverseitige Prüfung des Sync-Tokens (zusätzlich zur Prüfung im Proxy). */
export function isAuthorizedSyncRequest(req: Request): boolean {
  const token = config.syncToken;
  if (!token) return false;
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${token}`);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}
