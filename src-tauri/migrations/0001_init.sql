PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS jira_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cloud_id TEXT NOT NULL UNIQUE,
  site_url TEXT NOT NULL,
  account_id TEXT NOT NULL,
  is_selected INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jira_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id TEXT NOT NULL UNIQUE,
  issue_key TEXT NOT NULL,
  summary TEXT NOT NULL,
  status_category TEXT NOT NULL,
  assignee_account_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS time_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_uid TEXT NOT NULL UNIQUE,
  issue_id TEXT NOT NULL,
  issue_key TEXT NOT NULL,
  summary TEXT NOT NULL,
  state TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  stop_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_uid TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  reason TEXT NOT NULL,
  end_reason TEXT,
  FOREIGN KEY (session_uid) REFERENCES time_sessions(session_uid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jira_issues_assignee ON jira_issues(assignee_account_id);
CREATE INDEX IF NOT EXISTS idx_jira_issues_status ON jira_issues(status_category);
CREATE INDEX IF NOT EXISTS idx_time_sessions_issue_key ON time_sessions(issue_key);
CREATE INDEX IF NOT EXISTS idx_session_segments_session_uid ON session_segments(session_uid);
