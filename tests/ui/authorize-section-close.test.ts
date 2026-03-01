import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('header includes settings trigger and settings modal visibility state', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /isSettingsOpen/);
  assert.match(script, /setIsSettingsOpen\(true\)/);
  assert.match(script, /className="settings-btn"/);
  assert.match(script, /className="settings-overlay"/);
});

test('settings overlay uses blurred backdrop and dedicated modal shell', () => {
  const css = fs.readFileSync('src/ui/styles.css', 'utf8');

  assert.match(css, /\.settings-overlay\s*\{/);
  assert.match(css, /\.settings-backdrop-overlay\s*\{/);
  assert.match(css, /backdrop-filter:\s*blur\(3px\)/);
  assert.match(css, /\.settings-modal\s*\{/);
});
