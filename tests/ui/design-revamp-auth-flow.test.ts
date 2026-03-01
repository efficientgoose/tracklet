import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('timer screen keeps two Jira connect entry points wired to the same authorize flow', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /Connect Jira/);
  assert.match(script, /Connect Jira to track tickets/);
  assert.match(script, /onClick=\{handleAuthorize\}/);
});

test('settings modal is timer-only and does not include a Jira tab', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /Settings/);
  assert.match(script, /Duration/);
  assert.match(script, /Auto-start/);
  assert.doesNotMatch(script, /\(\['timer',\s*'jira'\]/);
  assert.doesNotMatch(script, /API Token|Refresh Tickets|Disconnect/);
});
