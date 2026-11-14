/** Explicit offline runner: reads versioned archives, writes only AGRO-03 evidence. */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync, createGzip } from "node:zlib";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { AGRO03_VERSION, AGRO03_PRODUCTIONS, AGRO03_RECIPES, AGRONOMY, REFERENCES, NEW_RECIPES, computeAgro03 } from "../apps/web/features/multiproduction/agro03";
import { computeBatch, type ProductionDay } from "../apps/web/features/multiproduction/engine";
import { RECIPES, PRODUCTIONS } from "../apps/web/features/multiproduction/registry";
import geography from "../apps/web/data/operational/pra-watch-places.json";
import { RULES } from "../apps/web/features/agroclimatic/catalogue";
import { strict as assert } from "node:assert";

async function storageSize(batch: ReturnType<typeof computeBatch>) {
  // Stream repeated results: materializing a national 30-day JSON string can
  // exceed V8's string limit despite the engine sharing its results in memory.
  const compressor = createGzip();
  let bytes = 0, compressed = 0;
  compressor.on("data", (chunk: Buffer) => { compressed += chunk.length; });
  for (const m of batch.measurements) {
    const line = JSON.stringify(m) + "\n";
    bytes += Buffer.byteLength(line);
    if (!compressor.write(line)) await once(compressor, "drain");
  }
  compressor.end();
  await once(compressor, "end");
  return { jsonl_bytes: bytes, gzip_bytes: compressed };
}
async function main() {
const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, "docs/codex/AGRO-03/evidence");
mkdirSync(output, { recursive: true });
const inputPath = "docs/codex/CORE-01/evidence/frozen-inputs.json.gz";
const raw = readFileSync(resolve(root, inputPath));
const frozen = JSON.parse(gunzipSync(raw).toString()) as { inputs: Record<string, Record<string, ProductionDay[]>> };
const praIds = geography.places.map(p => p.id);
const cases: {input: string; pra: string; period: [string,string]; recipe: string; value: number|null; observed: number|null; state: string|undefined}[] = [];
const matrices: unknown[] = [], samples: unknown[] = [], metrics: unknown[] = [];
const selected = ["pra:28341", "pra:29102", "pra:05236", "pra:2A259", "pra:50086"];
assert(selected.every(id => praIds.includes(id)));
let baselineChecks = 0;
const began = performance.now();
for (const [nature, start, end] of [
  ["reanalysis", "2026-11-01", "2026-11-01"],
  ["reanalysis", "2026-10-26", "2026-11-01"],
  ["reanalysis", "2026-10-19", "2026-11-01"],
  ["reanalysis", "2026-10-03", "2026-11-01"],
  ["forecast", "2026-11-08", "2026-11-08"],
  ["forecast", "2026-11-08", "2026-11-14"],
]) {
  const period: [string,string] = [start, end];
  const inputKey = (variables: readonly string[]) => {
    const variable = variables.includes("humidity") ? "temperature" : variables[0];
    const direct = `${nature}/${start}/${end}/${variable}`;
    return frozen.inputs[direct] ? direct : `${nature}/${nature === "reanalysis" ? "2026-10-03" : "2026-11-08"}/${end}/${variable}`;
  };
  const provider = (pra: string, variables: readonly string[]) => (frozen.inputs[inputKey(variables)]?.[pra] ?? []).filter(d => d.date >= start && d.date <= end);
  const t = performance.now();
  const batch = computeAgro03(praIds, period, provider);
  const ms = performance.now() - t;
  const baseline = computeBatch(praIds, period, provider);
  const lookup = new Map(batch.measurements.map(m => [`${m.production}/${m.indicator}/${m.result.territoryId}`, m]));
  for (const old of baseline.measurements) {
    const current = lookup.get(`${old.production}/${old.indicator}/${old.result.territoryId}`)!;
    assert.deepEqual({ ...current.result, rule_version: old.result.rule_version }, old.result);
    baselineChecks++;
  }
  const unique = new Map(batch.measurements.map(m => [`${m.indicator}/${m.result.territoryId}`, m]));
  for (const m of unique.values()) {
    const r = AGRO03_RECIPES.find(r => r.id === m.indicator)!;
    cases.push({input: inputKey(r.kernel.variables), pra: m.result.territoryId, period, recipe: m.indicator, value: m.result.value, observed: m.result.observed_value ?? null, state: m.result.quality?.state});
    if (selected.includes(m.result.territoryId) && NEW_RECIPES.some(r => r.id === m.indicator)) samples.push({ place: geography.places.find(p => p.id === m.result.territoryId), ...m });
  }
  for (const r of AGRO03_RECIPES) {
    const results = [...unique.values()].filter(m => m.indicator === r.id).map(m => m.result);
    const states: Record<string,number> = {}, reasons: Record<string,number> = {};
    for (const result of results) {
      const state = result.quality?.state ?? "unknown";
      states[state] = (states[state] ?? 0) + 1;
      if (result.reason) reasons[result.reason] = (reasons[result.reason] ?? 0) + 1;
    }
    assert.equal(results.length, 713);
    matrices.push({indicator: r.id, nature, period, states, reasons, total: results.length});
  }
  metrics.push({nature, period, milliseconds: ms, ...batch.metrics, measurements: batch.measurements.length, storage: await storageSize(batch), baseline_storage: await storageSize(baseline)});
}
const oracle = spawnSync("python", [resolve(root, "docs/codex/AGRO-03/reference.py")], {
  input: JSON.stringify({ inputs: frozen.inputs, cases, rules: Object.fromEntries(AGRO03_RECIPES.map(r => [r.id, r.kernel])) }),
  encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
});
assert.equal(oracle.status, 0, oracle.stdout + oracle.stderr);
const report = {
  version: AGRO03_VERSION, executed_at: new Date().toISOString(),
  source: {path: inputPath, sha256: createHash("sha256").update(raw).digest("hex"), nature: "Frozen operational archive replay; no assertion of current live availability"},
  independent: JSON.parse(oracle.stdout), baseline_result_checks: baselineChecks,
  baseline: {recipes: RECIPES.length, productions: PRODUCTIONS.length, active_indicators: RULES.length},
  extension: {recipes: AGRO03_RECIPES.length, new_recipes: NEW_RECIPES.length, productions: AGRO03_PRODUCTIONS.length},
  selected_places: geography.places.filter(p => selected.includes(p.id)), metrics,
  elapsed_ms: performance.now() - began, peak_rss_bytes: process.resourceUsage().maxRSS * 1024,
  network_calls: 0, remote_writes: 0, production_activation: false,
};
for (const [name, value] of Object.entries({ report, matrix: matrices, catalogue: {version: AGRO03_VERSION, productions: AGRO03_PRODUCTIONS, recipes: AGRO03_RECIPES, agronomy: AGRONOMY, references: REFERENCES} })) writeFileSync(resolve(output, `${name}.json`), JSON.stringify(value, null, 2) + "\n");
writeFileSync(resolve(output, "samples.json.gz"), gzipSync(JSON.stringify(samples) + "\n"));
console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
