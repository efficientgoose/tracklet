import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('desktop CSS uses the revamped frosted widget styling', () => {
  const css = fs.readFileSync('src/ui/styles.css', 'utf8');

  assert.match(css, /--brand:\s*#007aff/i);
  assert.match(css, /backdrop-filter:\s*blur\(3px\)/i);
});

test('tauri window starts as a regular desktop app window', () => {
  const rust = fs.readFileSync('src-tauri/src/lib.rs', 'utf8');
  assert.match(rust, /\.decorations\(true\)/);
  assert.match(rust, /\.visible\(true\)/);
  assert.doesNotMatch(rust, /ActivationPolicy::Accessory/);
  assert.doesNotMatch(rust, /set_dock_visibility\(false\)/);
  assert.doesNotMatch(rust, /WindowEvent::Focused\(false\)/);
});
