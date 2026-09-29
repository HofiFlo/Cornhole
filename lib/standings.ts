export type StandingsRow = {
  teamId: number; teamName: string; played: number; totalMatches: number;
  tablePoints: number; pointsFor: number; pointsAgainst: number; diff: number;
};

export type FinishedGroupMatch = {
  teamAId: number; teamAName: string;
  teamBId: number | null; teamBName: string | null;
  teamAPoints: number; teamBPoints: number;
  isBye: boolean;
};

export type GroupStandings = { name: string; standings: StandingsRow[] };

/**
 * Tabelle einer Gruppe. Sieg = 2 Pkt., Unentschieden = 1 Pkt., Freilos = automatischer Sieg (2 Pkt.).
 * Sortierung: Tabellenpunkte, Differenz, erzielte Punkte.
 * `teams` sorgt dafür, dass auch Teams ohne gespieltes Spiel in der Tabelle stehen.
 */
export function buildGroupStandings(
  matches: FinishedGroupMatch[],
  groupSize: number,
  teams: { id: number; name: string }[] = []
): StandingsRow[] {
  const rows = new Map<number, StandingsRow>();
  const ensure = (teamId: number, teamName: string) => {
    let row = rows.get(teamId);
    if (!row) {
      row = { teamId, teamName, played: 0, totalMatches: groupSize - 1,
              tablePoints: 0, pointsFor: 0, pointsAgainst: 0, diff: 0 };
      rows.set(teamId, row);
    }
    return row;
  };

  for (const t of teams) ensure(t.id, t.name);

  for (const m of matches) {
    const a = ensure(m.teamAId, m.teamAName);
    a.played++;
    if (m.isBye || m.teamBId === null) { a.tablePoints += 2; continue; }

    const b = ensure(m.teamBId, m.teamBName ?? '');
    b.played++;
    a.pointsFor += m.teamAPoints; a.pointsAgainst += m.teamBPoints;
    b.pointsFor += m.teamBPoints; b.pointsAgainst += m.teamAPoints;

    if (m.teamAPoints > m.teamBPoints) a.tablePoints += 2;
    else if (m.teamAPoints < m.teamBPoints) b.tablePoints += 2;
    else { a.tablePoints += 1; b.tablePoints += 1; }
  }

  for (const r of rows.values()) r.diff = r.pointsFor - r.pointsAgainst;

  return [...rows.values()].sort((x, y) =>
    y.tablePoints - x.tablePoints || y.diff - x.diff || y.pointsFor - x.pointsFor ||
    x.teamName.localeCompare(y.teamName, 'de')
  );
}
