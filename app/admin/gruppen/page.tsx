import { GROUP_NAMES } from '@/lib/schedule';
import { confirmedTeams, currentAssignment, getPhase } from '@/lib/tournament';
import GroupAssignmentAdmin from './GroupAssignmentAdmin';

export default function GruppenPage() {
  const phase = getPhase();
  const teams = confirmedTeams();

  if (phase === 'group_stage_active' || phase === 'ko_active' || phase === 'finished') {
    const assignment = currentAssignment();
    const byId = new Map(teams.map(t => [t.id, t]));
    return (
      <div className="stack">
        <h1>Gruppen (fixiert)</h1>
        <div className="group-grid">
          {GROUP_NAMES.map(g => (
            <div key={g} className="group-column">
              <h4>Gruppe {g} ({assignment[g]?.length ?? 0})</h4>
              <ul>
                {(assignment[g] ?? []).map(id => (
                  <li key={id}><span className="name">{byId.get(id)?.team_name}</span>
                    {byId.get(id)?.club_name && <span className="club-tag">{byId.get(id)?.club_name}</span>}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <h1>Gruppenzuteilung</h1>
      {phase === 'registration' && (
        <p className="notice">Die Anmeldung ist noch offen. Vor dem Fixieren der Gruppen sollte sie geschlossen werden (Übersicht).</p>
      )}
      <GroupAssignmentAdmin confirmedTeams={teams} />
    </div>
  );
}
