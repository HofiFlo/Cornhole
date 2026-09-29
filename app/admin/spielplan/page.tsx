import Link from 'next/link';
import { startTimeForSlot } from '@/lib/schedule';
import { getPhase, getScheduleSettings, listGroupMatches } from '@/lib/tournament';
import MatchList, { type MatchListItem } from './MatchList';

export default function SpielplanPage() {
  const phase = getPhase();
  const matches = listGroupMatches();
  const { tournamentStart, durationMin } = getScheduleSettings();

  if (matches.length === 0) {
    return (
      <div className="stack">
        <h1>Spielplan</h1>
        <p className="notice">Noch kein Spielplan vorhanden. Zuerst unter <Link href="/admin/gruppen">Gruppen</Link> zuteilen und generieren.</p>
      </div>
    );
  }

  const items: MatchListItem[] = matches.map(m => ({
    id: m.id, group: m.group_id, round: m.round, lane: m.lane, globalSlot: m.global_slot,
    startTime: startTimeForSlot(m.global_slot, tournamentStart, durationMin)?.toISOString() ?? null,
    status: m.status, isBye: !!m.is_bye,
    teamAName: m.team_a_name, teamBName: m.team_b_name ?? 'Freilos',
    teamAPoints: m.team_a_points, teamBPoints: m.team_b_points,
  }));
  const open = items.filter(m => !m.isBye && m.status !== 'finished').length;

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>Spielplan Gruppenphase</h1>
        {phase === 'group_stage_active' && open === 0 && (
          <Link className="button" href="/admin/ko">Alle Gruppenspiele erfasst → KO-Runde erzeugen</Link>
        )}
      </div>
      <MatchList matches={items} editable={phase === 'group_stage_active'} />
    </div>
  );
}
