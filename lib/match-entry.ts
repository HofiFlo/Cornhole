// Ergebnis-Auswertung für die Eingabemaske der Turnierleitung (rein, ohne DB)
import { KEHREN_PER_MATCH, rawPointsFromBags, scoreKehre, validateBags } from './scoring';
import type { KehreEntry, SetEntry } from './types';

export type KehrenResult = {
  kehren: { kehreNumber: number; teamARaw: number; teamBRaw: number; entry: KehreEntry }[];
  a: number;
  b: number;
  status: 'finished' | 'sudden_death';
  winner: 'A' | 'B' | null;
};

/**
 * Wertet einen vollständigen Turnierzettel aus.
 * - Gruppenphase: genau 8 Kehren, Unentschieden möglich.
 * - 16tel/8tel (`suddenDeath`): nach 8 Kehren bei Gleichstand Verlängerung – weitere Kehren,
 *   bis ein Team vorne liegt. Kehren nach der Entscheidung sind nicht erlaubt.
 */
export function evaluateKehren(entries: KehreEntry[], suddenDeath: boolean): KehrenResult {
  if (entries.length < KEHREN_PER_MATCH) throw new Error(`Es müssen ${KEHREN_PER_MATCH} Kehren erfasst werden`);
  if (!suddenDeath && entries.length > KEHREN_PER_MATCH) {
    throw new Error(`In der Gruppenphase werden genau ${KEHREN_PER_MATCH} Kehren gespielt`);
  }

  let a = 0, b = 0;
  const kehren = entries.map((entry, i) => {
    const n = i + 1;
    validateBags(entry.teamA, `Kehre ${n}, Team A`);
    validateBags(entry.teamB, `Kehre ${n}, Team B`);
    if (n > KEHREN_PER_MATCH && a !== b) {
      throw new Error(`Kehre ${n} ist überzählig – das Spiel war nach Kehre ${n - 1} bereits entschieden`);
    }
    const teamARaw = rawPointsFromBags(entry.teamA);
    const teamBRaw = rawPointsFromBags(entry.teamB);
    const s = scoreKehre(teamARaw, teamBRaw);
    a += s.a; b += s.b;
    return { kehreNumber: n, teamARaw, teamBRaw, entry };
  });

  if (a !== b) return { kehren, a, b, status: 'finished', winner: a > b ? 'A' : 'B' };
  if (suddenDeath) return { kehren, a, b, status: 'sudden_death', winner: null };
  return { kehren, a, b, status: 'finished', winner: null };
}

export type SetsResult = { winsA: number; winsB: number; finished: boolean; winner: 'A' | 'B' | null };

/** Ab dem Viertelfinale: Sätze bis 21, Best of 3, Erfassung nur mit Schiedsrichter-Zettel. */
export function evaluateSets(sets: SetEntry[], enteredByReferee: boolean): SetsResult {
  if (!enteredByReferee) throw new Error('Ab dem Viertelfinale nur durch Schiedsrichter erfassbar');
  if (sets.length === 0) throw new Error('Mindestens ein Satz muss erfasst werden');
  if (sets.length > 3) throw new Error('Maximal 3 Sätze (Best of 3)');

  let winsA = 0, winsB = 0;
  sets.forEach((set, i) => {
    const n = i + 1;
    if (![set.teamAScore, set.teamBScore].every(x => Number.isInteger(x) && x >= 0)) {
      throw new Error(`Satz ${n}: ungültiger Punktestand`);
    }
    if (winsA === 2 || winsB === 2) throw new Error(`Satz ${n} ist überzählig – das Spiel war bereits entschieden`);
    if (Math.max(set.teamAScore, set.teamBScore) < 21) throw new Error(`Satz ${n}: Ein Satz geht bis mindestens 21 Punkte`);
    if (set.teamAScore === set.teamBScore) throw new Error(`Satz ${n}: Kein Unentschieden in einem Satz möglich`);
    if (set.teamAScore > set.teamBScore) winsA++; else winsB++;
  });

  const finished = winsA === 2 || winsB === 2;
  return { winsA, winsB, finished, winner: finished ? (winsA === 2 ? 'A' : 'B') : null };
}

export type QueueMatch = { lane: number | null; status: string; teamAName: string; teamBName: string };

export function findOpenMatchByLane<T extends QueueMatch>(matches: T[], lane: number) {
  return matches.find(m => m.lane === lane && m.status !== 'finished');
}

export function findOpenMatchByTeamName<T extends QueueMatch>(matches: T[], query: string) {
  const q = query.toLowerCase();
  return matches.filter(m => m.status !== 'finished' &&
    (m.teamAName.toLowerCase().includes(q) || m.teamBName.toLowerCase().includes(q)));
}

export function openMatchesQueue<T extends QueueMatch>(matches: T[]) {
  return matches.filter(m => m.status === 'scheduled' || m.status === 'sudden_death')
    .sort((a, b) => (a.lane ?? 99) - (b.lane ?? 99));
}
