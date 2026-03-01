import test from 'node:test';
import assert from 'node:assert/strict';
import { startTimer } from '../../src/ui/api.ts';

test('startTimer sends snake_case issue payload for Rust command deserialization', async () => {
  const calls: Array<{ command: string; args: Record<string, unknown> }> = [];
  (globalThis as any).window = {
    __TAURI__: {
      core: {
        invoke: async (command: string, args: Record<string, unknown>) => {
          calls.push({ command, args });
          return { active_session: null, completed_sessions: [] };
        }
      }
    }
  };

  await startTimer(
    {
      issueId: 'local-session',
      issueKey: 'LOCAL',
      summary: 'Local focus session'
    },
    '2026-02-22T00:00:00.000Z'
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, 'start_timer');
  assert.deepEqual(calls[0].args, {
    issue: {
      issue_id: 'local-session',
      issue_key: 'LOCAL',
      summary: 'Local focus session'
    },
    at: '2026-02-22T00:00:00.000Z'
  });
});
