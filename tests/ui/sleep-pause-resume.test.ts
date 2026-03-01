import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('timer flow includes automatic sleep pause and wake resume handling', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');

  assert.match(script, /pauseTimer/);
  assert.match(script, /resumeTimer/);
  assert.match(script, /SLEEP_GAP_THRESHOLD_MS/);
  assert.match(script, /lastCountdownTickMsRef/);
  assert.match(script, /pauseTimer\(new Date\(inferredSleepStartMs\)\.toISOString\(\)\)/);
  assert.match(script, /resumeTimer\(new Date\(nowMs\)\.toISOString\(\)\)/);
});
