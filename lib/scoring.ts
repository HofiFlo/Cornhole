import type { BagCount } from './types';

export const BAGS_PER_TEAM = 4;
export const KEHREN_PER_MATCH = 8;

export function rawPointsFromBags(bags: BagCount): number {
  return bags.inHole * 3 + bags.onBoard * 1;
}

export function validateBags(bags: BagCount, label: string) {
  const { inHole, onBoard } = bags;
  if (![inHole, onBoard].every(n => Number.isInteger(n) && n >= 0)) {
    throw new Error(`${label}: ungültige Säckchen-Anzahl`);
  }
  if (inHole + onBoard > BAGS_PER_TEAM) {
    throw new Error(`${label}: maximal ${BAGS_PER_TEAM} Säckchen pro Team und Kehre`);
  }
}

export function scoreKehre(teamARaw: number, teamBRaw: number) {
  const diff = Math.abs(teamARaw - teamBRaw);
  if (teamARaw > teamBRaw) return { a: diff, b: 0 };
  if (teamBRaw > teamARaw) return { a: 0, b: diff };
  return { a: 0, b: 0 };
}

export function scoreMatch(kehren: { teamARaw: number; teamBRaw: number }[]) {
  return kehren.reduce(
    (acc, k) => {
      const { a, b } = scoreKehre(k.teamARaw, k.teamBRaw);
      return { a: acc.a + a, b: acc.b + b };
    },
    { a: 0, b: 0 }
  );
}
