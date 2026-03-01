use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct JiraIssue {
    pub issue_id: String,
    pub issue_key: String,
    pub summary: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum TimerState {
    Idle,
    Running,
    Paused,
    Stopped,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionSegment {
    pub started_at: String,
    pub ended_at: Option<String>,
    pub reason: String,
    pub end_reason: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TimeSession {
    pub session_id: String,
    pub issue_id: String,
    pub issue_key: String,
    pub summary: String,
    pub state: TimerState,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub stop_reason: Option<String>,
    pub segments: Vec<SessionSegment>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TimerSnapshot {
    pub active_session: Option<TimeSession>,
    pub completed_sessions: Vec<TimeSession>,
}

impl Default for TimerSnapshot {
    fn default() -> Self {
        Self {
            active_session: None,
            completed_sessions: Vec::new(),
        }
    }
}
