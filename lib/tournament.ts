// Turnierablauf am Turniertag (lokale App): Gruppen, Spielplan, Ergebnisse, KO-Runde, 4-Bagger
import 'server-only';
import { buildKoPlan, isSetRound, seedBracket, type Qualifier } from './bracket';
import { db, getSetting, setSetting } from './db';
import { evaluateKehren, evaluateSets } from './match-entry';
import { UserError } from './registration';
import { buildFullGroupPhaseSchedule, GROUP_NAMES, targetGroupSize, TOTAL_LANES } from './schedule';
import { buildGroupStandings, type GroupStandings } from './standings';
import type {
  GroupAssignment, GroupMatchRow, KehreEntry, KehreRow, KoMatchRow, KoSetRow, SetEntry, Team, TournamentPhase,
} from './types';

// ---------------------------------------------------------------- Phase & Einstellungen

export function getPhase(): TournamentPhase {
  return (getSetting('tournament_phase') as TournamentPhase | null) ?? 'registration';
}
export const setPhase = (phase: TournamentPhase) => setSetting('tournament_phase', phase);

export function getScheduleSettings() {
  const start = getSetting('tournament_start');
  const parsed = start ? new Date(start) : null;
  return {
    tournamentStart: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null,
    tournamentStartRaw: start ?? '',
    durationMin: Number(getSetting('match_duration_min')) || 20,
  };
}

// ---------------------------------------------------------------- Gruppen & Spielplan

export function confirmedTeams(): Team[] {
  return db().prepare(`SELECT * FROM teams WHERE registration_status = 'confirmed' ORDER BY team_name COLLATE NOCASE`)
    .all() as Team[];
}

export function currentAssignment(): GroupAssignment {
  const result: GroupAssignment = Object.fromEntries(GROUP_NAMES.map(g => [g, [] as number[]]));
  const rows = db().prepare(`SELECT id, group_id FROM teams WHERE group_id IS NOT NULL ORDER BY team_name COLLATE NOCASE`)
    .all() as { id: number; group_id: string }[];
  for (const r of rows) (result[r.group_id] ??= []).push(r.id);
  return result;
}

