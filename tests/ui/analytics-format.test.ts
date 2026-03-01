import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateAnalytics, formatDuration } from '../../src/ui/state.ts';

test('formatDuration creates compact human-readable output', () => {
  assert.equal(formatDuration(45), '0m');
  assert.equal(formatDuration(3600), '1h 0m');
  assert.equal(formatDuration(9240), '2h 34m');
});

test('aggregateAnalytics groups sessions by issue key', () => {
  const snapshot = {
    activeSession: null,
    completedSessions: [
      {
        issueKey: 'JIRA-123',
        issueId: '10001',
        summary: 'Build tracker',
        segments: [
          { startedAt: '2026-02-17T10:00:00.000Z', endedAt: '2026-02-17T10:30:00.000Z' }
        ]
      },
      {
        issueKey: 'JIRA-123',
        issueId: '10001',
        summary: 'Build tracker',
        segments: [
          { startedAt: '2026-02-17T10:45:00.000Z', endedAt: '2026-02-17T11:15:00.000Z' }
        ]
      },
      {
        issueKey: 'JIRA-456',
        issueId: '10002',
        summary: 'Fix bug',
        segments: [
          { startedAt: '2026-02-17T11:15:00.000Z', endedAt: '2026-02-17T11:30:00.000Z' }
        ]
      }
    ]
  };

  const rows = aggregateAnalytics(snapshot, '2026-02-17T11:30:00.000Z');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].issueKey, 'JIRA-123');
  assert.equal(rows[0].totalSeconds, 3600);
  assert.equal(rows[1].issueKey, 'JIRA-456');
  assert.equal(rows[1].totalSeconds, 900);
});
