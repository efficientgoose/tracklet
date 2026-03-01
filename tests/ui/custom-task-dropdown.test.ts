import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('ticket control supports dropdown search when Jira is authorized', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /isTicketDropdownOpen/);
  assert.match(script, /ticket-trigger/);
  assert.match(script, /placeholder="Search tickets\.\.\."/);
});

test('start timer uses fallback issue metadata when no Jira ticket is selected', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /const\s+LOCAL_FALLBACK_ISSUE\s*=\s*\{/);
  assert.match(script, /const\s+issueToStart\s*=\s*selectedIssue\s*\?\?\s*LOCAL_FALLBACK_ISSUE/);
  assert.match(script, /await\s+startTimer\(issueToStart\)/);
});

test('ticket dropdown rows show key and summary text slots', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /className="ticket-key"/);
  assert.match(script, /className="ticket-summary"/);
});
