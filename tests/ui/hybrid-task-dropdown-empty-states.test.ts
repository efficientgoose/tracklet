import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('ticket control opens a custom dropdown list from trigger button', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /isTicketDropdownOpen/);
  assert.match(script, /ticket-trigger/);
  assert.match(script, /ticket-dropdown/);
});

test('task dropdown shows Jira guidance and empty-state copy', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /Connect Jira to track tickets/);
  assert.match(script, /No tickets found for this Jira account/);
});

test('task dropdown styles include list container and state rows', () => {
  const css = fs.readFileSync('src/ui/styles.css', 'utf8');

  assert.match(css, /\.ticket-field\s*\{/);
  assert.match(css, /\.ticket-dropdown\s*\{/);
  assert.match(css, /\.ticket-state\s*\{/);
});
