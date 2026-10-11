import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateExceptions, validateTraces } from '../../scripts/quality/audit-exceptions.mjs';

const policy = JSON.parse(readFileSync(new URL('../../scripts/quality/audit-exceptions.json', import.meta.url)));
const manifest = { pnpm: { auditConfig: { ignoreGhsas: ['GHSA-vfj7-8cjw-p6xm'] } } };
const braces = { from: 'braces', version: '3.0.3' };
const parent = (name, child) => ({ dependencies: { [name]: child } });
const fullGraph = [{ name: '@agriclimax/web', devDependencies: { 'eslint-config-next': parent('@next/eslint-plugin-next', parent('fast-glob', parent('micromatch', parent('braces', braces)))) } }];
const valid = () => structuredClone({ policy, manifest, fullGraph, productionGraph: [], today: '2026-10-11' });

test('accepts only the approved exact lint chain/version within its lifetime', () => {
  assert.equal(validateExceptions(valid()).length, 1);
});
test('fails at expiry, before approval and on an unlimited extension', () => {
  for (const date of ['2026-11-10', '2026-11-11', '2026-10-10']) {
    const input = valid(); input.today = date;
    assert.throws(() => validateExceptions(input));
  }
  const input = valid(); input.policy.exceptions[0].expires_on = '2027-10-11';
  assert.throws(() => validateExceptions(input));
});
test('fails if another advisory or a broad CVE exclusion is configured', () => {
  const input = valid(); input.manifest.pnpm.auditConfig.ignoreGhsas.push('GHSA-other-advisory');
  assert.throws(() => validateExceptions(input));
  const broad = valid(); broad.manifest.pnpm.auditConfig.ignoreCves = ['CVE-2026-93687'];
  assert.throws(() => validateExceptions(broad));
});
test('fails when the same package enters production, changes version or introducer', () => {
  const production = valid(); production.productionGraph = production.fullGraph;
  assert.throws(() => validateExceptions(production));
  const changed = valid(); changed.fullGraph[0].devDependencies = { braces: { version: '3.0.4' } };
  assert.throws(() => validateExceptions(changed));
  const otherParent = valid(); otherParent.fullGraph[0].devDependencies = { braces };
  assert.throws(() => validateExceptions(otherParent));
});
test('fails on a stale exclusion and allows complete removal after an upgrade', () => {
  const input = valid(); input.fullGraph = [];
  assert.throws(() => validateExceptions(input));
  input.policy.exceptions = []; input.manifest.pnpm = {};
  assert.deepEqual(validateExceptions(input), []);
});
test('fails if braces is copied into any Next production server trace', () => {
  validateTraces([{ files: ['../../node_modules/next/dist/server/next-server.js'] }]);
  for (const file of ['../../node_modules/braces/index.js', '../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/index.js', '..\\node_modules\\braces\\index.js'])
    assert.throws(() => validateTraces([{ files: [file] }]));
  assert.throws(() => validateTraces([]));
  assert.throws(() => validateTraces([{}]));
});
