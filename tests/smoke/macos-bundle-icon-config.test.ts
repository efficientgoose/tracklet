import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('macOS bundle icon config includes icns file', () => {
  const config = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'));
  const icons = config?.bundle?.icon ?? [];

  assert.equal(Array.isArray(icons), true);
  assert.equal(icons.includes('icons/icon.icns'), true);
  assert.equal(fs.existsSync('src-tauri/icons/icon.icns'), true);
});
