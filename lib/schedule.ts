export const GROUP_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export type GroupName = (typeof GROUP_NAMES)[number];

export const DEFAULT_LANE_ALLOCATION: Record<string, number[]> = {
  A: [1, 2], B: [3, 4], C: [5, 6], D: [7, 8],
  E: [9], F: [10], G: [11], H: [12],
};

export const TOTAL_LANES = 12;

type Slot = number | 'BYE';

export type ScheduledGroupMatch = {
  round: number;
  teamA: Slot;
  teamB: Slot;
  lane: number | null;
  globalSlot: number | null;
  status: 'scheduled' | 'finished';
  isBye: boolean;
  winnerTeamId?: number;
};

export function generateRoundRobin(slots: Slot[]) {
  const participants = [...slots];
  if (participants.length % 2 !== 0) participants.push('BYE');

  const n = participants.length;
  const half = n / 2;
  const fixed = participants[0];
  const rotating = participants.slice(1);
  const schedule: { round: number; teamA: Slot; teamB: Slot }[] = [];

  for (let round = 1; round <= n - 1; round++) {
    const current = [fixed, ...rotating];
    for (let i = 0; i < half; i++) {
      schedule.push({ round, teamA: current[i], teamB: current[n - 1 - i] });
    }
    rotating.unshift(rotating.pop()!);
  }
  return schedule;
}

export function buildGroupSchedule(realTeamIds: number[], targetSize: number, lanes: number[]): ScheduledGroupMatch[] {
  const slots: Slot[] = [...realTeamIds];
  while (slots.length < targetSize) slots.push('BYE');
  if (slots.length % 2 !== 0) slots.push('BYE');

  const raw = generateRoundRobin(slots)
    // Freilos gegen Freilos ist kein Spiel
    .filter(m => !(m.teamA === 'BYE' && m.teamB === 'BYE'));
  const matchesPerRound = slots.length / 2;
  const slotsPerRound = Math.ceil(matchesPerRound / lanes.length);

  const resolved: ScheduledGroupMatch[] = raw.map(m => {
    if (m.teamA === 'BYE' || m.teamB === 'BYE') {
      const winner = (m.teamA === 'BYE' ? m.teamB : m.teamA) as number;
      // Das echte Team steht immer auf Position A
      return { round: m.round, teamA: winner, teamB: 'BYE', lane: null, globalSlot: null,
               status: 'finished', isBye: true, winnerTeamId: winner };
    }
    return { ...m, lane: null, globalSlot: null, status: 'scheduled', isBye: false };
  });

  const byRound: Record<number, ScheduledGroupMatch[]> = {};
  for (const m of resolved) if (m.status === 'scheduled') (byRound[m.round] ??= []).push(m);

  for (const [round, roundMatches] of Object.entries(byRound)) {
    roundMatches.forEach((m, i) => {
      m.lane = lanes[i % lanes.length];
      m.globalSlot = (Number(round) - 1) * slotsPerRound + Math.floor(i / lanes.length);
    });
  }
  return resolved;
}

/** Gruppengröße: gleich groß für alle Gruppen, fehlende Plätze werden mit Freilosen aufgefüllt. */
export function targetGroupSize(teamsByGroup: Record<string, number[]>) {
  const totalReal = Object.values(teamsByGroup).flat().length;
  const largest = Math.max(0, ...Object.values(teamsByGroup).map(ids => ids.length));
  return Math.max(Math.ceil(totalReal / GROUP_NAMES.length), largest);
}

export function buildFullGroupPhaseSchedule(teamsByGroup: Record<string, number[]>) {
  const targetSize = targetGroupSize(teamsByGroup);

  return Object.fromEntries(
    Object.entries(teamsByGroup)
      .filter(([, teamIds]) => teamIds.length > 0)
      .map(([group, teamIds]) => [
        group,
        buildGroupSchedule(teamIds, targetSize, DEFAULT_LANE_ALLOCATION[group]),
      ])
  );
}

export function startTimeForSlot(globalSlot: number | null, tournamentStart: Date | null, durationMin = 20): Date | null {
  if (globalSlot === null || !tournamentStart) return null;
  return new Date(tournamentStart.getTime() + globalSlot * durationMin * 60000);
}

export function withStartTimes<T extends { globalSlot: number | null }>(
  matches: T[], tournamentStart: Date, durationMin = 20
) {
  return matches.map(m => ({ ...m, startTime: startTimeForSlot(m.globalSlot, tournamentStart, durationMin) }));
}
