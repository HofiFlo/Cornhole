// Gruppenzuteilung – reine Funktionen (werden auch im Browser verwendet)
import { GROUP_NAMES } from './schedule';
import type { GroupAssignment } from './types';
import { shuffle } from './util';

type TeamLike = { id: number; club_name: string | null };

export const normalizeClub = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');
const clubKey = (t: TeamLike | undefined) => (t?.club_name ? normalizeClub(t.club_name) : null);

export function emptyAssignment(): GroupAssignment {
  return Object.fromEntries(GROUP_NAMES.map(g => [g, [] as number[]]));
}

/**
 * Verteilt die noch nicht zugeteilten Teams zufällig auf die Gruppen:
 * immer in die kleinste Gruppe, in der der eigene Verein noch nicht vertreten ist.
 * Gruppengröße ist auf ceil(Anzahl Teams / 8) begrenzt, damit die Gruppen gleich groß bleiben.
 */
export function autoAssignGroups(unassignedTeams: TeamLike[], existing: GroupAssignment, allTeams: TeamLike[]): GroupAssignment {
  const result: GroupAssignment = Object.fromEntries(GROUP_NAMES.map(g => [g, [...(existing[g] ?? [])]]));
  const byId = new Map(allTeams.map(t => [t.id, t]));
  const clubsPerGroup: Record<string, Set<string>> = Object.fromEntries(
    GROUP_NAMES.map(g => [g, new Set(result[g].map(id => clubKey(byId.get(id))).filter((c): c is string => !!c))])
  );
  const totalTeams = Object.values(result).flat().length + unassignedTeams.length;
  const capacity = Math.max(1, Math.ceil(totalTeams / GROUP_NAMES.length));

  // Teams großer Vereine zuerst, damit sie noch freie Gruppen finden
  const clubCount = new Map<string, number>();
  for (const t of unassignedTeams) { const c = clubKey(t); if (c) clubCount.set(c, (clubCount.get(c) ?? 0) + 1); }
  const ordered = shuffle(unassignedTeams).sort((x, y) =>
    (clubCount.get(clubKey(y) ?? '') ?? 0) - (clubCount.get(clubKey(x) ?? '') ?? 0));

  for (const team of ordered) {
    const club = clubKey(team);
    const bySize = shuffle([...GROUP_NAMES]).sort((a, b) => result[a].length - result[b].length);
    const target =
      bySize.find(g => result[g].length < capacity && (!club || !clubsPerGroup[g].has(club))) ??
      bySize[0];
    result[target].push(team.id);
    if (club) clubsPerGroup[target].add(club);
  }
  return result;
}

export function moveTeamToGroup(assignment: GroupAssignment, teamId: number, targetGroup: string | null): GroupAssignment {
  const updated: GroupAssignment = {};
  for (const [group, teamIds] of Object.entries(assignment)) updated[group] = teamIds.filter(id => id !== teamId);
  if (targetGroup) updated[targetGroup] = [...(updated[targetGroup] ?? []), teamId];
  return updated;
}

/** Teams, deren Verein mehrfach in derselben Gruppe vertreten ist. */
export function groupConflicts(teamIds: number[], teams: TeamLike[]): Set<number> {
  const byId = new Map(teams.map(t => [t.id, t]));
  const counts = new Map<string, number>();
  for (const id of teamIds) {
    const club = clubKey(byId.get(id));
    if (club) counts.set(club, (counts.get(club) ?? 0) + 1);
  }
  const conflicted = new Set<number>();
  for (const id of teamIds) {
    const club = clubKey(byId.get(id));
    if (club && (counts.get(club) ?? 0) > 1) conflicted.add(id);
  }
  return conflicted;
}
