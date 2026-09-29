import Link from 'next/link';
import { KO_ROUND_LABELS, KO_ROUNDS, isSetRound } from '@/lib/bracket';
import { db } from '@/lib/db';
import { getKoSets, getPhase, listKoMatches } from '@/lib/tournament';
import { ActionButton } from '../components/ActionButton';
import { StatusBadge } from '../components/StatusBadge';
import LaneSelect from './LaneSelect';

export default function KoPage() {
  const phase = getPhase();
  const matches = listKoMatches();

  if (matches.length === 0) {
    const { total, open } = db().prepare(
      `SELECT COUNT(*) AS total, SUM(status <> 'finished') AS open FROM group_matches`
    ).get() as { total: number; open: number | null };
    const ready = phase === 'group_stage_active' && total > 0 && !open;
    return (
      <div className="stack">
        <h1>KO-Runde</h1>
        {phase !== 'group_stage_active'
          ? <p className="notice">Die KO-Runde kann erst nach der Gruppenphase erzeugt werden.</p>
          : !ready && <p className="notice">Es sind noch {open} Gruppenspiele offen.</p>}
        <p className="muted">Die Top 4 jeder Gruppe ziehen ins 16tel-Finale ein. Gruppensieger treffen auf Gruppenvierte, Zweite auf Dritte;
          Teams derselben Gruppe können sich frühestens im Viertelfinale wieder begegnen.</p>
        <ActionButton url="/api/admin/ko" disabled={!ready}
          confirmText="Gruppenphase abschließen und KO-Runde auslosen? Gruppenergebnisse sind danach nicht mehr änderbar.">
          KO-Runde erzeugen
        </ActionButton>
      </div>
    );
  }

  const champion = matches.find(m => m.round === 'finale' && m.status === 'finished');
  const championName = champion && (champion.winner_team_id === champion.team_a_id ? champion.team_a_name : champion.team_b_name);

  return (
    <div className="stack">
      <h1>KO-Runde</h1>
      {championName && <p className="success" style={{ fontSize: '1.3rem' }}>🏆 Turniersieger: <strong>{championName}</strong></p>}
      <p className="muted">16tel/8tel: 8 Kehren, bei Gleichstand Verlängerung. Ab Viertelfinale: Sätze bis 21, Best of 3, Erfassung durch Schiedsrichter.</p>
      {KO_ROUNDS.map(round => {
        const roundMatches = matches.filter(m => m.round === round);
        return (
          <section key={round}>
            <h2>{KO_ROUND_LABELS[round]}</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Nr.</th><th>Bahn</th><th>Team A</th><th className="num">Ergebnis</th><th>Team B</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {roundMatches.map(m => {
                    const result = m.status === 'waiting' ? '–'
                      : isSetRound(round)
                        ? (getKoSets(m.id).map(s => `${s.team_a_score}:${s.team_b_score}`).join(', ') || '–')
                        : (m.status === 'scheduled' ? '–' : `${m.team_a_points} : ${m.team_b_points}`);
                    const bye = m.status === 'finished' && (!m.team_a_id || !m.team_b_id);
                    return (
                      <tr key={m.id}>
                        <td>{m.position + 1}</td>
                        <td><LaneSelect matchId={m.id} lane={m.lane} disabled={m.status === 'finished'} /></td>
                        <td style={m.winner_team_id && m.winner_team_id === m.team_a_id ? { fontWeight: 700 } : undefined}>{m.team_a_name ?? <span className="muted">{bye ? 'Freilos' : 'offen'}</span>}</td>
                        <td className="num">{result}</td>
                        <td style={m.winner_team_id && m.winner_team_id === m.team_b_id ? { fontWeight: 700 } : undefined}>{m.team_b_name ?? <span className="muted">{bye ? 'Freilos' : 'offen'}</span>}</td>
                        <td><StatusBadge status={m.status} /></td>
                        <td>{m.team_a_id && m.team_b_id && (
                          <Link href={`/admin/ko/${m.id}`}>{m.status === 'finished' ? 'Ansehen/Korrigieren' : 'Erfassen'}</Link>
                        )}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
