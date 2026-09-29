-- schema.sql
-- Wird beim Start automatisch angewendet (CREATE TABLE IF NOT EXISTS).
-- Abweichungen zur ursprünglichen Spezifikation sind mit "ERGÄNZT" markiert.

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY,
  team_name TEXT UNIQUE NOT NULL,
  club_name TEXT,
  player1_name TEXT NOT NULL,
  player1_email TEXT NOT NULL,
  player1_phone TEXT,
  player2_name TEXT NOT NULL,
  player2_email TEXT,
  player2_phone TEXT,
  payment_reference TEXT UNIQUE,
  payment_status TEXT NOT NULL DEFAULT 'pending',       -- pending | paid
  payment_due_date TEXT,
  registration_status TEXT NOT NULL DEFAULT 'pending',  -- unverified | pending | confirmed | rejected | waitlist | expired
  group_id TEXT,                                        -- 'A'..'H', erst nach Gruppenzuteilung gesetzt
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TEXT,
  -- ERGÄNZT: Double-Opt-in per Bestätigungslink und Zeitpunkt der letzten Zahlungserinnerung
  -- (bei bestehenden Datenbanken fügt lib/db.ts die Spalten automatisch hinzu)
  email_verify_token TEXT,
  email_verified_at TEXT,
  last_reminder_at TEXT
);

CREATE TABLE IF NOT EXISTS group_matches (
  id INTEGER PRIMARY KEY,
  group_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  team_a_id INTEGER REFERENCES teams(id),
  team_b_id INTEGER REFERENCES teams(id),   -- NULL bei Freilos
  is_bye INTEGER NOT NULL DEFAULT 0,
  lane INTEGER,
  global_slot INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | finished
  team_a_points INTEGER DEFAULT 0,          -- Summe nach Cancellation Scoring
  team_b_points INTEGER DEFAULT 0,
  winner_team_id INTEGER REFERENCES teams(id)
);

-- ERGÄNZT: match_type ('group' | 'ko'), damit auch 16tel/8tel-Spiele Kehren speichern können,
-- sowie die Säckchen-Zählung (für die automatische 4-Bagger-Erkennung).
CREATE TABLE IF NOT EXISTS kehren (
  id INTEGER PRIMARY KEY,
  match_type TEXT NOT NULL DEFAULT 'group',
  match_id INTEGER NOT NULL,
  kehre_number INTEGER NOT NULL,
  team_a_raw INTEGER NOT NULL,
  team_b_raw INTEGER NOT NULL,
  team_a_in_hole INTEGER,
  team_a_on_board INTEGER,
  team_b_in_hole INTEGER,
  team_b_on_board INTEGER
);

-- ERGÄNZT: position (Reihenfolge innerhalb der Runde), team_a_points/team_b_points (16tel/8tel),
-- Status 'waiting' (Gegner noch nicht ermittelt).
CREATE TABLE IF NOT EXISTS ko_matches (
  id INTEGER PRIMARY KEY,
  round TEXT NOT NULL,                      -- '16tel' | '8tel' | 'viertel' | 'halbfinale' | 'finale'
  position INTEGER NOT NULL DEFAULT 0,
  team_a_id INTEGER REFERENCES teams(id),
  team_b_id INTEGER REFERENCES teams(id),
  lane INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled', -- waiting | scheduled | sudden_death | finished
  team_a_points INTEGER DEFAULT 0,
  team_b_points INTEGER DEFAULT 0,
  winner_team_id INTEGER REFERENCES teams(id),
  next_match_id INTEGER REFERENCES ko_matches(id),
  next_match_slot TEXT                      -- 'teamA' | 'teamB'
);

CREATE TABLE IF NOT EXISTS ko_sets (
  id INTEGER PRIMARY KEY,
  match_id INTEGER REFERENCES ko_matches(id),
  set_number INTEGER NOT NULL,
  team_a_score INTEGER NOT NULL,
  team_b_score INTEGER NOT NULL
);

-- ERGÄNZT: match_type, player_name, auto (aus Kehren erkannt), redeemed (Freigetränk ausgegeben).
CREATE TABLE IF NOT EXISTS four_baggers (
  id INTEGER PRIMARY KEY,
  match_type TEXT NOT NULL DEFAULT 'group',
  match_id INTEGER,
  team_id INTEGER REFERENCES teams(id),
  player_name TEXT,
  auto INTEGER NOT NULL DEFAULT 0,
  redeemed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
  -- genutzt für: registration_open, last_sync_at, tournament_phase, tournament_start, match_duration_min
);

CREATE INDEX IF NOT EXISTS idx_kehren_match ON kehren(match_type, match_id);
CREATE INDEX IF NOT EXISTS idx_group_matches_group ON group_matches(group_id);
CREATE INDEX IF NOT EXISTS idx_ko_sets_match ON ko_sets(match_id);
