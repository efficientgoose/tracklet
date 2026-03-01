import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('start button label switches between Start and Stop based on active timer session', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /aria-label=\{active \? 'Stop timer' : 'Start timer'\}/);
  assert.match(script, /\{active \? 'Stop' : 'Start'\}/);
});

test('timer actions include separate reset and primary start button styles', () => {
  const css = fs.readFileSync('src/ui/styles.css', 'utf8');

  assert.match(css, /\.reset-btn,\s*[\n\r]*\.start-btn\s*\{/);
  assert.match(css, /\.start-btn\s*\{/);
  // Dynamic box-shadow is now applied inline via accentColor
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');
  assert.match(script, /boxShadow.*accentColor/);
});
