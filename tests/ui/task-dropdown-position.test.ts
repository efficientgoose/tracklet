import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('ticket dropdown renders after timer actions in revamped timer panel', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');
  const ticketFieldIndex = script.indexOf('className="ticket-field"');
  const timerActionsIndex = script.indexOf('className="timer-actions"');

  assert.notEqual(ticketFieldIndex, -1);
  assert.notEqual(timerActionsIndex, -1);
  assert.ok(ticketFieldIndex > timerActionsIndex);
});
