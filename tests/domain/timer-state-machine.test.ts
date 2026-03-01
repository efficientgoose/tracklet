import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTimerState,
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
  summarizeByIssue
} from '../../src/domain/timer_state_machine.ts';

test('idle to running transition starts a segment', () => {
  const state = createTimerState();
  const t0 = '2026-02-17T10:00:00.000Z';
  const next = startTimer(state, { issueId: '10001', issueKey: 'JIRA-123', summary: 'Build tracker' }, t0);

  assert.equal(next.activeSession?.state, 'Running');
  assert.equal(next.activeSession?.issueKey, 'JIRA-123');
  assert.equal(next.activeSession?.segments.length, 1);
  assert.equal(next.activeSession?.segments[0].startedAt, t0);
  assert.equal(next.completedSessions.length, 0);
});

test('running to paused to running to stopped preserves segments', () => {
  const s0 = createTimerState();
  const started = startTimer(
    s0,
    { issueId: '10001', issueKey: 'JIRA-123', summary: 'Build tracker' },
    '2026-02-17T10:00:00.000Z'
  );

  const paused = pauseTimer(started, '2026-02-17T10:30:00.000Z', 'manual');
  assert.equal(paused.activeSession?.state, 'Paused');
  assert.equal(paused.activeSession?.segments[0].endedAt, '2026-02-17T10:30:00.000Z');

  const resumed = resumeTimer(paused, '2026-02-17T10:45:00.000Z');
  assert.equal(resumed.activeSession?.state, 'Running');
  assert.equal(resumed.activeSession?.segments.length, 2);

  const stopped = stopTimer(resumed, '2026-02-17T11:15:00.000Z', 'manual_stop');
  assert.equal(stopped.activeSession, null);
  assert.equal(stopped.completedSessions.length, 1);

  const summary = summarizeByIssue(stopped, '2026-02-17T11:15:00.000Z');
  assert.equal(summary.length, 1);
  assert.equal(summary[0].issueKey, 'JIRA-123');
  assert.equal(summary[0].totalSeconds, 3600);
});

test('starting a different issue auto-stops current running timer', () => {
  const s0 = createTimerState();
  const first = startTimer(
    s0,
    { issueId: '10001', issueKey: 'JIRA-123', summary: 'Build tracker' },
    '2026-02-17T10:00:00.000Z'
  );

  const second = startTimer(
    first,
    { issueId: '10002', issueKey: 'JIRA-456', summary: 'Fix bug' },
    '2026-02-17T10:10:00.000Z'
  );

  assert.equal(second.completedSessions.length, 1);
  assert.equal(second.completedSessions[0].issueKey, 'JIRA-123');
  assert.equal(second.activeSession?.issueKey, 'JIRA-456');
  assert.equal(second.activeSession?.state, 'Running');
});
