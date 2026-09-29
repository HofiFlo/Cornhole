'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';
import { KEHREN_PER_MATCH, rawPointsFromBags, scoreKehre } from '@/lib/scoring';
import type { KehreEntry } from '@/lib/types';

type Props = {
  endpoint: string;
  backHref: string;
  teamAName: string;
  teamBName: string;
  initial: KehreEntry[];
  /** 16tel/8tel: bei Gleichstand nach 8 Kehren Verlängerung */
  suddenDeath: boolean;
  editable: boolean;
  hasResult: boolean;
};

const emptyKehre = (): KehreEntry => ({ teamA: { inHole: 0, onBoard: 0 }, teamB: { inHole: 0, onBoard: 0 } });
const emptySheet = () => Array.from({ length: KEHREN_PER_MATCH }, emptyKehre);

export default function KehrenForm({ endpoint, backHref, teamAName, teamBName, initial, suddenDeath, editable, hasResult }: Props) {
  const router = useRouter();
  const [kehren, setKehren] = useState<KehreEntry[]>(() => (initial.length ? initial : emptySheet()));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (i: number, team: 'teamA' | 'teamB', field: 'inHole' | 'onBoard', value: string) => {
    const n = Math.max(0, Math.min(4, Math.trunc(Number(value)) || 0));
    setKehren(ks => ks.map((k, j) => (j === i ? { ...k, [team]: { ...k[team], [field]: n } } : k)));
  };

  let totalA = 0, totalB = 0;
  const rows = kehren.map(k => {
    const rawA = rawPointsFromBags(k.teamA), rawB = rawPointsFromBags(k.teamB);
    const s = scoreKehre(rawA, rawB);
    totalA += s.a; totalB += s.b;
    const invalid = k.teamA.inHole + k.teamA.onBoard > 4 || k.teamB.inHole + k.teamB.onBoard > 4;
    return { rawA, rawB, s, totalA, totalB, invalid };
  });
  const tied = totalA === totalB;
  const needsExtra = suddenDeath && tied;
  const winner = totalA > totalB ? teamAName : totalB > totalA ? teamBName : null;

  async function save() {
    setBusy(true); setError(null);
    try {
      await api(endpoint, 'POST', { kehren });
      if (needsExtra) { router.refresh(); setBusy(false); return; }
      router.push(backHref);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function reset() {
    if (!confirm('Ergebnis dieses Spiels löschen?')) return;
    try {
      await api(endpoint, 'DELETE');
      setKehren(emptySheet());
      router.refresh();
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="stack">
      <div className="table-wrap">
        <table className="kehren-table">
          <thead>
            <tr>
              <th rowSpan={2}>Kehre</th>
              <th colSpan={3} className="team-head">{teamAName}</th>
              <th colSpan={3} className="team-head">{teamBName}</th>
              <th rowSpan={2}>Stand</th>
            </tr>
            <tr><th>im Loch</th><th>auf Brett</th><th>Pkt.</th><th>im Loch</th><th>auf Brett</th><th>Pkt.</th></tr>
          </thead>
          <tbody>
            {kehren.map((k, i) => {
              const r = rows[i];
              return (
                <tr key={i} className={i >= KEHREN_PER_MATCH ? 'extra' : ''} style={r.invalid ? { background: 'var(--danger-soft)' } : undefined}>
                  <td>{i + 1}{i >= KEHREN_PER_MATCH && <span className="muted"> (V)</span>}</td>
                  {(['teamA', 'teamB'] as const).map(team => (
                    <BagCells key={team} disabled={!editable}
                      inHole={k[team].inHole} onBoard={k[team].onBoard}
                      onChange={(field, v) => update(i, team, field, v)}
                      points={team === 'teamA' ? r.s.a : r.s.b} raw={team === 'teamA' ? r.rawA : r.rawB} />
                  ))}
                  <td><strong>{r.totalA} : {r.totalB}</strong></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="result-preview">
        Endstand {totalA} : {totalB} –{' '}
        {winner ? <>Sieger: <span style={{ color: 'var(--accent)' }}>{winner}</span></>
          : needsExtra ? <span style={{ color: '#9b1d61' }}>Gleichstand → Verlängerung (weitere Kehre)</span>
          : 'Unentschieden'}
      </p>

      {editable && (
        <div className="row">
          {suddenDeath && (needsExtra || kehren.length > KEHREN_PER_MATCH) && (
            <>
              <button type="button" className="secondary" disabled={!needsExtra}
                onClick={() => setKehren(ks => [...ks, emptyKehre()])}>+ Verlängerungs-Kehre</button>
              {kehren.length > KEHREN_PER_MATCH && (
                <button type="button" className="secondary" onClick={() => setKehren(ks => ks.slice(0, -1))}>Letzte Kehre entfernen</button>
              )}
            </>
          )}
          <button type="button" onClick={save} disabled={busy || rows.some(r => r.invalid)}>
            {busy ? 'Speichert…' : needsExtra ? 'Zwischenstand speichern (Verlängerung)' : 'Ergebnis speichern'}
          </button>
          {hasResult && <button type="button" className="danger" onClick={reset}>Ergebnis löschen</button>}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <p className="muted">Pro Team und Kehre max. 4 Säckchen. Loch = 3 Pkt., Brett = 1 Pkt., Cancellation Scoring: nur die Differenz zählt.
        4 Säckchen im Loch werden automatisch als 4-Bagger (Freigetränk) erfasst.</p>
    </div>
  );
}

function BagCells({ inHole, onBoard, onChange, points, raw, disabled }: {
  inHole: number; onBoard: number; points: number; raw: number; disabled: boolean;
  onChange: (field: 'inHole' | 'onBoard', v: string) => void;
}) {
  return (
    <>
      <td><input type="number" min={0} max={4} inputMode="numeric" value={inHole} disabled={disabled}
        onFocus={e => e.target.select()} onChange={e => onChange('inHole', e.target.value)} /></td>
      <td><input type="number" min={0} max={4} inputMode="numeric" value={onBoard} disabled={disabled}
        onFocus={e => e.target.select()} onChange={e => onChange('onBoard', e.target.value)} /></td>
      <td className={points > 0 ? 'win' : 'muted'} title={`Rohpunkte ${raw}`}>{points}{inHole === 4 && ' 🍺'}</td>
    </>
  );
}
