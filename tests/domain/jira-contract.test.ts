import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeIssue,
  coerceSyncStatus,
  openAuthorizationUrl,
  isValidOAuthCallbackUrl,
  toErrorMessage
} from '../../src/ui/api.ts';

test('normalizeIssue maps Jira payload into UI issue model', () => {
  const raw = {
    id: '10001',
    key: 'JIRA-123',
    fields: {
      summary: 'Build tracker MVP',
      status: {
        statusCategory: {
          name: 'In Progress'
        }
      }
    }
  };

  const issue = normalizeIssue(raw);
  assert.deepEqual(issue, {
    issueId: '10001',
    issueKey: 'JIRA-123',
    summary: 'Build tracker MVP',
    statusCategory: 'In Progress'
  });
});

test('coerceSyncStatus produces stable status contract', () => {
  const status = coerceSyncStatus({
    authorized: true,
    ok: false,
    error: 'token_expired',
    lastSyncedAt: null
  });

  assert.deepEqual(status, {
    authorized: true,
    ok: false,
    error: 'token_expired',
    lastSyncedAt: null
  });

  const defaulted = coerceSyncStatus({});
  assert.deepEqual(defaulted, {
    authorized: false,
    ok: true,
    error: null,
    lastSyncedAt: null
  });
});

test('openAuthorizationUrl opens the URL when Tauri invoke is unavailable', async () => {
  const calls: Array<[string, string, string]> = [];
  const originalWindow = (globalThis as any).window;
  const originalOpen = (globalThis as any).open;

  (globalThis as any).window = undefined;
  (globalThis as any).open = (url: string, target: string, features: string) => {
    calls.push([url, target, features]);
    return null;
  };

  await openAuthorizationUrl('https://auth.atlassian.com/authorize');

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'https://auth.atlassian.com/authorize');
  assert.equal(calls[0][1], '_blank');

  (globalThis as any).open = originalOpen;
  (globalThis as any).window = originalWindow;
});

test('isValidOAuthCallbackUrl validates required query params', () => {
  assert.equal(
    isValidOAuthCallbackUrl('tracklet://oauth/callback?code=abc123&state=state-1'),
    true
  );
  assert.equal(isValidOAuthCallbackUrl('tracklet://oauth/callback?state=state-1'), false);
  assert.equal(isValidOAuthCallbackUrl('tracklet://oauth/callback?code=abc123'), false);
  assert.equal(isValidOAuthCallbackUrl('not-a-url'), false);
});

test('toErrorMessage handles string and structured errors', () => {
  assert.equal(toErrorMessage('OAuth state mismatch'), 'OAuth state mismatch');
  assert.equal(toErrorMessage({ message: 'Missing OAuth code' }), 'Missing OAuth code');
  assert.equal(toErrorMessage({ error: 'Timed out waiting for callback' }), 'Timed out waiting for callback');
  assert.equal(toErrorMessage(undefined), 'Unknown error');
});
