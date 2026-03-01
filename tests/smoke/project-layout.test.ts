import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const requiredFiles = [
  'package.json',
  'README.md',
  'src-tauri/Cargo.toml',
  'src-tauri/build.rs',
  'src-tauri/tauri.conf.json',
  'src-tauri/src/main.rs',
  'src-tauri/src/lib.rs'
];

test('project scaffold includes required Tracklet files', () => {
  for (const file of requiredFiles) {
    assert.equal(fs.existsSync(file), true, `Expected ${file} to exist`);
  }
});

test('README includes setup, verification, and MVP limitation guidance', () => {
  const readme = fs.readFileSync('README.md', 'utf8');
  assert.match(readme, /Development Prerequisites/i);
  assert.match(readme, /Verify/i);
  assert.match(readme, /Run/i);
  assert.match(readme, /MVP Limitations/i);
});

test('ui entrypoint uses browser-runnable JavaScript module path', () => {
  const html = fs.readFileSync('src/ui/index.html', 'utf8');
  assert.match(html, /<script type="module" src="\.\/main\.js"><\/script>/i);
});
