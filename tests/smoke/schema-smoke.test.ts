import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migrationPath = 'src-tauri/migrations/0001_init.sql';

test('initial migration defines required Tracklet tables', () => {
  assert.equal(fs.existsSync(migrationPath), true, 'Expected migration file to exist');

  const sql = fs.readFileSync(migrationPath, 'utf8');

  const requiredTables = [
    'jira_accounts',
    'jira_issues',
    'time_sessions',
    'session_segments',
    'app_settings'
  ];

  for (const table of requiredTables) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`, 'i'));
  }

  assert.match(sql, /cloud_id/i);
  assert.match(sql, /issue_key/i);
  assert.match(sql, /started_at/i);
  assert.match(sql, /ended_at/i);
  assert.match(sql, /reason/i);
});
