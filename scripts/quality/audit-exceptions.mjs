import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const GHSA = 'GHSA-vfj7-8cjw-p6xm';
const CHAIN = ['eslint-config-next', '@next/eslint-plugin-next', 'fast-glob', 'micromatch', 'braces'];

export function bracesPaths(projects) {
  const found = [];
  function walk(nodes, parent, project, group) {
    for (const [name, node] of Object.entries(nodes ?? {})) {
      const chain = [...parent, name];
      if (name === 'braces' || node.from === 'braces') found.push({ project, group, chain, version: node.version });
      for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) walk(node[field], chain, project, group);
    }
  }
  for (const project of projects) for (const group of ['dependencies', 'devDependencies', 'optionalDependencies'])
    walk(project[group], [], project.name, group);
  return found;
}

export function validateExceptions({ policy, manifest, fullGraph, productionGraph, today = new Date().toISOString().slice(0, 10) }) {
  const ignores = manifest.pnpm?.auditConfig?.ignoreGhsas ?? [];
  assert.deepEqual(Object.keys(manifest.pnpm?.auditConfig ?? {}).sort(), ignores.length ? ['ignoreGhsas'] : [], 'No broad audit exclusions permitted');
  assert.ok(Array.isArray(policy.exceptions), 'Exception policy required');
  if (policy.exceptions.length === 0) { assert.deepEqual(ignores, []); return []; }
  assert.equal(policy.exceptions.length, 1, 'Only the reviewed braces exception is authorized');
  assert.deepEqual(ignores, [GHSA], 'Native pnpm exclusions must match the exact reviewed GHSA');
  const entry = policy.exceptions[0];
  assert.equal(entry.package, 'braces'); assert.equal(entry.version, '3.0.3');
  assert.equal(entry.ghsa, GHSA); assert.equal(entry.cve, 'CVE-2026-93687');
  for (const field of ['owner', 'scope', 'justification', 'reevaluate']) assert.ok(typeof entry[field] === 'string' && entry[field].length > 0);
  for (const date of [entry.approved_on, entry.expires_on, today])
    assert.ok(typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date, 'Valid calendar date required');
  assert.ok(entry.approved_on <= today && today < entry.expires_on, 'Exception not yet valid or expired: reevaluate; do not bypass the audit');
  assert.ok(Date.parse(entry.expires_on) - Date.parse(entry.approved_on) > 0 && Date.parse(entry.expires_on) - Date.parse(entry.approved_on) <= 30 * 86400000, 'Exception is limited to 30 days');
  assert.deepEqual(bracesPaths(productionGraph), [], 'braces must never become a production dependency');
  const paths = bracesPaths(fullGraph);
  assert.ok(paths.length > 0, 'Exception is stale: remove it when the dependency disappears');
  for (const item of paths) {
    assert.equal(item.project, '@agriclimax/web'); assert.equal(item.group, 'devDependencies');
    assert.equal(item.version, entry.version, 'Changed version requires reevaluation');
    assert.deepEqual(item.chain, CHAIN, 'Changed introducer requires reevaluation');
  }
  return paths;
}

export function validateTraces(traces) {
  assert.ok(traces.length > 0, 'Production build traces required');
  for (const trace of traces) {
    assert.ok(Array.isArray(trace.files), 'Malformed Next output trace');
    for (const file of trace.files) assert.ok(!/(?:^|[/\\])braces(?:@[^/\\]+)?(?:[/\\]|$)/.test(file), 'braces found in production server output trace');
  }
}

function traceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? traceFiles(file) : entry.name.endsWith('.nft.json') ? [file] : [];
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const read = file => JSON.parse(readFileSync(path.join(ROOT, file), 'utf8'));
  const why = args => JSON.parse(execFileSync('pnpm', ['--recursive', 'why', ...args, 'braces', '--json'], { cwd: ROOT, encoding: 'utf8' }));
  const paths = validateExceptions({ policy: read('scripts/quality/audit-exceptions.json'), manifest: read('package.json'), fullGraph: why([]), productionGraph: why(['--prod']) });
  let traces = 0;
  if (process.argv.includes('--build')) {
    const files = traceFiles(path.join(ROOT, 'apps/web/.next'));
    validateTraces(files.map(file => JSON.parse(readFileSync(file, 'utf8'))));
    traces = files.length;
  }
  console.log(JSON.stringify({ exception: paths.length ? GHSA : null, paths, productionBracesPaths: 0, serverTracesChecked: traces }));
}
