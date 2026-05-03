CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  telegram_chat_id TEXT,
  slack_user_id TEXT,
  workout_detail_mode TEXT NOT NULL DEFAULT 'basic' CHECK(workout_detail_mode IN ('basic','detailed')),
  timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE api_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_used_at TEXT
);

CREATE TABLE exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_name TEXT NOT NULL UNIQUE,
  body_part TEXT NOT NULL,
  equipment TEXT NOT NULL,
  is_bodyweight INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE exercise_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  alias TEXT NOT NULL UNIQUE COLLATE NOCASE
);
CREATE INDEX idx_exercise_aliases_alias ON exercise_aliases(alias);

CREATE TABLE workout_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  notes TEXT
);
CREATE INDEX idx_workout_sessions_user_started ON workout_sessions(user_id, started_at);

CREATE TABLE workout_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  sequence INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_workout_entries_session ON workout_entries(session_id);

CREATE TABLE workout_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES workout_entries(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  weight_kg REAL NOT NULL,
  reps INTEGER NOT NULL,
  rpe REAL,
  rir INTEGER,
  rest_sec INTEGER,
  tempo TEXT,
  notes TEXT
);
CREATE INDEX idx_workout_sets_entry ON workout_sets(entry_id);

CREATE TABLE body_measurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  measured_at TEXT NOT NULL,
  weight_kg REAL,
  smm_kg REAL,
  pbf_pct REAL,
  bmi REAL,
  source TEXT NOT NULL CHECK(source IN ('manual','inbody_ocr','healthkit'))
);
CREATE INDEX idx_body_user_measured ON body_measurements(user_id, measured_at);

CREATE TABLE daily_checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  sleep_hours REAL,
  condition_score INTEGER CHECK(condition_score BETWEEN 1 AND 5),
  notes TEXT,
  UNIQUE(user_id, date)
);

CREATE TABLE prediction_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  slope_per_week REAL NOT NULL,
  personal_tau_days REAL,
  sample_size INTEGER NOT NULL,
  confidence REAL NOT NULL,
  fitted_at TEXT NOT NULL,
  UNIQUE(user_id, exercise_id)
);

CREATE TABLE alarm_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK(scope IN ('exercise','global')),
  exercise_id INTEGER REFERENCES exercises(id),
  threshold_type TEXT NOT NULL CHECK(threshold_type IN ('1rm_below','days_inactive_above','smm_below','weight_above','weight_below')),
  threshold_value REAL NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_fired_at TEXT
);

CREATE TABLE notifications_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  generated_by TEXT NOT NULL CHECK(generated_by IN ('agent','fallback'))
);
