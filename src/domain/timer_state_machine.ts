function cloneState(state) {
  return {
    activeSession: state.activeSession
      ? {
          ...state.activeSession,
          segments: state.activeSession.segments.map((segment) => ({ ...segment }))
        }
      : null,
    completedSessions: state.completedSessions.map((session) => ({
      ...session,
      segments: session.segments.map((segment) => ({ ...segment }))
    }))
  };
}

function asMs(iso) {
  return new Date(iso).getTime();
}

function closeOpenSegment(session, at, reason) {
  const next = {
    ...session,
    segments: session.segments.map((segment) => ({ ...segment }))
  };

  for (let i = next.segments.length - 1; i >= 0; i -= 1) {
    if (!next.segments[i].endedAt) {
      next.segments[i].endedAt = at;
      next.segments[i].endReason = reason;
      break;
    }
  }

  return next;
}

function durationSeconds(segments, nowIso) {
  return segments.reduce((total, segment) => {
    const endIso = segment.endedAt || nowIso;
    const diff = asMs(endIso) - asMs(segment.startedAt);
    if (Number.isNaN(diff) || diff <= 0) {
      return total;
    }

    return total + Math.floor(diff / 1000);
  }, 0);
}

export function createTimerState() {
  return {
    activeSession: null,
    completedSessions: []
  };
}

export function startTimer(state, issue, startedAt) {
  let next = cloneState(state);

  if (next.activeSession) {
    next = stopTimer(next, startedAt, 'switch_issue');
  }

  next.activeSession = {
    sessionId: `${issue.issueId}-${startedAt}`,
    issueId: issue.issueId,
    issueKey: issue.issueKey,
    summary: issue.summary,
    state: 'Running',
    startedAt,
    endedAt: null,
    stopReason: null,
    segments: [
      {
        startedAt,
        endedAt: null,
        reason: 'manual_start',
        endReason: null
      }
    ]
  };

  return next;
}

export function pauseTimer(state, pausedAt, reason = 'manual') {
  const next = cloneState(state);
  if (!next.activeSession || next.activeSession.state !== 'Running') {
    throw new Error('No running timer to pause');
  }

  next.activeSession = closeOpenSegment(next.activeSession, pausedAt, reason);
  next.activeSession.state = 'Paused';
  return next;
}

export function resumeTimer(state, resumedAt) {
  const next = cloneState(state);
  if (!next.activeSession || next.activeSession.state !== 'Paused') {
    throw new Error('No paused timer to resume');
  }

  next.activeSession.state = 'Running';
  next.activeSession.segments.push({
    startedAt: resumedAt,
    endedAt: null,
    reason: 'manual_resume',
    endReason: null
  });

  return next;
}

export function stopTimer(state, stoppedAt, reason = 'manual_stop') {
  const next = cloneState(state);
  if (!next.activeSession) {
    return next;
  }

  let finalized = { ...next.activeSession };
  if (finalized.state === 'Running') {
    finalized = closeOpenSegment(finalized, stoppedAt, reason);
  }

  finalized.state = 'Stopped';
  finalized.endedAt = stoppedAt;
  finalized.stopReason = reason;

  next.completedSessions = [...next.completedSessions, finalized];
  next.activeSession = null;
  return next;
}

export function summarizeByIssue(state, nowIso) {
  const totals = new Map();
  const sessions = [...state.completedSessions];
  if (state.activeSession) {
    sessions.push(state.activeSession);
  }

  for (const session of sessions) {
    const seconds = durationSeconds(session.segments, nowIso);
    const existing = totals.get(session.issueKey) || {
      issueId: session.issueId,
      issueKey: session.issueKey,
      summary: session.summary,
      totalSeconds: 0
    };

    existing.totalSeconds += seconds;
    totals.set(session.issueKey, existing);
  }

  return [...totals.values()].sort((a, b) => b.totalSeconds - a.totalSeconds);
}