export function generateSchedule(assignment: GroupAssignment) {
  const phase = getPhase();
  if (phase === 'group_stage_active' || phase === 'ko_active' || phase === 'finished') {
    throw new UserError('Der Spielplan wurde bereits generiert');
  }
  const confirmedIds = new Set(confirmedTeams().map(t => t.id));
  const seen = new Set<number>();
  for (const [group, ids] of Object.entries(assignment)) {
    if (!GROUP_NAMES.includes(group as never)) throw new UserError(`Unbekannte Gruppe ${group}`);
    for (const id of ids) {
      if (!confirmedIds.has(id)) throw new UserError(`Team ${id} ist nicht bestätigt`);
      if (seen.has(id)) throw new UserError(`Team ${id} ist mehrfach zugeteilt`);
      seen.add(id);
    }
  }
  if (seen.size !== confirmedIds.size) throw new UserError('Es sind noch nicht alle bestätigten Teams zugeteilt');
  if (seen.size < 2) throw new UserError('Zu wenige Teams für einen Spielplan');

  const schedule = buildFullGroupPhaseSchedule(assignment);
  const insert = db().prepare(
    `INSERT INTO group_matches (group_id, round, team_a_id, team_b_id, is_bye, lane, global_slot, status, winner_team_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  db().transaction(() => {
    db().exec(`DELETE FROM kehren WHERE match_type = 'group'; DELETE FROM group_matches; UPDATE teams SET group_id = NULL;`);
    const setGroup = db().prepare('UPDATE teams SET group_id = ? WHERE id = ?');
    for (const [group, teamIds] of Object.entries(assignment)) for (const id of teamIds) setGroup.run(group, id);

    for (const [group, matches] of Object.entries(schedule)) {
      for (const m of matches) {
        insert.run(group, m.round, m.teamA, m.isBye ? null : m.teamB, m.isBye ? 1 : 0,
                   m.lane, m.globalSlot, m.status, m.winnerTeamId ?? null);
      }
    }
    setSetting('registration_open', 'false');
    setPhase('group_stage_active');
  })();
}

export type GroupMatchView = GroupMatchRow & { team_a_name: string; team_b_name: string | null };

const GROUP_MATCH_SELECT = `
  SELECT m.*, ta.team_name AS team_a_name, tb.team_name AS team_b_name
  FROM group_matches m
  JOIN teams ta ON ta.id = m.team_a_id
  LEFT JOIN teams tb ON tb.id = m.team_b_id`;

export function listGroupMatches(): GroupMatchView[] {
  return db().prepare(`${GROUP_MATCH_SELECT} ORDER BY m.is_bye, m.global_slot, m.lane, m.group_id, m.round`)
    .all() as GroupMatchView[];
}

export function getGroupMatch(id: number): GroupMatchView {
  const m = db().prepare(`${GROUP_MATCH_SELECT} WHERE m.id = ?`).get(id) as GroupMatchView | undefined;
  if (!m) throw new UserError('Spiel nicht gefunden');
  return m;
}

export function getKehren(matchType: 'group' | 'ko', matchId: number): KehreRow[] {
  return db().prepare('SELECT * FROM kehren WHERE match_type = ? AND match_id = ? ORDER BY kehre_number')
    .all(matchType, matchId) as KehreRow[];
}

function storeKehren(matchType: 'group' | 'ko', matchId: number, teamAId: number, teamBId: number,
                     kehren: ReturnType<typeof evaluateKehren>['kehren']) {
  db().prepare('DELETE FROM kehren WHERE match_type = ? AND match_id = ?').run(matchType, matchId);
  db().prepare('DELETE FROM four_baggers WHERE match_type = ? AND match_id = ? AND auto = 1').run(matchType, matchId);
  const ins = db().prepare(
    `INSERT INTO kehren (match_type, match_id, kehre_number, team_a_raw, team_b_raw,
                         team_a_in_hole, team_a_on_board, team_b_in_hole, team_b_on_board)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const fourBagger = db().prepare(
    `INSERT INTO four_baggers (match_type, match_id, team_id, player_name, auto) VALUES (?, ?, ?, ?, 1)`
  );
  for (const k of kehren) {
    const { teamA, teamB } = k.entry;
    ins.run(matchType, matchId, k.kehreNumber, k.teamARaw, k.teamBRaw, teamA.inHole, teamA.onBoard, teamB.inHole, teamB.onBoard);
    // 4-Bagger = alle 4 Säckchen im Loch → Freigetränk
    if (teamA.inHole === 4) fourBagger.run(matchType, matchId, teamAId, `Kehre ${k.kehreNumber}`);
    if (teamB.inHole === 4) fourBagger.run(matchType, matchId, teamBId, `Kehre ${k.kehreNumber}`);
  }
}

function assertGroupStageEditable() {
  if (getPhase() !== 'group_stage_active') {
    throw new UserError('Gruppenergebnisse können nur während der Gruppenphase erfasst werden');
  }
}

export function saveGroupResult(matchId: number, entries: KehreEntry[]) {
  assertGroupStageEditable();
  const match = getGroupMatch(matchId);
  if (match.is_bye || match.team_b_id === null) throw new UserError('Freilos – kein Ergebnis nötig');
  const result = evaluateKehren(entries, false);
  db().transaction(() => {
    storeKehren('group', matchId, match.team_a_id, match.team_b_id!, result.kehren);
    db().prepare(
      `UPDATE group_matches SET status = 'finished', team_a_points = ?, team_b_points = ?, winner_team_id = ? WHERE id = ?`
    ).run(result.a, result.b,
          result.winner === 'A' ? match.team_a_id : result.winner === 'B' ? match.team_b_id : null, matchId);
  })();
  return result;
}

export function resetGroupResult(matchId: number) {
  assertGroupStageEditable();
  const match = getGroupMatch(matchId);
  if (match.is_bye) throw new UserError('Freilos kann nicht zurückgesetzt werden');
  db().transaction(() => {
    db().prepare(`DELETE FROM kehren WHERE match_type = 'group' AND match_id = ?`).run(matchId);
    db().prepare(`DELETE FROM four_baggers WHERE match_type = 'group' AND match_id = ? AND auto = 1`).run(matchId);
    db().prepare(
      `UPDATE group_matches SET status = 'scheduled', team_a_points = 0, team_b_points = 0, winner_team_id = NULL WHERE id = ?`
    ).run(matchId);
  })();
}

export function getAllStandings(): GroupStandings[] {
  const teams = db().prepare('SELECT id, team_name, group_id FROM teams WHERE group_id IS NOT NULL')
    .all() as { id: number; team_name: string; group_id: string }[];
  const byGroup: GroupAssignment = {};
  for (const t of teams) (byGroup[t.group_id] ??= []).push(t.id);
  const groupSize = targetGroupSize(byGroup);
  const finished = listGroupMatches().filter(m => m.status === 'finished');

  return GROUP_NAMES.filter(g => byGroup[g]?.length).map(g => ({
    name: g,
    standings: buildGroupStandings(
      finished.filter(m => m.group_id === g).map(m => ({
        teamAId: m.team_a_id, teamAName: m.team_a_name, teamBId: m.team_b_id, teamBName: m.team_b_name,
        teamAPoints: m.team_a_points, teamBPoints: m.team_b_points, isBye: !!m.is_bye,
      })),
      groupSize % 2 === 0 ? groupSize : groupSize + 1,
      teams.filter(t => t.group_id === g).map(t => ({ id: t.id, name: t.team_name })),
    ),
  }));
}

// ---------------------------------------------------------------- KO-Runde

export function generateKo() {
  if (getPhase() !== 'group_stage_active') throw new UserError('Die KO-Runde kann nur aus der laufenden Gruppenphase erzeugt werden');
  const { open } = db().prepare(`SELECT COUNT(*) AS open FROM group_matches WHERE status <> 'finished'`).get() as { open: number };
  if (open > 0) throw new UserError(`Es sind noch ${open} Gruppenspiele offen`);

  const qualifiers: Qualifier[] = getAllStandings().flatMap(g =>
    g.standings.slice(0, 4).map((row, i) => ({ teamId: row.teamId, groupId: g.name, groupRank: (i + 1) as 1 | 2 | 3 | 4 })));
  const plan = buildKoPlan(seedBracket(qualifiers));

  db().transaction(() => {
    db().exec(`DELETE FROM ko_sets; DELETE FROM kehren WHERE match_type = 'ko';
               DELETE FROM four_baggers WHERE match_type = 'ko'; DELETE FROM ko_matches;`);
    const ids = new Map<string, number>();
    const insert = db().prepare(
      `INSERT INTO ko_matches (round, position, team_a_id, team_b_id, lane, status, next_match_slot)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const m of plan) {
      const lane = (m.position % TOTAL_LANES) + 1;
      const status = m.teamAId && m.teamBId ? 'scheduled' : 'waiting';
      ids.set(m.key, Number(insert.run(m.round, m.position, m.teamAId, m.teamBId, lane, status, m.nextSlot).lastInsertRowid));
    }
    const link = db().prepare('UPDATE ko_matches SET next_match_id = ? WHERE id = ?');
    for (const m of plan) if (m.nextKey) link.run(ids.get(m.nextKey)!, ids.get(m.key)!);
    resolveKoByes();
    setPhase('ko_active');
  })();
}

export type KoMatchView = KoMatchRow & { team_a_name: string | null; team_b_name: string | null };

const KO_SELECT = `
  SELECT m.*, ta.team_name AS team_a_name, tb.team_name AS team_b_name
  FROM ko_matches m
  LEFT JOIN teams ta ON ta.id = m.team_a_id
  LEFT JOIN teams tb ON tb.id = m.team_b_id`;

const ROUND_ORDER = `CASE m.round WHEN '16tel' THEN 1 WHEN '8tel' THEN 2 WHEN 'viertel' THEN 3 WHEN 'halbfinale' THEN 4 ELSE 5 END`;

export function listKoMatches(): KoMatchView[] {
  return db().prepare(`${KO_SELECT} ORDER BY ${ROUND_ORDER}, m.position`).all() as KoMatchView[];
}

export function getKoMatch(id: number): KoMatchView {
  const m = db().prepare(`${KO_SELECT} WHERE m.id = ?`).get(id) as KoMatchView | undefined;
  if (!m) throw new UserError('KO-Spiel nicht gefunden');
  return m;
}

export function getKoSets(matchId: number): KoSetRow[] {
  return db().prepare('SELECT * FROM ko_sets WHERE match_id = ? ORDER BY set_number').all(matchId) as KoSetRow[];
}

function feeders(matchId: number): KoMatchRow[] {
  return db().prepare('SELECT * FROM ko_matches WHERE next_match_id = ?').all(matchId) as KoMatchRow[];
}

function hasResult(matchId: number) {
  const m = db().prepare('SELECT status FROM ko_matches WHERE id = ?').get(matchId) as { status: string };
  const k = db().prepare(`SELECT 1 FROM kehren WHERE match_type = 'ko' AND match_id = ? LIMIT 1`).get(matchId);
  const s = db().prepare('SELECT 1 FROM ko_sets WHERE match_id = ? LIMIT 1').get(matchId);
  return m.status === 'finished' || m.status === 'sudden_death' || !!k || !!s;
}

/** Schreibt den Sieger (oder null) in das Folgespiel und passt dessen Status an. */
function propagate(match: KoMatchRow, winnerId: number | null) {
  if (!match.next_match_id || !match.next_match_slot) return;
  const col = match.next_match_slot === 'teamA' ? 'team_a_id' : 'team_b_id';
  db().prepare(`UPDATE ko_matches SET ${col} = ? WHERE id = ?`).run(winnerId, match.next_match_id);
  const next = db().prepare('SELECT * FROM ko_matches WHERE id = ?').get(match.next_match_id) as KoMatchRow;
  if (next.status === 'waiting' || next.status === 'scheduled') {
    db().prepare('UPDATE ko_matches SET status = ? WHERE id = ?')
      .run(next.team_a_id && next.team_b_id ? 'scheduled' : 'waiting', next.id);
  }
}

/** Freilose in der KO-Runde (weniger als 32 Qualifikanten) automatisch weiterleiten. */
function resolveKoByes() {
  for (let changed = true; changed;) {
    changed = false;
    const waiting = db().prepare(`SELECT * FROM ko_matches WHERE status = 'waiting'`).all() as KoMatchRow[];
    for (const m of waiting) {
      const f = feeders(m.id);
      const feedersDone = f.length === 0 || f.every(x => x.status === 'finished');
      if (!feedersDone) continue;
      const winner = m.team_a_id ?? m.team_b_id ?? null;
      db().prepare(`UPDATE ko_matches SET status = 'finished', winner_team_id = ? WHERE id = ?`).run(winner, m.id);
      propagate(m, winner);
      changed = true;
    }
  }
}

function assertKoEditable(match: KoMatchView) {
  if (getPhase() !== 'ko_active' && getPhase() !== 'finished') throw new UserError('Die KO-Runde läuft nicht');
  if (!match.team_a_id || !match.team_b_id) throw new UserError('Die Gegner dieses Spiels stehen noch nicht fest');
  if (match.status === 'finished' && match.next_match_id && hasResult(match.next_match_id)) {
    throw new UserError('Das Folgespiel hat bereits ein Ergebnis – Korrektur nicht mehr möglich');
  }
}

function finishKoMatch(match: KoMatchView, status: KoMatchRow['status'], winner: 'A' | 'B' | null, a: number, b: number) {
  const winnerId = winner === 'A' ? match.team_a_id : winner === 'B' ? match.team_b_id : null;
  db().prepare('UPDATE ko_matches SET status = ?, winner_team_id = ?, team_a_points = ?, team_b_points = ? WHERE id = ?')
    .run(status, winnerId, a, b, match.id);
  propagate(match, winnerId);
  if (match.round === 'finale') setPhase(winnerId ? 'finished' : 'ko_active');
}

export function saveKoKehren(matchId: number, entries: KehreEntry[]) {
  const match = getKoMatch(matchId);
  if (isSetRound(match.round)) throw new UserError('Ab dem Viertelfinale werden Sätze erfasst');
  assertKoEditable(match);
  const result = evaluateKehren(entries, true);
  db().transaction(() => {
    storeKehren('ko', matchId, match.team_a_id!, match.team_b_id!, result.kehren);
    finishKoMatch(match, result.status, result.winner, result.a, result.b);
  })();
  return result;
}

export function saveKoSets(matchId: number, sets: SetEntry[], enteredByReferee: boolean) {
  const match = getKoMatch(matchId);
  if (!isSetRound(match.round)) throw new UserError('16tel und 8tel werden über Kehren erfasst');
  assertKoEditable(match);
  const result = evaluateSets(sets, enteredByReferee);
  db().transaction(() => {
    db().prepare('DELETE FROM ko_sets WHERE match_id = ?').run(matchId);
    const ins = db().prepare('INSERT INTO ko_sets (match_id, set_number, team_a_score, team_b_score) VALUES (?, ?, ?, ?)');
    sets.forEach((s, i) => ins.run(matchId, i + 1, s.teamAScore, s.teamBScore));
    finishKoMatch(match, result.finished ? 'finished' : 'scheduled', result.winner, result.winsA, result.winsB);
  })();
  return result;
}

export function resetKoMatch(matchId: number) {
  const match = getKoMatch(matchId);
  assertKoEditable(match);
  db().transaction(() => {
    db().prepare(`DELETE FROM kehren WHERE match_type = 'ko' AND match_id = ?`).run(matchId);
    db().prepare(`DELETE FROM four_baggers WHERE match_type = 'ko' AND match_id = ? AND auto = 1`).run(matchId);
    db().prepare('DELETE FROM ko_sets WHERE match_id = ?').run(matchId);
    finishKoMatch(match, 'scheduled', null, 0, 0);
  })();
}

export function setKoLane(matchId: number, lane: number | null) {
  if (lane !== null && !(Number.isInteger(lane) && lane >= 1 && lane <= TOTAL_LANES)) {
    throw new UserError(`Bahn muss zwischen 1 und ${TOTAL_LANES} liegen`);
  }
  db().prepare('UPDATE ko_matches SET lane = ? WHERE id = ?').run(lane, matchId);
}

// ---------------------------------------------------------------- 4-Bagger / Freigetränke

export type FourBaggerView = {
  id: number; match_type: 'group' | 'ko'; match_id: number | null; team_id: number; team_name: string;
  player_name: string | null; auto: number; redeemed: number; created_at: string;
};

export function listFourBaggers(): FourBaggerView[] {
  return db().prepare(
    `SELECT f.*, t.team_name FROM four_baggers f JOIN teams t ON t.id = f.team_id ORDER BY f.redeemed, f.created_at DESC`
  ).all() as FourBaggerView[];
}

export function logFourBagger(matchType: 'group' | 'ko', matchId: number, teamId: number, playerName?: string) {
  db().prepare('INSERT INTO four_baggers (match_type, match_id, team_id, player_name, auto) VALUES (?, ?, ?, ?, 0)')
    .run(matchType, matchId, teamId, playerName?.trim() || null);
}

export function setFourBaggerRedeemed(id: number, redeemed: boolean) {
  db().prepare('UPDATE four_baggers SET redeemed = ? WHERE id = ?').run(redeemed ? 1 : 0, id);
}

export function deleteFourBagger(id: number) {
  db().prepare('DELETE FROM four_baggers WHERE id = ? AND auto = 0').run(id);
}
