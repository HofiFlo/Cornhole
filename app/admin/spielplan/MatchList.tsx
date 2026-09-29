'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { TOTAL_LANES } from '@/lib/schedule';
import { formatTime } from '@/lib/util';
import { StatusBadge } from '../components/StatusBadge';

export type MatchListItem = {
  id: number; group: string; round: number; lane: number | null; globalSlot: number | null; startTime: string | null;
  status: 'scheduled' | 'finished'; isBye: boolean;
  teamAName: string; teamBName: string; teamAPoints: number; teamBPoints: number;
};

export default function MatchList({ matches, editable }: { matches: MatchListItem[]; editable: boolean }) {
  const [search, setSearch] = useState('');
  const [lane, setLane] = useState<string>('');
  const [status, setStatus] = useState<'open' | 'finished' | 'all'>('open');
  const [showByes, setShowByes] = useState(false);

  const games = useMemo(() => matches.filter(m => !m.isBye), [matches]);
  const byes = matches.filter(m => m.isBye);

  // Pro Bahn das nächste offene Spiel (niedrigster Slot)
  const laneQueue = useMemo(() => Array.from({ length: TOTAL_LANES }, (_, i) => i + 1).map(l => ({
    lane: l,
    match: games.filter(m => m.lane === l && m.status !== 'finished')
      .sort((a, b) => (a.globalSlot ?? 0) - (b.globalSlot ?? 0))[0],
  })), [games]);

  const q = search.trim().toLowerCase();
  const visible = games
    .filter(m => !q || m.teamAName.toLowerCase().includes(q) || m.teamBName.toLowerCase().includes(q))
    .filter(m => !lane || m.lane === Number(lane))
    .filter(m => status === 'all' || (status === 'open' ? m.status !== 'finished' : m.status === 'finished'));

  const done = games.filter(m => m.status === 'finished').length;

  return (
    <div className="stack">
      <p className="muted">{done} von {games.length} Spielen erfasst.</p>

      <h2>Nächstes Spiel je Bahn</h2>
      <div className="lane-queue">
        {laneQueue.map(({ lane: l, match }) => (
          <div key={l} className="card">
            <div className="lane">Bahn {l}</div>
            {match ? (
              <>
                <div>{match.teamAName} – {match.teamBName}</div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">Gr. {match.group}, Rd. {match.round}{match.startTime && ` · ${formatTime(new Date(match.startTime))}`}</span>
                  {editable && <Link href={`/admin/spiel/${match.id}`}>Erfassen</Link>}
                </div>
              </>
            ) : <div className="muted">keine offenen Spiele</div>}
          </div>
        ))}
      </div>

      <h2>Alle Spiele</h2>
      <div className="row">
        <input placeholder="Team suchen…" value={search} onChange={e => setSearch(e.target.value)} style={{ minWidth: 260 }} />
        <select value={lane} onChange={e => setLane(e.target.value)}>
          <option value="">Alle Bahnen</option>
          {Array.from({ length: TOTAL_LANES }, (_, i) => <option key={i} value={i + 1}>Bahn {i + 1}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value as typeof status)}>
          <option value="open">Offen</option>
          <option value="finished">Erfasst</option>
          <option value="all">Alle</option>
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Zeit</th><th>Bahn</th><th>Gruppe</th><th>Rd.</th><th>Team A</th><th className="num">Ergebnis</th><th>Team B</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {visible.map(m => (
              <tr key={m.id}>
                <td>{m.startTime ? formatTime(new Date(m.startTime)) : `Slot ${(m.globalSlot ?? 0) + 1}`}</td>
                <td>{m.lane}</td>
                <td>{m.group}</td>
                <td>{m.round}</td>
                <td>{m.teamAName}</td>
                <td className="num">{m.status === 'finished' ? `${m.teamAPoints} : ${m.teamBPoints}` : '–'}</td>
                <td>{m.teamBName}</td>
                <td><StatusBadge status={m.status} /></td>
                <td>{editable && <Link href={`/admin/spiel/${m.id}`}>{m.status === 'finished' ? 'Korrigieren' : 'Erfassen'}</Link>}</td>
              </tr>
            ))}
            {visible.length === 0 && <tr><td colSpan={9} className="muted">Keine Spiele gefunden.</td></tr>}
          </tbody>
        </table>
      </div>

      {byes.length > 0 && (
        <div>
          <button className="secondary small" onClick={() => setShowByes(s => !s)}>
            {showByes ? 'Freilose ausblenden' : `Freilose anzeigen (${byes.length})`}
          </button>
          {showByes && (
            <ul>{byes.map(m => <li key={m.id}>Gruppe {m.group}, Runde {m.round}: {m.teamAName} hat Freilos (automatischer Sieg)</li>)}</ul>
          )}
        </div>
      )}
    </div>
  );
}
