'use client';

import { useState } from 'react';
import type { RegistrationStatus, Team } from '@/lib/types';
import { formatDate } from '@/lib/util';
import { ActionButton } from '../components/ActionButton';
import { StatusBadge } from '../components/StatusBadge';
import { REGISTRATION_LABELS } from '../labels';

type Filter = RegistrationStatus | 'all';
const FILTERS: Filter[] = ['pending', 'confirmed', 'waitlist', 'expired', 'all'];

export default function AdminRegistrations({ teams, maxTeams }: { teams: Team[]; maxTeams: number }) {
  const [filter, setFilter] = useState<Filter>('pending');
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();
  const filtered = teams
    .filter(t => filter === 'all' || t.registration_status === filter)
    .filter(t => !q || t.team_name.toLowerCase().includes(q) || t.payment_reference?.toLowerCase().includes(q)
      || t.player1_name.toLowerCase().includes(q) || t.player2_name.toLowerCase().includes(q));
  const count = (s: Filter) => (s === 'all' ? teams.length : teams.filter(t => t.registration_status === s).length);

  return (
    <div className="admin-registrations stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong>Bestätigt: {count('confirmed')} / {maxTeams}</strong>
        <input style={{ minWidth: 320 }} placeholder="Team, Spieler oder Zahlungsreferenz suchen…"
          value={search} onChange={e => setSearch(e.target.value)} autoFocus />
      </div>
      <div className="status-tabs">
        {FILTERS.map(s => (
          <button key={s} className={s === filter ? 'active' : ''} onClick={() => setFilter(s)}>
            {REGISTRATION_LABELS[s]} ({count(s)})
          </button>
        ))}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Team</th><th>Verein</th><th>Spieler</th><th>Kontakt</th><th>Referenz</th><th>Frist</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id}>
                <td><strong>{t.team_name}</strong></td>
                <td>{t.club_name}</td>
                <td>{t.player1_name} / {t.player2_name}</td>
                <td className="muted" style={{ fontSize: '0.85rem' }}>{t.player1_email}{t.player1_phone && <><br />{t.player1_phone}</>}</td>
                <td className="reference">{t.payment_reference}</td>
                <td>{formatDate(t.payment_due_date)}</td>
                <td><StatusBadge status={t.registration_status} /></td>
                <td>
                  {t.registration_status === 'pending' && (
                    <ActionButton url={`/api/admin/teams/${t.id}/confirm`} className="small"
                      confirmText={`Zahlungseingang für „${t.team_name}“ (${t.payment_reference}) bestätigen?`}>
                      Zahlung bestätigt
                    </ActionButton>
                  )}
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
