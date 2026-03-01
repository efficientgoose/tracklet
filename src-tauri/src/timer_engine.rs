use crate::models::{JiraIssue, SessionSegment, TimeSession, TimerSnapshot, TimerState};

#[derive(Default)]
pub struct TimerEngine {
    snapshot: TimerSnapshot,
}

impl TimerEngine {
    pub fn snapshot(&self) -> TimerSnapshot {
        self.snapshot.clone()
    }

    pub fn status_title(&self, now_iso: &str) -> String {
        let Some(active) = &self.snapshot.active_session else {
            return "No Active Timer".to_string();
        };

        let seconds = active
            .segments
            .iter()
            .map(|segment| {
                let end = segment.ended_at.as_deref().unwrap_or(now_iso);
                duration_seconds(&segment.started_at, end)
            })
            .sum::<i64>();

        let hours = seconds / 3600;
        let minutes = (seconds % 3600) / 60;
        format!("{}h {}m - {}", hours, minutes, active.issue_key)
    }

    pub fn start(&mut self, issue: JiraIssue, at: &str) -> TimerSnapshot {
        if self.snapshot.active_session.is_some() {
            self.stop(at, "switch_issue");
        }

        self.snapshot.active_session = Some(TimeSession {
            session_id: format!("{}-{}", issue.issue_id, at),
            issue_id: issue.issue_id,
            issue_key: issue.issue_key,
            summary: issue.summary,
            state: TimerState::Running,
            started_at: at.to_string(),
            ended_at: None,
            stop_reason: None,
            segments: vec![SessionSegment {
                started_at: at.to_string(),
                ended_at: None,
                reason: "manual_start".to_string(),
                end_reason: None,
            }],
        });

        self.snapshot()
    }

    pub fn pause(&mut self, at: &str, reason: &str) -> Result<TimerSnapshot, &'static str> {
        let Some(active) = self.snapshot.active_session.as_mut() else {
            return Err("No active timer");
        };

        if active.state != TimerState::Running {
            return Err("Timer is not running");
        }

        if let Some(segment) = active
            .segments
            .iter_mut()
            .rev()
            .find(|segment| segment.ended_at.is_none())
        {
            segment.ended_at = Some(at.to_string());
            segment.end_reason = Some(reason.to_string());
        }

        active.state = TimerState::Paused;
        Ok(self.snapshot())
    }

    pub fn resume(&mut self, at: &str) -> Result<TimerSnapshot, &'static str> {
        let Some(active) = self.snapshot.active_session.as_mut() else {
            return Err("No active timer");
        };

        if active.state != TimerState::Paused {
            return Err("Timer is not paused");
        }

        active.state = TimerState::Running;
        active.segments.push(SessionSegment {
            started_at: at.to_string(),
            ended_at: None,
            reason: "manual_resume".to_string(),
            end_reason: None,
        });

        Ok(self.snapshot())
    }

    pub fn stop(&mut self, at: &str, reason: &str) -> TimerSnapshot {
        let Some(mut active) = self.snapshot.active_session.take() else {
            return self.snapshot();
        };

        if active.state == TimerState::Running {
            if let Some(segment) = active
                .segments
                .iter_mut()
                .rev()
                .find(|segment| segment.ended_at.is_none())
            {
                segment.ended_at = Some(at.to_string());
                segment.end_reason = Some(reason.to_string());
            }
        }

        active.state = TimerState::Stopped;
        active.ended_at = Some(at.to_string());
        active.stop_reason = Some(reason.to_string());
        self.snapshot.completed_sessions.push(active);

        self.snapshot()
    }
}

fn duration_seconds(start: &str, end: &str) -> i64 {
    let start_ts = chrono::DateTime::parse_from_rfc3339(start)
        .map(|d| d.timestamp())
        .unwrap_or(0);
    let end_ts = chrono::DateTime::parse_from_rfc3339(end)
        .map(|d| d.timestamp())
        .unwrap_or(start_ts);

    (end_ts - start_ts).max(0)
}
