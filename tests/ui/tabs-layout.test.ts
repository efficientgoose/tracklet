import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('ui includes timer and analytics tab controls', () => {
  const html = fs.readFileSync('src/ui/index.html', 'utf8');

  assert.match(html, /id="root"/);
});

test('app initializes timer tab as default view', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /useState(?:<[^>]+>)?\(\s*'timer'\s*\)/);
});

test('app uses Font Awesome clock icon for idle timer state', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /FontAwesomeIcon/);
  assert.match(script, /byPrefixAndName\.fas\['clock'\]/);
});

test('connect Jira button only renders when the user is not authorized', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /!jiraAuthorized\s*&&\s*\(/);
});
