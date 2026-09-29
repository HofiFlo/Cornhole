'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { RegistrationStatus, Team } from '@/lib/types';
import { formatDate, formatDateTime, isOverdue } from '@/lib/util';
import { ActionButton } from '../components/ActionButton';
import { StatusBadge } from '../components/StatusBadge';
import { REGISTRATION_LABELS } from '../labels';

type Filter = RegistrationStatus | 'overdue' | 'all';
const FILTERS: Filter[] = ['pending', 'overdue', 'confirmed', 'waitlist', 'unverified', 'expired', 'all'];
const FILTER_LABELS: Record<Filter, string> = { ...REGISTRATION_LABELS, overdue: 'Überfällig' };


export default function AdminRegistrations({ teams, maxTeams }: { teams: Team[]; maxTeams: number }) {
  const [filter, setFilter] = useState<Filter>('pending');
  const [search, setSearch] = useState('');

  const matches = (t: Team, f: Filter) =>
    f === 'all' || (f === 'overdue' ? isOverdue(t) : t.registration_status === f);
  const q = search.trim().toLowerCase();
  const filtered = teams
    .filter(t => matches(t, filter))
    .filter(t => !q || t.team_name.toLowerCase().includes(q) || t.payment_reference?.toLowerCase().includes(q)
      || t.player1_name.toLowerCase().includes(q) || t.player2_name.toLowerCase().includes(q)
      || t.player1_email.toLowerCase().includes(q));
  const count = (f: Filter) => teams.filter(t => matches(t, f)).length;

  return (
    <div className="admin-registrations stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong>Bestätigt: {count('confirmed')} / {maxTeams}</strong>
        <input style={{ minWidth: 320 }} placeholder="Team, Spieler, E-Mail oder Zahlungsreferenz suchen…"
          value={search} onChange={e => setSearch(e.target.value)} autoFocus />
      </div>
      <div className="status-tabs">
        {FILTERS.map(s => (
          <button key={s} className={s === filter ? 'active' : ''} onClick={() => setFilter(s)}>
            {FILTER_LABELS[s]} ({count(s)})
          </button>
        ))}
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Überfällige Anmeldungen verfallen nicht automatisch – die Turnierleitung entscheidet mit „Verfallen lassen“.
        Der Platz geht dann an das erste Team der Warteliste.
      </p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Team</th><th>Verein</th><th>Spieler</th><th>Kontakt</th><th>Referenz</th><th>Frist</th><th>Status</th><th>Aktionen</th></tr></thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id}>
                <td><strong>{t.team_name}</strong></td>
                <td>{t.club_name}</td>
                <td>{t.player1_name} / {t.player2_name}</td>
                <td className="muted" style={{ fontSize: '0.85rem' }}>{t.player1_email}{t.player1_phone && <><br />{t.player1_phone}</>}</td>
                <td className="reference">{t.payment_reference}</td>
                <td>
                  <span className={isOverdue(t) ? 'overdue' : undefined}>{formatDate(t.payment_due_date)}</span>
                  {isOverdue(t) && <><br /><span className="badge expired">überfällig</span></>}
                  {t.last_reminder_at && <><br /><span className="muted" style={{ fontSize: '0.8rem' }}>erinnert {formatDateTime(t.last_reminder_at)}</span></>}
                </td>
                <td><StatusBadge status={t.registration_status} /></td>
                <td>
                  <div className="row" style={{ gap: '0.3rem' }}>
                    {t.registration_status === 'pending' && (
                      <>
                        <ActionButton url={`/api/admin/teams/${t.id}/confirm`} className="small"
                          confirmText={`Zahlungseingang für „${t.team_name}“ (${t.payment_reference}) bestätigen?`}>
                          Zahlung bestätigt
                        </ActionButton>
                        <ActionButton url="/api/admin/mail" body={{ teamIds: [t.id], template: 'payment_reminder' }}
                          className="small secondary" successText="Erinnerung gesendet"
                          confirmText={`Zahlungserinnerung an „${t.team_name}“ senden?`}>
                          Erinnern
                        </ActionButton>
                        <ActionButton url={`/api/admin/teams/${t.id}/expire`} className="small danger"
                          confirmText={`Anmeldung von „${t.team_name}“ verfallen lassen? Das Team wird per Mail informiert, der Platz geht an die Warteliste.`}>
                          Verfallen lassen
                        </ActionButton>
                      </>
                    )}
                    {t.registration_status !== 'unverified' && (
                      <Link className="button small secondary" href={`/admin/mails?team=${t.id}`}>Mail</Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={8} className="muted">Keine Einträge.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
