import { describe, expect, it } from 'vitest';
import { buildKoPlan, buildStandardSeedOrder, seedBracket, type Qualifier } from '@/lib/bracket';
import { autoAssignGroups, emptyAssignment, groupConflicts } from '@/lib/group-assignment';
import { evaluateKehren, evaluateSets } from '@/lib/match-entry';
import { buildFullGroupPhaseSchedule, buildGroupSchedule, GROUP_NAMES } from '@/lib/schedule';
import { rawPointsFromBags, scoreMatch } from '@/lib/scoring';
import { buildGroupStandings } from '@/lib/standings';
import { fillPlaceholders, renderMail } from '@/lib/mail-templates';
import type { KehreEntry } from '@/lib/types';
import { isOverdue } from '@/lib/util';

const k = (aHole: number, aBoard: number, bHole: number, bBoard: number): KehreEntry =>
  ({ teamA: { inHole: aHole, onBoard: aBoard }, teamB: { inHole: bHole, onBoard: bBoard } });

describe('scoring', () => {
  it('berechnet Rohpunkte und Cancellation Scoring', () => {
    expect(rawPointsFromBags({ inHole: 2, onBoard: 1 })).toBe(7);
    expect(scoreMatch([{ teamARaw: 7, teamBRaw: 4 }, { teamARaw: 3, teamBRaw: 9 }, { teamARaw: 5, teamBRaw: 5 }]))
      .toEqual({ a: 3, b: 6 });
  });
});

describe('evaluateKehren', () => {
  const eight = (e: KehreEntry) => Array.from({ length: 8 }, () => e);

  it('Gruppenphase: Unentschieden möglich', () => {
    expect(evaluateKehren(eight(k(1, 1, 1, 1)), false)).toMatchObject({ a: 0, b: 0, status: 'finished', winner: null });
  });
  it('KO: Gleichstand führt zu Verlängerung, danach Entscheidung', () => {
    expect(evaluateKehren(eight(k(1, 0, 1, 0)), true).status).toBe('sudden_death');
    const decided = evaluateKehren([...eight(k(1, 0, 1, 0)), k(1, 0, 0, 0)], true);
    expect(decided).toMatchObject({ status: 'finished', winner: 'A', a: 3, b: 0 });
  });
  it('lehnt überzählige Kehren und zu viele Säckchen ab', () => {
    expect(() => evaluateKehren([...eight(k(1, 0, 0, 0)), k(0, 0, 0, 0)], true)).toThrow(/überzählig/);
    expect(() => evaluateKehren(eight(k(3, 2, 0, 0)), false)).toThrow(/maximal 4/);
    expect(() => evaluateKehren(eight(k(1, 0, 0, 0)).slice(0, 7), false)).toThrow();
  });
});

describe('evaluateSets', () => {
  it('Best of 3 bis 21', () => {
    expect(evaluateSets([{ teamAScore: 21, teamBScore: 15 }, { teamAScore: 18, teamBScore: 21 }, { teamAScore: 21, teamBScore: 3 }], true))
      .toMatchObject({ finished: true, winner: 'A' });
    expect(() => evaluateSets([{ teamAScore: 20, teamBScore: 15 }], true)).toThrow(/21/);
    expect(() => evaluateSets([{ teamAScore: 21, teamBScore: 15 }], false)).toThrow(/Schiedsrichter/);
  });
});

describe('schedule', () => {
  it('jede Paarung genau einmal, Bahnen der Gruppe', () => {
    const ids = [1, 2, 3, 4, 5, 6, 7, 8];
    const matches = buildGroupSchedule(ids, 8, [1, 2]);
    expect(matches).toHaveLength(28);
    const pairs = new Set(matches.map(m => [m.teamA, m.teamB].sort().join('-')));
    expect(pairs.size).toBe(28);
    expect(new Set(matches.map(m => m.lane))).toEqual(new Set([1, 2]));
    // in keinem Slot spielt ein Team zweimal
    const bySlot = new Map<number, number[]>();
    for (const m of matches) bySlot.set(m.globalSlot!, [...(bySlot.get(m.globalSlot!) ?? []), m.teamA as number, m.teamB as number]);
    for (const teams of bySlot.values()) expect(new Set(teams).size).toBe(teams.length);
  });

  it('füllt fehlende Teams mit Freilosen auf', () => {
    const teamsByGroup = Object.fromEntries(GROUP_NAMES.map((g, i) =>
      [g, Array.from({ length: i < 4 ? 8 : 7 }, (_, j) => i * 10 + j + 1)]));
    const schedule = buildFullGroupPhaseSchedule(teamsByGroup);
    const e = schedule.E;
    expect(e.filter(m => m.isBye)).toHaveLength(7);
    expect(e.filter(m => m.isBye).every(m => m.status === 'finished' && m.winnerTeamId === m.teamA)).toBe(true);
  });
});

