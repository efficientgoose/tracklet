import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const requiredTsFiles = [
  'tsconfig.json',
  'src/domain/timer_state_machine.ts',
  'src/ui/api.ts',
  'src/ui/App.tsx',
  'src/ui/main.tsx',
  'src/ui/state.ts',
  'tests/domain/jira-contract.test.ts',
  'tests/domain/timer-state-machine.test.ts',
  'tests/ui/analytics-format.test.ts',
  'tests/smoke/project-layout.test.ts',
  'tests/smoke/schema-smoke.test.ts',
  'tests/smoke/typescript-layout.test.ts'
];

const forbiddenJsFiles = [
  'src/domain/timer_state_machine.js',
  'src/ui/api.js',
  'src/ui/app.ts',
  'src/ui/app.js',
  'src/ui/state.js',
  'tests/domain/jira-contract.test.js',
  'tests/domain/timer-state-machine.test.js',
  'tests/ui/analytics-format.test.js',
  'tests/smoke/project-layout.test.js',
  'tests/smoke/schema-smoke.test.js',
  'tests/smoke/typescript-layout.test.js'
];

test('project uses TypeScript source and tests project-wide', () => {
  for (const file of requiredTsFiles) {
    assert.equal(fs.existsSync(file), true, `Expected ${file} to exist`);
  }

  for (const file of forbiddenJsFiles) {
    assert.equal(fs.existsSync(file), false, `Expected ${file} to be removed`);
  }
});
