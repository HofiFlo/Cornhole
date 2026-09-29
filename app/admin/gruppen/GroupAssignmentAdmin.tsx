'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { autoAssignGroups, emptyAssignment, groupConflicts, moveTeamToGroup } from '@/lib/group-assignment';
import { GROUP_NAMES } from '@/lib/schedule';
import type { GroupAssignment, Team } from '@/lib/types';

const DRAFT_KEY = 'cornhole-group-draft';

export default function GroupAssignmentAdmin({ confirmedTeams }: { confirmedTeams: Team[] }) {
  const [assignment, setAssignment] = useState<GroupAssignment>(emptyAssignment);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Entwurf im Browser merken, damit ein versehentliches Neuladen nichts verliert
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const valid = new Set(confirmedTeams.map(t => t.id));
      const draft = JSON.parse(raw) as GroupAssignment;
      setAssignment(Object.fromEntries(GROUP_NAMES.map(g => [g, (draft[g] ?? []).filter(id => valid.has(id))])));
    } catch { /* ignorieren */ }
  }, [confirmedTeams]);
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(assignment)); } catch { /* ignorieren */ }
  }, [assignment]);

  const byId = new Map(confirmedTeams.map(t => [t.id, t]));
  const assignedIds = new Set(Object.values(assignment).flat());
  const unassigned = confirmedTeams.filter(t => !assignedIds.has(t.id));

  const handleAutoAssign = () => setAssignment(prev => autoAssignGroups(unassigned, prev, confirmedTeams));
  const handleMove = (teamId: number, group: string | null) => setAssignment(prev => moveTeamToGroup(prev, teamId, group));
  const handleReset = () => { if (confirm('Alle Zuteilungen verwerfen?')) setAssignment(emptyAssignment()); };

  async function handleGenerate() {
    if (!confirm('Gruppen fixieren und Spielplan generieren? Danach keine Änderung mehr möglich.')) return;
    setBusy(true); setError(null);
    try {
      await api('/api/admin/groups', 'POST', { assignment });
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignorieren */ }
      location.href = '/admin/spielplan';
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const sizes = GROUP_NAMES.map(g => assignment[g].length);
  const uneven = Math.max(...sizes) - Math.min(...sizes) > 1;

  return (
    <div className="stack">
      <div className="group-assignment">
        <div className="unassigned-pool card">
          <h3>Unzugeteilt ({unassigned.length})</h3>
          <ul>
            {unassigned.map(t => (
              <li key={t.id}>
                <span>{t.team_name}{t.club_name && <span className="club-tag">{t.club_name}</span>}</span>
                <select onChange={e => handleMove(t.id, e.target.value)} value="">
                  <option value="" disabled>→ Gruppe</option>
                  {GROUP_NAMES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </li>
            ))}
          </ul>
          <div className="row">
            <button onClick={handleAutoAssign} disabled={unassigned.length === 0}>Rest zufällig verteilen</button>
            <button className="secondary" onClick={handleReset}>Zurücksetzen</button>
          </div>
        </div>
        <div className="group-grid">
          {GROUP_NAMES.map(g => {
            const conflicts = groupConflicts(assignment[g], confirmedTeams);
            return (
              <div key={g} className="group-column">
                <h4>Gruppe {g} ({assignment[g].length})</h4>
                <ul>
                  {assignment[g].map(teamId => {
                    const team = byId.get(teamId);
                    if (!team) return null;
                    return (
                      <li key={teamId} className={conflicts.has(teamId) ? 'club-conflict' : ''}>
                        <span className="name">{team.team_name}
                          {team.club_name && <span className="club-tag">{team.club_name}</span>}</span>
                        <button className="small secondary" title="Zurück in den Pool" onClick={() => handleMove(teamId, null)}>×</button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
      {uneven && <p className="notice">Die Gruppen sind unterschiedlich groß – fehlende Plätze werden mit Freilosen aufgefüllt.</p>}
      {error && <p className="error">{error}</p>}
      <button className="generate-btn" disabled={unassigned.length > 0 || busy || confirmedTeams.length < 2} onClick={handleGenerate}>
        Gruppen fixieren &amp; Spielplan generieren
      </button>
    </div>
  );
}
