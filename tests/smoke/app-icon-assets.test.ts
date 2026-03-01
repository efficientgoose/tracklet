import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('macOS app icon asset is a valid icns file (not placeholder text)', () => {
  const icnsPath = 'src-tauri/icons/icon.icns';
  assert.equal(fs.existsSync(icnsPath), true);

  const data = fs.readFileSync(icnsPath);
  assert.equal(data.length > 8, true, 'icon.icns should be binary data');
  assert.equal(data.subarray(0, 4).toString('ascii'), 'icns');
});
