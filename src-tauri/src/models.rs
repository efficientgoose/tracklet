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

impl std::fmt::Display for TimerState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TimerState::Idle => write!(f, "Idle"),
            TimerState::Running => write!(f, "Running"),
            TimerState::Paused => write!(f, "Paused"),
            TimerState::Stopped => write!(f, "Stopped"),
        }
    }
}

impl std::str::FromStr for TimerState {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "Idle" => Ok(TimerState::Idle),
            "Running" => Ok(TimerState::Running),
            "Paused" => Ok(TimerState::Paused),
            "Stopped" => Ok(TimerState::Stopped),
            _ => Err(format!("Unknown TimerState: {s}")),
        }
    }
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
