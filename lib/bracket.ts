// Interne KO-Logik (keine Anzeige, nur Turnierablauf)
import type { KoRound } from './types';
import { shuffle } from './util';

export const KO_ROUNDS: KoRound[] = ['16tel', '8tel', 'viertel', 'halbfinale', 'finale'];
export const KO_ROUND_LABELS: Record<KoRound, string> = {
  '16tel': '16tel-Finale', '8tel': '8tel-Finale', viertel: 'Viertelfinale',
  halbfinale: 'Halbfinale', finale: 'Finale',
};
/** 16tel/8tel: 8 Kehren + Verlängerung; ab Viertelfinale: Sätze bis 21, Best of 3 */
export const KEHREN_ROUNDS: KoRound[] = ['16tel', '8tel'];
export const isSetRound = (round: KoRound) => !KEHREN_ROUNDS.includes(round);

export function buildStandardSeedOrder(size: number): number[] {
  let seeds = [1, 2];
  while (seeds.length < size) {
    const n = seeds.length * 2 + 1;
    const next: number[] = [];
    for (const s of seeds) next.push(s, n - s);
    seeds = next;
  }
  return seeds;
}

export type Qualifier = { teamId: number; groupId: string; groupRank: 1 | 2 | 3 | 4 };

const BRACKET_SIZE = 32;
/** Vier Bracket-Positionen (= zwei 16tel-Spiele) führen in dasselbe 8tel-Finale. */
const eighth = (slotIdx: number) => Math.floor(slotIdx / 4);

/**
 * Setzt die 32 Qualifikanten ins Bracket:
 * - Gruppensieger = Setzplätze 1–8, Zweite = 9–16, Dritte = 17–24, Vierte = 25–32
 *   (Standard-Setzliste: 1 vs 32, 2 vs 31, …) – innerhalb eines Topfs zufällig.
 * - Teams derselben Gruppe landen in unterschiedlichen 8tel-Finale-Vierteln,
 *   können sich also frühestens im Viertelfinale wieder treffen.
 * Fehlende Qualifikanten (zu kleine Gruppen) bleiben `null` = Freilos.
 */
export function seedBracket(qualifiers: Qualifier[]): (Qualifier | null)[] {
  const order = buildStandardSeedOrder(BRACKET_SIZE); // order[position] = Setzplatz
  const positionOfSeed = new Map(order.map((seed, pos) => [seed, pos]));

  const pots = [1, 2, 3, 4].map(rank => shuffle(qualifiers.filter(q => q.groupRank === rank)));

  for (const strict of [true, false]) {
    const slots: (Qualifier | null)[] = new Array(BRACKET_SIZE).fill(null);
    const conflicts = (team: Qualifier, pos: number) =>
      strict
        ? slots.some((s, j) => s && s.groupId === team.groupId && eighth(j) === eighth(pos))
        : slots[pos ^ 1]?.groupId === team.groupId; // gelockert: nur nicht direkt im 16tel

    const queue = pots.flatMap((pot, potIdx) => pot.map(team => ({ team, potIdx })));
    let steps = 0;

    const place = (i: number): boolean => {
      if (i === queue.length) return true;
      if (++steps > 200_000) return false;
      const { team, potIdx } = queue[i];
      const seeds = shuffle(Array.from({ length: 8 }, (_, k) => potIdx * 8 + k + 1));
      for (const seed of seeds) {
        const pos = positionOfSeed.get(seed)!;
        if (slots[pos] !== null || conflicts(team, pos)) continue;
        slots[pos] = team;
        if (place(i + 1)) return true;
        slots[pos] = null;
      }
      return false;
    };

    if (place(0)) return slots;
  }
  throw new Error('Bracket konnte nicht gesetzt werden');
}

export type KoMatchPlan = {
  key: string;             // z. B. "16tel-3"
  round: KoRound;
  position: number;
  teamAId: number | null;
  teamBId: number | null;
  nextKey: string | null;
  nextSlot: 'teamA' | 'teamB' | null;
};

/** Erzeugt alle 31 KO-Spiele inkl. Verknüpfung, 16tel mit den gesetzten Teams befüllt. */
export function buildKoPlan(slots: (Qualifier | null)[]): KoMatchPlan[] {
  const plan: KoMatchPlan[] = [];
  let count = BRACKET_SIZE / 2;
  KO_ROUNDS.forEach((round, r) => {
    for (let p = 0; p < count; p++) {
      const isLast = r === KO_ROUNDS.length - 1;
      plan.push({
        key: `${round}-${p}`, round, position: p,
        teamAId: r === 0 ? slots[2 * p]?.teamId ?? null : null,
        teamBId: r === 0 ? slots[2 * p + 1]?.teamId ?? null : null,
        nextKey: isLast ? null : `${KO_ROUNDS[r + 1]}-${Math.floor(p / 2)}`,
        nextSlot: isLast ? null : p % 2 === 0 ? 'teamA' : 'teamB',
      });
    }
    count /= 2;
  });
  return plan;
}
