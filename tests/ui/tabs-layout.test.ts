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

test('revamped app renders widget header and ring timer shell', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /className="widget-header"/);
  assert.match(script, /Tracklet/);
  assert.match(script, /className="ring-wrap"/);
});

test('header switches between Jira chip and Connect Jira entry point by auth state', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /jiraAuthorized\s*\?/);
  assert.match(script, /className="jira-chip"/);
  assert.match(script, /Connect Jira/);
});
