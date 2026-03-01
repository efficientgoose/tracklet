import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const tauriConfigPath = 'src-tauri/tauri.conf.json';

test('tray icon uses generated clock asset and hides title text', () => {
  const config = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
  const trayIcon = config?.app?.trayIcon;

  assert.equal(trayIcon?.iconPath, 'icons/tray-clock-template.png');
  assert.equal(trayIcon?.iconAsTemplate, false);
  assert.equal(trayIcon?.title, '');
  assert.equal(fs.existsSync('clock-solid-full.svg'), true);
  assert.equal(fs.existsSync('src-tauri/icons/tray-clock-template.png'), true);
});
