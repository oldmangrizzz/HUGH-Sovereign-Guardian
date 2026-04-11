-- Inbox Triage Pipeline - Core Database Schema
-- Schema version: 16 (latest migration level)

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account TEXT NOT NULL,
  gmail_message_id TEXT NOT NULL,
  gmail_thread_id TEXT NOT NULL,
  internal_date_ms INTEGER,
  message_date TEXT,
  from_name TEXT,
  from_email TEXT,
  subject TEXT,
  snippet TEXT,
  has_attachments INTEGER DEFAULT 0,
  quarantine_status TEXT,           -- allowed | review | blocked
  quarantine_flags_json TEXT,
  safe_excerpt TEXT,
  body_hash TEXT,
  sender_role TEXT,                 -- inbound | outbound | internal
  embedding BLOB,
  rfc822_message_id TEXT,
  state TEXT DEFAULT 'new',         -- new | processed | skipped | error | pending_review
  error TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE(account, gmail_message_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_account_date ON messages(account, internal_date_ms DESC);
CREATE INDEX IF NOT EXISTS idx_messages_from_email ON messages(from_email);
CREATE INDEX IF NOT EXISTS idx_messages_state ON messages(state);
CREATE INDEX IF NOT EXISTS idx_messages_gmail_thread_id ON messages(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_rfc822_id ON messages(rfc822_message_id);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  company TEXT,
  contact_name TEXT,
  contact_email TEXT,
  offer_type TEXT,
  deliverables TEXT,
  budget TEXT,
  timeline TEXT,
  questions_json TEXT,
  red_flags_json TEXT,
  needs_human_review INTEGER DEFAULT 0,
  extracted_json TEXT,
  extraction_model TEXT,
  extracted_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE(message_id)
);

CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  score INTEGER,
  shadow_score INTEGER,
  triage_disposition TEXT NOT NULL DEFAULT 'new_sponsor_request',
  bucket TEXT,
  reasons_json TEXT,
  flags_json TEXT,
  recommended_action TEXT,
  applied_label TEXT,
  scoring_model TEXT,
  scoring_rubric_version TEXT,
  scored_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  raw_json TEXT,
  UNIQUE(message_id)
);

CREATE TABLE IF NOT EXISTS score_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  score INTEGER,
  shadow_score INTEGER,
  triage_disposition TEXT,
  bucket TEXT,
  label TEXT,
  reasons_json TEXT,
  flags_json TEXT,
  recommended_action TEXT,
  scoring_model TEXT,
  scoring_rubric_version TEXT,
  scored_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  raw_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_score_history_message ON score_history(message_id);

CREATE TABLE IF NOT EXISTS thread_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmail_thread_id TEXT NOT NULL,
  account TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'new',
  last_sender_message_at TEXT,
  last_own_message_at TEXT,
  turn_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE(gmail_thread_id)
);

CREATE INDEX IF NOT EXISTS idx_thread_status_stage ON thread_status(stage);
CREATE INDEX IF NOT EXISTS idx_thread_status_account ON thread_status(account);

CREATE TABLE IF NOT EXISTS stage_transitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmail_thread_id TEXT NOT NULL,
  account TEXT,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  trigger TEXT,
  metadata_json TEXT,
  auto_applied INTEGER NOT NULL DEFAULT 0,
  transitioned_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_stage_transitions_thread ON stage_transitions(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_stage_transitions_auto ON stage_transitions(auto_applied, transitioned_at);

-- NOTE: escalations table uses generic notification_channel_id/notification_ts
-- (kit safety note: original used slack_channel_id/slack_ts — replaced for vendor-agnosticism)
CREATE TABLE IF NOT EXISTS escalations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  notification_channel_id TEXT,
  notification_ts TEXT,
  escalated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE(message_id)
);

CREATE TABLE IF NOT EXISTS drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,  -- reply | followup
  to_email TEXT,
  subject TEXT,
  body TEXT,
  gmail_draft_id TEXT,
  gmail_thread_url TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE(message_id, kind)
);

CREATE TABLE IF NOT EXISTS do_not_contact (
  email TEXT PRIMARY KEY,
  reason TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS thread_labels (
  gmail_thread_id TEXT NOT NULL,
  account TEXT NOT NULL,
  label TEXT NOT NULL,
  labeled_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (gmail_thread_id, account)
);
