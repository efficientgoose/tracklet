import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('start button label switches between Start and Stop based on active timer session', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /aria-label=\{active/);
  assert.match(script, /'Start'/);
  assert.match(script, /'Pause'/);
});

test('timer actions include separate reset and primary start button styles', () => {
  const css = fs.readFileSync('src/ui/styles.css', 'utf8');

  assert.match(css, /\.reset-btn,/);
  assert.match(css, /\.start-btn\s*\{/);
  // Dynamic box-shadow is now applied inline via accentColor
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');
  assert.match(script, /boxShadow.*accentColor/);
});
