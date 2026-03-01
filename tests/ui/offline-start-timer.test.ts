import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('timer can start without a selected Jira issue by using fallback issue metadata', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /const\s+LOCAL_FALLBACK_ISSUE\s*=\s*\{/);
  assert.match(script, /const\s+issueToStart\s*=\s*selectedIssue\s*\?\?\s*LOCAL_FALLBACK_ISSUE/);
  assert.match(script, /await\s+startTimer\(issueToStart\)/);
});
