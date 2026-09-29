'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';
import type { SetEntry } from '@/lib/types';

type Props = {
  endpoint: string; backHref: string; teamAName: string; teamBName: string; initial: SetEntry[]; hasResult: boolean;
};

type Row = { a: string; b: string };

/** Ab Viertelfinale: Sätze bis 21, Best of 3 – Übertrag vom Schiedsrichter-Zettel. */
export default function SetsForm({ endpoint, backHref, teamAName, teamBName, initial, hasResult }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => {
    const filled = initial.map(s => ({ a: String(s.teamAScore), b: String(s.teamBScore) }));
    while (filled.length < 3) filled.push({ a: '', b: '' });
    return filled;
  });
  const [byReferee, setByReferee] = useState(hasResult);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sets: SetEntry[] = rows
    .filter(r => r.a !== '' || r.b !== '')
    .map(r => ({ teamAScore: Number(r.a) || 0, teamBScore: Number(r.b) || 0 }));
  let winsA = 0, winsB = 0;
  for (const s of sets) { if (s.teamAScore > s.teamBScore) winsA++; else if (s.teamBScore > s.teamAScore) winsB++; }
  const winner = winsA >= 2 ? teamAName : winsB >= 2 ? teamBName : null;

  async function save() {
    setBusy(true); setError(null);
    try {
      await api(endpoint, 'POST', { sets, enteredByReferee: byReferee });
      if (winner) router.push(backHref);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!confirm('Ergebnis dieses Spiels löschen?')) return;
    try {
      await api(endpoint, 'DELETE');
      setRows([{ a: '', b: '' }, { a: '', b: '' }, { a: '', b: '' }]);
      router.refresh();
    } catch (e) { setError((e as Error).message); }
  }

  const set = (i: number, key: keyof Row, v: string) =>
    setRows(rs => rs.map((r, j) => (j === i ? { ...r, [key]: v.replace(/\D/g, '').slice(0, 2) } : r)));

  return (
    <div className="stack">
      <div className="table-wrap" style={{ maxWidth: 520 }}>
        <table className="kehren-table">
          <thead><tr><th>Satz</th><th className="team-head">{teamAName}</th><th className="team-head">{teamBName}</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td><input inputMode="numeric" value={r.a} onChange={e => set(i, 'a', e.target.value)} /></td>
                <td><input inputMode="numeric" value={r.b} onChange={e => set(i, 'b', e.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="result-preview">Sätze {winsA} : {winsB}{winner && <> – Sieger: <span style={{ color: 'var(--accent)' }}>{winner}</span></>}</p>
      <label className="row">
        <input type="checkbox" checked={byReferee} onChange={e => setByReferee(e.target.checked)} />
        Ergebnis laut Schiedsrichter-Zettel (vom Schiedsrichter unterschrieben)
      </label>
      <div className="row">
        <button type="button" onClick={save} disabled={busy || sets.length === 0 || !byReferee}>
          {busy ? 'Speichert…' : winner ? 'Ergebnis speichern' : 'Zwischenstand speichern'}
        </button>
        {hasResult && <button type="button" className="danger" onClick={reset}>Ergebnis löschen</button>}
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
