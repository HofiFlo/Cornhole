export type RegistrationStatus = 'pending' | 'confirmed' | 'rejected' | 'waitlist' | 'expired';
export type PaymentStatus = 'pending' | 'paid';
export type TournamentPhase = 'registration' | 'setup' | 'group_stage_active' | 'ko_active' | 'finished';
export type KoRound = '16tel' | '8tel' | 'viertel' | 'halbfinale' | 'finale';
export type KoStatus = 'waiting' | 'scheduled' | 'sudden_death' | 'finished';

export type Team = {
  id: number;
  team_name: string;
  club_name: string | null;
  player1_name: string;
  player1_email: string;
  player1_phone: string | null;
  player2_name: string;
  player2_email: string | null;
  player2_phone: string | null;
  payment_reference: string | null;
  payment_status: PaymentStatus;
  payment_due_date: string | null;
  registration_status: RegistrationStatus;
  group_id: string | null;
  created_at: string | null;
  confirmed_at: string | null;
};

export type GroupMatchRow = {
  id: number;
  group_id: string;
  round: number;
  team_a_id: number;
  team_b_id: number | null;
  is_bye: number;
  lane: number | null;
  global_slot: number | null;
  status: 'scheduled' | 'finished';
  team_a_points: number;
  team_b_points: number;
  winner_team_id: number | null;
};

export type KoMatchRow = {
  id: number;
  round: KoRound;
  position: number;
  team_a_id: number | null;
  team_b_id: number | null;
  lane: number | null;
  status: KoStatus;
  team_a_points: number;
  team_b_points: number;
  winner_team_id: number | null;
  next_match_id: number | null;
  next_match_slot: 'teamA' | 'teamB' | null;
};

export type KehreRow = {
  id: number;
  match_type: 'group' | 'ko';
  match_id: number;
  kehre_number: number;
  team_a_raw: number;
  team_b_raw: number;
  team_a_in_hole: number | null;
  team_a_on_board: number | null;
  team_b_in_hole: number | null;
  team_b_on_board: number | null;
};

export type KoSetRow = {
  id: number;
  match_id: number;
  set_number: number;
  team_a_score: number;
  team_b_score: number;
};

export type GroupAssignment = Record<string, number[]>;

export type BagCount = { inHole: number; onBoard: number };
export type KehreEntry = { teamA: BagCount; teamB: BagCount };
export type SetEntry = { teamAScore: number; teamBScore: number };
