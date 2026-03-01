import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('app defines a blue rounded tray timer badge style', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /MENU_BADGE_COLOR\s*=\s*['\"]#1868DB['\"]/i);
  assert.match(script, /MENU_BADGE_RADIUS\s*=\s*5/);
});

test('app syncs the active MM:SS display to the tray badge', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /setTrayTimerBadge\(/);
});

test('frontend API exposes tray badge update invoke command', () => {
  const api = fs.readFileSync('src/ui/api.ts', 'utf8');

  assert.match(api, /set_tray_timer_badge/);
});
