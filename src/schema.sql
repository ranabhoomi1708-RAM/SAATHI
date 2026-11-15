CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS circles(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  elder_name TEXT NOT NULL,
  elder_age INTEGER,
  elder_email TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  join_code TEXT NOT NULL UNIQUE,
  elder_pin_hash TEXT NOT NULL,
  blood_group TEXT, conditions TEXT, allergies TEXT,
  doctor_name TEXT, doctor_phone TEXT, emergency_notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS members(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('admin','editor','viewer')),
  status TEXT NOT NULL CHECK(status IN ('pending','active','revoked')),
  relation TEXT,
  notify_missed INTEGER NOT NULL DEFAULT 1,
  notify_upcoming INTEGER NOT NULL DEFAULT 0,
  notify_appointments INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(circle_id,user_id)
);
CREATE TABLE IF NOT EXISTS medications(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT,
  form TEXT NOT NULL DEFAULT 'tablet',
  appearance TEXT,
  instructions TEXT NOT NULL DEFAULT 'anytime',
  purpose TEXT,
  times TEXT NOT NULL,
  days_of_week TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
  start_date TEXT, end_date TEXT,
  pills_left INTEGER,
  pills_per_dose INTEGER NOT NULL DEFAULT 1,
  refill_threshold INTEGER NOT NULL DEFAULT 5,
  color TEXT DEFAULT '#0F766E',
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS dose_logs(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  medication_id INTEGER NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  scheduled_date TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','taken','skipped','missed')),
  taken_at TEXT, logged_by TEXT, note TEXT, snoozed_until TEXT,
  UNIQUE(medication_id,scheduled_date,scheduled_time)
);
CREATE TABLE IF NOT EXISTS appointments(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  doctor TEXT NOT NULL, specialty TEXT, location TEXT,
  datetime TEXT NOT NULL,
  purpose TEXT,
  questions TEXT NOT NULL DEFAULT '[]',
  accompanied_by TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK(status IN ('upcoming','done','cancelled')),
  outcome_notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS mood_checkins(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  date TEXT NOT NULL, mood INTEGER NOT NULL CHECK(mood BETWEEN 1 AND 5), note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS activity_log(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  actor TEXT, action TEXT NOT NULL, detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notification_log(
  key TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS outbox(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER, to_email TEXT NOT NULL, subject TEXT NOT NULL,
  body_text TEXT, body_html TEXT, kind TEXT,
  sent INTEGER NOT NULL DEFAULT 0, error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sos_events(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  triggered_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT, resolved_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_dose_circle_date ON dose_logs(circle_id,scheduled_date);
CREATE INDEX IF NOT EXISTS idx_members_user ON members(user_id);