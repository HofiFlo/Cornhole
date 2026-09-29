'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { api } from '@/lib/client';
import { fillPlaceholders, PLACEHOLDERS } from '@/lib/mail-templates';
import type { Team } from '@/lib/types';
import { isOverdue } from '@/lib/util';
import { REGISTRATION_LABELS } from '../labels';

type Audience = 'active' | 'confirmed' | 'pending' | 'overdue' | 'waitlist' | 'none';
const AUDIENCES: Record<Audience, { label: string; match: (t: Team) => boolean }> = {
  active: { label: 'Alle Teams (bestätigt, offen, Warteliste)', match: t => ['confirmed', 'pending', 'waitlist'].includes(t.registration_status) },
  confirmed: { label: 'Bestätigte Teams', match: t => t.registration_status === 'confirmed' },
  pending: { label: 'Zahlung offen', match: t => t.registration_status === 'pending' },
  overdue: { label: 'Zahlung überfällig', match: t => isOverdue(t) },
  waitlist: { label: 'Warteliste', match: t => t.registration_status === 'waitlist' },
  none: { label: 'Keine (einzeln auswählen)', match: () => false },
};

type Result = { sent: number; failed: string[]; skipped: string[] };

export default function MailComposer({ teams, preselect, iban, entryFee }: {
  teams: Team[]; preselect: number | null; iban: string; entryFee: string;
}) {
  const router = useRouter();
  const [audience, setAudience] = useState<Audience>(preselect ? 'none' : 'pending');
  const [selected, setSelected] = useState<Set<number>>(() =>
    new Set(preselect ? [preselect] : teams.filter(AUDIENCES.pending.match).map(t => t.id)));
  const [template, setTemplate] = useState<'payment_reminder' | 'custom'>(
    preselect && teams.find(t => t.id === preselect)?.registration_status !== 'pending' ? 'custom' : 'payment_reminder');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('Hallo {spieler1},\n\n\n\nSportliche Grüße\nEure Turnierleitung');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chooseAudience = (a: Audience) => {
    setAudience(a);
    setSelected(new Set(teams.filter(AUDIENCES[a].match).map(t => t.id)));
  };
  const toggle = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const recipients = teams.filter(t => selected.has(t.id));
  // Zahlungserinnerungen gehen nur an Teams mit offener Zahlung
  const effective = template === 'payment_reminder' ? recipients.filter(t => t.registration_status === 'pending') : recipients;
  const previewTeam = effective[0];
  const preview = useMemo(() => previewTeam && template === 'custom'
    ? { subject: fillPlaceholders(subject, previewTeam, { iban, entryFee }), body: fillPlaceholders(body, previewTeam, { iban, entryFee }) }
    : null, [previewTeam, template, subject, body, iban, entryFee]);

  async function send() {
    const what = template === 'payment_reminder' ? 'Zahlungserinnerung' : `Mail „${subject}“`;
    if (!confirm(`${what} an ${effective.length} Team(s) senden?`)) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const res = await api<Result>('/api/admin/mail', 'POST', template === 'custom'
        ? { template, teamIds: effective.map(t => t.id), subject, body }
        : { template, teamIds: effective.map(t => t.id) });
      setResult(res);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mail-composer">
      <section className="card stack">
        <h3>Empfänger ({recipients.length})</h3>
        <select style={{ width: '100%' }} value={audience} onChange={e => chooseAudience(e.target.value as Audience)}>
          {(Object.keys(AUDIENCES) as Audience[]).map(a => (
            <option key={a} value={a}>{AUDIENCES[a].label}{a !== 'none' && ` (${teams.filter(AUDIENCES[a].match).length})`}</option>
          ))}
        </select>
        <div className="recipient-list">
          {teams.map(t => (
            <label key={t.id}>
              <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
              <span style={{ flex: 1 }}>{t.team_name}</span>
              <span className={`badge ${t.registration_status}`}>{isOverdue(t) ? 'überfällig' : REGISTRATION_LABELS[t.registration_status]}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="card stack">
        <div className="status-tabs">
          <button className={template === 'payment_reminder' ? 'active' : ''} onClick={() => setTemplate('payment_reminder')}>Zahlungserinnerung</button>
          <button className={template === 'custom' ? 'active' : ''} onClick={() => setTemplate('custom')}>Freie Nachricht</button>
        </div>

        {template === 'payment_reminder' ? (
          <div className="stack">
            <p>Standardtext mit IBAN, Betrag, Zahlungsreferenz und Frist des jeweiligen Teams.</p>
            {recipients.length !== effective.length && (
              <p className="notice">{recipients.length - effective.length} ausgewählte Team(s) haben keine offene Zahlung und werden übersprungen.</p>
            )}
          </div>
        ) : (
          <div className="stack">
            <label>Betreff<input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="z. B. Infos zum Turniertag" /></label>
            <label>Text<textarea value={body} onChange={e => setBody(e.target.value)} /></label>
            <p className="muted" style={{ margin: 0 }}>
              Platzhalter: {Object.entries(PLACEHOLDERS).map(([k, v]) => <span key={k} title={v}><code>{k}</code> </span>)}
            </p>
            {preview && (
              <div>
                <strong>Vorschau für „{previewTeam.team_name}“:</strong>
                <div className="mail-preview"><strong>{preview.subject}</strong>{'\n\n'}{preview.body}</div>
              </div>
            )}
          </div>
        )}

        <div className="row">
          <button onClick={send} disabled={busy || effective.length === 0 || (template === 'custom' && (!subject.trim() || !body.trim()))}>
            {busy ? 'Wird gesendet…' : `An ${effective.length} Team(s) senden`}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        {result && (
          <p className={result.failed.length ? 'notice' : 'success'}>
            {result.sent} Mail(s) versendet.
            {result.skipped.length > 0 && <> Übersprungen: {result.skipped.join(', ')}.</>}
            {result.failed.length > 0 && <> Fehlgeschlagen: {result.failed.join(', ')}.</>}
          </p>
        )}
      </section>
    </div>
  );
}