describe('standings', () => {
  it('sortiert nach Punkten, Differenz, erzielten Punkten; Freilos = Sieg', () => {
    const rows = buildGroupStandings([
      { teamAId: 1, teamAName: 'A', teamBId: 2, teamBName: 'B', teamAPoints: 10, teamBPoints: 4, isBye: false },
      { teamAId: 2, teamAName: 'B', teamBId: null, teamBName: null, teamAPoints: 0, teamBPoints: 0, isBye: true },
      { teamAId: 3, teamAName: 'C', teamBId: 1, teamBName: 'A', teamAPoints: 5, teamBPoints: 5, isBye: false },
    ], 4, [{ id: 4, name: 'D' }]);
    expect(rows.map(r => r.teamName)).toEqual(['A', 'B', 'C', 'D']);
    expect(rows[0]).toMatchObject({ tablePoints: 3, played: 2, diff: 6 });
    expect(rows[1]).toMatchObject({ tablePoints: 2, played: 2, diff: -6 });
    expect(rows[3]).toMatchObject({ played: 0, totalMatches: 3 });
  });
});

describe('bracket', () => {
  it('Standard-Setzliste', () => {
    expect(buildStandardSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it('Gruppensieger gegen Gruppenvierte, gleiche Gruppe nicht im selben 8tel-Viertel', () => {
    const qualifiers: Qualifier[] = GROUP_NAMES.flatMap((g, gi) =>
      ([1, 2, 3, 4] as const).map(rank => ({ teamId: gi * 10 + rank, groupId: g, groupRank: rank })));
    for (let run = 0; run < 20; run++) {
      const slots = seedBracket(qualifiers);
      expect(slots.every(Boolean)).toBe(true);
      for (let p = 0; p < 16; p++) {
        const ranks = [slots[2 * p]!.groupRank, slots[2 * p + 1]!.groupRank].sort();
        expect(ranks[0] + ranks[1]).toBe(5); // 1 vs 4, 2 vs 3
      }
      for (let block = 0; block < 8; block++) {
        const groups = slots.slice(block * 4, block * 4 + 4).map(s => s!.groupId);
        expect(new Set(groups).size).toBe(4);
      }
    }
  });

  it('KO-Plan mit 31 verknüpften Spielen', () => {
    const plan = buildKoPlan(new Array(32).fill(null));
    expect(plan).toHaveLength(31);
    expect(plan.filter(m => m.nextKey === null)).toHaveLength(1);
    expect(plan.find(m => m.key === '16tel-5')).toMatchObject({ nextKey: '8tel-2', nextSlot: 'teamB' });
  });
});

describe('group assignment', () => {
  it('verteilt Vereinsteams auf unterschiedliche Gruppen', () => {
    const teams = Array.from({ length: 64 }, (_, i) => ({ id: i + 1, club_name: i < 8 ? 'CC Test' : i < 12 ? 'SV Brett' : null }));
    const result = autoAssignGroups(teams, emptyAssignment(), teams);
    for (const g of GROUP_NAMES) {
      expect(result[g]).toHaveLength(8);
      expect(groupConflicts(result[g], teams).size).toBe(0);
    }
  });
});

describe('mails', () => {
  const team = { team_name: 'Die Werfer', player1_name: 'Max', payment_reference: 'CH2026-0007', payment_due_date: '2026-10-13' };

  it('ersetzt Platzhalter in freien Mails', () => {
    const text = fillPlaceholders('Hallo {spieler1}, Team {team}: {referenz} bis {frist}, {iban} {betrag}', team,
      { iban: 'AT11', entryFee: '30 €' });
    expect(text).toBe('Hallo Max, Team Die Werfer: CH2026-0007 bis 13.10.2026, AT11 30 €');
  });

  it('Zahlungserinnerung enthält Referenz und Frist, Bestätigungsmail den Link', () => {
    const reminder = renderMail(team, 'payment_reminder');
    expect(reminder.text).toContain('CH2026-0007');
    expect(reminder.text).toContain('13.10.2026');
    expect(renderMail(team, 'verify_email', { verifyUrl: 'https://x/anmeldung/bestaetigen?token=abc' }).text)
      .toContain('https://x/anmeldung/bestaetigen?token=abc');
  });

  it('überfällig nur bei offener Zahlung nach Fristende', () => {
    const now = new Date('2026-10-14T10:00:00Z');
    expect(isOverdue({ registration_status: 'pending', payment_due_date: '2026-10-13' }, now)).toBe(true);
    expect(isOverdue({ registration_status: 'pending', payment_due_date: '2026-10-14' }, now)).toBe(false);
    expect(isOverdue({ registration_status: 'confirmed', payment_due_date: '2026-10-01' }, now)).toBe(false);
  });
});
