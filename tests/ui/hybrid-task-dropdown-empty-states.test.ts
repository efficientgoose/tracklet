import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('task control opens a custom dropdown list on focus/click', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /isTaskDropdownOpen/);
  assert.match(script, /onFocus=\{\(\) => \{\s*setIsTaskDropdownOpen\(true\)/);
  assert.match(script, /className="ticket-dropdown"/);
});

test('task dropdown shows Jira guidance and empty-state copy', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /Connect Jira to show tickets/);
  assert.match(script, /No tickets found for this Jira account/);
});

test('task dropdown styles include list container and state rows', () => {
  const css = fs.readFileSync('src/ui/styles.css', 'utf8');

  assert.match(css, /\.ticket-field\s*\{/);
  assert.match(css, /\.ticket-dropdown\s*\{/);
  assert.match(css, /\.ticket-state\s*\{/);
});
