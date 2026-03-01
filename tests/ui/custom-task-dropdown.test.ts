import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('task control supports typing custom tasks through text input', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /<input[\s\S]*id="issueSelect"[\s\S]*type="text"/);
  assert.match(script, /setTaskInput\(value\)/);
  assert.match(script, /findIssueByTaskInput\(value,\s*issues\)/);
});

test('start timer uses custom task issue when typed task is not a Jira option', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /const\s+customTaskSummary\s*=\s*taskInput\.trim\(\)/);
  assert.match(script, /buildCustomIssue\(customTaskSummary\)/);
  assert.match(
    script,
    /selectedIssue\s*\?\?\s*\(customTaskSummary\s*\?\s*buildCustomIssue\(customTaskSummary\)\s*:\s*LOCAL_FALLBACK_ISSUE\)/
  );
});

test('task dropdown includes a create-task row for typed custom input', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /Create task &quot;\{customTaskSummary\}&quot;/);
  assert.match(script, /const\s+showCreateTaskOption\s*=\s*customTaskSummary\.length\s*>\s*0/);
});

test('pressing Enter in task input accepts typed task without clicking dropdown row', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /if\s*\(event\.key\s*===\s*'Enter'\)/);
  assert.match(script, /event\.preventDefault\(\)/);
  assert.match(script, /setSelectedIssueId\(''\)/);
  assert.match(script, /setTaskInput\(taskInput\.trim\(\)\)/);
  assert.match(script, /closeTaskDropdown\(\)/);
});
