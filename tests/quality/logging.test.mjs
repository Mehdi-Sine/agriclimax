import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLogger } from '../../scripts/quality/logging.mjs';
test('logs allowlisted context and drops raw credentials/PII/errors', () => {
  const lines = [];
  createLogger((line) => lines.push(line))({
    level: 'error', event: 'fetch.failed', run_id: 'run-001', demo: true,
    error_code: 'UPSTREAM_TIMEOUT', duration_ms: 10,
    authorization: 'sensitive', email: 'person@example.test', error: new Error('sensitive'),
  });
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.error_code, 'UPSTREAM_TIMEOUT');
  assert.equal(entry.demo, true);
  assert.equal(entry.duration_ms, 10);
  assert.ok(!lines[0].includes('sensitive'));
  assert.ok(!lines[0].includes('person@'));
  assert.ok(!Number.isNaN(Date.parse(entry.timestamp)));
});
test('rejects unsafe identifiers and invalid metadata', () => {
  const log = createLogger(() => {});
  for (const change of [{event:'line\ninjection'}, {level:'debug'}, {error_code:'oops'}, {duration_ms:-1}]) {
    assert.throws(() => log({level:'info', event:'job.complete', run_id:'run-1', ...change}));
  }
});
