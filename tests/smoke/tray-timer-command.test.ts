import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('tauri backend exposes set_tray_timer_badge command', () => {
  const rust = fs.readFileSync('src-tauri/src/lib.rs', 'utf8');

  assert.match(rust, /fn\s+set_tray_timer_badge\s*\(/);
  assert.match(rust, /set_tray_timer_badge/);
});
