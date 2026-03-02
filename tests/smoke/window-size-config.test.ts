import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('main window size matches revamped UI shell dimensions', () => {
  const rust = fs.readFileSync('src-tauri/src/lib.rs', 'utf8');

  assert.match(rust, /const\s+MAIN_WINDOW_WIDTH:\s*f64\s*=\s*368\.0;/);
  assert.match(rust, /const\s+MAIN_WINDOW_HEIGHT:\s*f64\s*=\s*522\.0;/);
  assert.match(rust, /\.inner_size\(MAIN_WINDOW_WIDTH,\s*MAIN_WINDOW_HEIGHT\)/);
});
