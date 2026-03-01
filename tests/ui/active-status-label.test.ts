import test from 'node:test';
import assert from 'node:assert/strict';
import { activeStatusLabel } from '../../src/ui/state.ts';

test('activeStatusLabel hides offline LOCAL session status text entirely', () => {
  const nowIso = '2026-02-22T10:00:00.000Z';
  const snapshot = {
    activeSession: {
      issueKey: 'LOCAL',
      segments: [
        {
          startedAt: nowIso,
          endedAt: nowIso
        }
      ]
    },
    completedSessions: []
  };

  assert.equal(activeStatusLabel(snapshot as any, nowIso), '');
});

test('activeStatusLabel keeps issue key for Jira sessions', () => {
  const nowIso = '2026-02-22T10:00:00.000Z';
  const snapshot = {
    activeSession: {
      issueKey: 'JIRA-123',
      segments: [
        {
          startedAt: nowIso,
          endedAt: nowIso
        }
      ]
    },
    completedSessions: []
  };

  assert.equal(activeStatusLabel(snapshot as any, nowIso), '0m - JIRA-123');
});
