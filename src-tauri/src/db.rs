use crate::auth::JiraAuthSession;
use rusqlite::{params, Connection, Result};
use std::path::Path;
use std::sync::Mutex;

pub const INITIAL_MIGRATION: &str = include_str!("../migrations/0001_init.sql");

pub struct Db {
    conn: Mutex<Connection>,
}

impl Db {
    pub fn open(path: &Path) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        Ok(Self { conn: Mutex::new(conn) })
    }

    pub fn migrate(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(INITIAL_MIGRATION)?;

        // Add avatar_url column if it doesn't exist (for existing databases)
        let mut stmt = conn.prepare("PRAGMA table_info(jira_accounts)")?;
        let columns = stmt.query_map([], |row| {
            let name: String = row.get(1)?;
            Ok(name)
        })?;

        let mut has_avatar_url = false;
        let mut has_account_name = false;
        for col in columns {
            let col_name = col?;
            if col_name == "avatar_url" {
                has_avatar_url = true;
            }
            if col_name == "account_name" {
                has_account_name = true;
            }
        }

        if !has_avatar_url {
            conn.execute("ALTER TABLE jira_accounts ADD COLUMN avatar_url TEXT", [])?;
        }
        if !has_account_name {
            conn.execute("ALTER TABLE jira_accounts ADD COLUMN account_name TEXT", [])?;
        }

        Ok(())
    }

    pub fn save_jira_session(&self, session: &JiraAuthSession) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        let conn = self.conn.lock().unwrap();

        // Clear existing selections before saving new one
        conn.execute(
            "UPDATE jira_accounts SET is_selected = 0",
            [],
        )?;

        conn.execute(
            "INSERT INTO jira_accounts (
                cloud_id, site_url, account_id, account_name, avatar_url, access_token, refresh_token, is_selected, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8, ?8)
            ON CONFLICT(cloud_id) DO UPDATE SET
                site_url = EXCLUDED.site_url,
                account_id = EXCLUDED.account_id,
                account_name = EXCLUDED.account_name,
                avatar_url = EXCLUDED.avatar_url,
                access_token = EXCLUDED.access_token,
                refresh_token = EXCLUDED.refresh_token,
                is_selected = 1,
                updated_at = EXCLUDED.updated_at",
            params![
                session.cloud_id,
                session.site_url,
                session.account_id,
                session.account_name,
                session.avatar_url,
                session.access_token,
                session.refresh_token,
                now
            ],
        )?;
        Ok(())
    }

    pub fn get_selected_jira_session(&self) -> Result<Option<JiraAuthSession>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT access_token, refresh_token, cloud_id, site_url, account_id, account_name, avatar_url
             FROM jira_accounts 
             WHERE is_selected = 1 
             LIMIT 1"
        )?;

        let mut rows = stmt.query_map([], |row| {
            Ok(JiraAuthSession {
                access_token: row.get(0)?,
                refresh_token: row.get(1)?,
                cloud_id: row.get(2)?,
                site_url: row.get(3)?,
                account_id: row.get(4)?,
                account_name: row.get(5)?,
                avatar_url: row.get(6)?,
            })
        })?;

        if let Some(session) = rows.next() {
            Ok(Some(session?))
        } else {
            Ok(None)
        }
    }

    pub fn clear_jira_sessions(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM jira_accounts", [])?;
        Ok(())
    }

    pub fn save_jira_issues(&self, issues: &[crate::jira::IssueSummary], account_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();

        // Use a transaction for efficiency
        conn.execute("DELETE FROM jira_issues WHERE assignee_account_id = ?1", params![account_id])?;

        for issue in issues {
            conn.execute(
                "INSERT INTO jira_issues (
                    issue_id, issue_key, summary, status_category, assignee_account_id, updated_at, synced_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
                params![
                    issue.issue_id,
                    issue.issue_key,
                    issue.summary,
                    issue.status_category,
                    account_id,
                    now
                ],
            )?;
        }
        Ok(())
    }

    pub fn get_jira_issues(&self, account_id: &str) -> Result<Vec<crate::jira::IssueSummary>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT issue_id, issue_key, summary, status_category 
             FROM jira_issues 
             WHERE assignee_account_id = ?1 
             ORDER BY synced_at DESC"
        )?;

        let rows = stmt.query_map(params![account_id], |row| {
            Ok(crate::jira::IssueSummary {
                issue_id: row.get(0)?,
                issue_key: row.get(1)?,
                summary: row.get(2)?,
                status_category: row.get(3)?,
            })
        })?;

        let mut issues = Vec::new();
        for issue_res in rows {
            issues.push(issue_res?);
        }
        Ok(issues)
    }
}
