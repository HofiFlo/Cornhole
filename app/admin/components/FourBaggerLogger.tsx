'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';

/** Manuelles Erfassen eines 4-Baggers (z. B. in Satz-Spielen ab dem Viertelfinale). */
export default function FourBaggerLogger({ matchType, matchId, teams }: {
  matchType: 'group' | 'ko'; matchId: number; teams: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [teamId, setTeamId] = useState(teams[0]?.id ?? 0);
  const [player, setPlayer] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function log(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/api/admin/four-baggers', 'POST', { matchType, matchId, teamId, playerName: player });
      setMsg('4-Bagger erfasst 🍺'); setPlayer('');
      router.refresh();
    } catch (err) { setMsg((err as Error).message); }
  }

  return (
    <form onSubmit={log} className="card row">
      <strong>4-Bagger (Freigetränk):</strong>
      <select value={teamId} onChange={e => setTeamId(Number(e.target.value))}>
        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <input placeholder="Spieler (optional)" value={player} onChange={e => setPlayer(e.target.value)} />
      <button type="submit" className="secondary">Erfassen</button>
      {msg && <span className="muted">{msg}</span>}
    </form>
  );
}
