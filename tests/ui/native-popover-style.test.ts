import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('desktop CSS uses solid surfaces without translucent effects', () => {
  const css = fs.readFileSync('src/ui/styles.css', 'utf8');

  assert.match(css, /--ds-bg:\s*#f4f5f7/i);
  assert.match(css, /font-family:\s*var\(--ds-font\)/i);
  assert.doesNotMatch(css, /backdrop-filter/i);
  assert.doesNotMatch(css, /rgba\(/i);
  assert.doesNotMatch(css, /transparent/i);
});

test('tauri window starts as a regular desktop app window', () => {
  const rust = fs.readFileSync('src-tauri/src/lib.rs', 'utf8');
  assert.match(rust, /\.decorations\(true\)/);
  assert.match(rust, /\.visible\(true\)/);
  assert.doesNotMatch(rust, /ActivationPolicy::Accessory/);
  assert.doesNotMatch(rust, /set_dock_visibility\(false\)/);
  assert.doesNotMatch(rust, /WindowEvent::Focused\(false\)/);
});
