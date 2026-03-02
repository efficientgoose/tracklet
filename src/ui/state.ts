function toMs(iso) {
  return new Date(iso).getTime();
}

function segmentSeconds(segment, nowIso) {
  const end = segment.endedAt || nowIso;
  const seconds = Math.floor((toMs(end) - toMs(segment.startedAt)) / 1000);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

function normalizeSegment(segment) {
  return {
    startedAt: segment.startedAt ?? segment.started_at,
    endedAt: segment.endedAt ?? segment.ended_at ?? null,
    reason: segment.reason ?? 'manual',
    endReason: segment.endReason ?? segment.end_reason ?? null
  };
}

function normalizeSession(session) {
  return {
    sessionId: session.sessionId ?? session.session_id,
    issueId: session.issueId ?? session.issue_id,
    issueKey: session.issueKey ?? session.issue_key,
    summary: session.summary ?? '',
    state: session.state,
    startedAt: session.startedAt ?? session.started_at,
    endedAt: session.endedAt ?? session.ended_at ?? null,
    stopReason: session.stopReason ?? session.stop_reason ?? null,
    segments: (session.segments ?? []).map(normalizeSegment)
  };
}

export function normalizeSnapshot(snapshot) {
  return {
    activeSession: snapshot?.activeSession
      ? normalizeSession(snapshot.activeSession)
      : snapshot?.active_session
        ? normalizeSession(snapshot.active_session)
        : null,
    completedSessions: (snapshot?.completedSessions ?? snapshot?.completed_sessions ?? []).map(
      normalizeSession
    )
  };
}

export function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

export function activeStatusLabel(snapshot, nowIso) {
  if (!snapshot.activeSession) {
    return 'No Active Timer';
  }

  const totalSeconds = snapshot.activeSession.segments.reduce(
    (acc, segment) => acc + segmentSeconds(segment, nowIso),
    0
  );
  const duration = formatDuration(totalSeconds);
  const issueKey = String(snapshot.activeSession.issueKey ?? '');

  if (issueKey === 'LOCAL') {
    return '';
  }

  return `${duration} - ${issueKey}`;
}

function dayKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(key) {
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86400000).toISOString());
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  const d = new Date(key + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function aggregateByDay(snapshot, nowIso, days) {
  const cutoff = Date.now() - days * 86400000;
  const sessions = [...snapshot.completedSessions];
  if (snapshot.activeSession) sessions.push(snapshot.activeSession);

  // Map: dateKey → Map<issueKey, { issueKey, summary, totalSeconds }>
  const dayMap = new Map();

  for (const session of sessions) {
    if (toMs(session.startedAt) < cutoff) continue;
    const key = dayKey(session.startedAt);
    if (!dayMap.has(key)) dayMap.set(key, new Map());
    const taskMap = dayMap.get(key);

    const secs = session.segments.reduce((acc, seg) => acc + segmentSeconds(seg, nowIso), 0);
    if (secs <= 0) continue;

    const existing = taskMap.get(session.issueKey) || {
      issueKey: session.issueKey,
      summary: session.summary,
      totalSeconds: 0,
    };
    existing.totalSeconds += secs;
    taskMap.set(session.issueKey, existing);
  }

  return [...dayMap.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, taskMap]) => ({
      dateKey: key,
      dateLabel: dayLabel(key),
      totalSeconds: [...taskMap.values()].reduce((s, t) => s + t.totalSeconds, 0),
      tasks: [...taskMap.values()].sort((a, b) => b.totalSeconds - a.totalSeconds),
    }));
}

export function aggregateAnalytics(snapshot, nowIso) {
  const groups = new Map();
  const sessions = [...snapshot.completedSessions];

  if (snapshot.activeSession) {
    sessions.push(snapshot.activeSession);
  }

  for (const session of sessions) {
    const sessionSeconds = session.segments.reduce(
      (acc, segment) => acc + segmentSeconds(segment, nowIso),
      0
    );

    const existing = groups.get(session.issueKey) || {
      issueId: session.issueId,
      issueKey: session.issueKey,
      summary: session.summary,
      totalSeconds: 0
    };

    existing.totalSeconds += sessionSeconds;
    groups.set(session.issueKey, existing);
  }

  return [...groups.values()].sort((a, b) => b.totalSeconds - a.totalSeconds);
}
