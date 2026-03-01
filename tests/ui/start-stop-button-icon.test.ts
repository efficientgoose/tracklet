import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('start button icon switches to stop-square when timer is active', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /className=\{`start-icon \$\{active \? 'stop' : 'play'\}`\}/);
});

test('stop icon style is rendered as a square block', () => {
  const css = fs.readFileSync('src/ui/styles.css', 'utf8');

  assert.match(css, /\.start-icon\.stop\s*\{/);
  assert.match(css, /width:\s*10px;/);
  assert.match(css, /height:\s*10px;/);
});
