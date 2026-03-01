import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('task dropdown input renders before duration controls in timer panel', () => {
  const script = fs.readFileSync('src/ui/App.tsx', 'utf8');
  const issueSelectIndex = script.indexOf('id="issueSelect"');
  const durationWrapIndex = script.indexOf('className="duration-wrap"');

  assert.notEqual(issueSelectIndex, -1);
  assert.notEqual(durationWrapIndex, -1);
  assert.ok(issueSelectIndex < durationWrapIndex);
});
