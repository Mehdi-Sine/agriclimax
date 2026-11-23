/** Replay retained national archives through the operational reader. Read-only. */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { FIELD_RULES, RULES } from "../apps/web/features/agroclimatic/catalogue";
import { agroclimaticData, type AgroPayload } from "../apps/web/lib/server/agroclimatic";
import { archiveCatalogue } from "../apps/web/lib/server/weather-archives";
import geography from "../apps/web/data/operational/pra-watch-places.json";

const out = process.argv[2] ?? "work/agro05";
const report: object[] = [];
const matrix: string[] = ["indicator,temporal,start,end,pra,value,observed_value,coverage_state,reason"];
const failures: { query: string; error: string }[] = [];
const places = new Map(geography.places.map(pra => [pra.id, pra]));

function record(payload: AgroPayload, elapsedMs: number) {
  assert.equal(payload.data.length, 713);
  assert.equal(new Set(payload.data.map(row => row.territoryId)).size, 713);
  const evaluable = payload.data.filter(row => row.value !== null);
  const values = evaluable.map(row => row.value!);
  const parts = payload.data.filter(row => row.value === null && row.observed_value != null);
  const { rule, temporal, run, period: { start, end }, source_version } = payload;
  for (const row of payload.data) {
    matrix.push([rule.id, temporal, start, end, row.territoryId, row.value, row.observed_value,
      row.quality?.state, row.reason].join(","));
  }
  report.push({
    indicator: rule.id, temporal, run, start, end, source_version,
    evaluable: evaluable.length, partial_only: parts.length,
    no_value: payload.data.length - evaluable.length - parts.length,
    min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null,
    payload_bytes: Buffer.byteLength(JSON.stringify(payload)),
    calculation_ms: Math.round(payload.calculation_ms),
    elapsed_ms: Math.round(elapsedMs),
    coastal: payload.data.filter(row =>
      ["pra:29102", "pra:29101", "pra:17111", "pra:33115", "pra:13469", "pra:83469"].includes(row.territoryId)
      || places.get(row.territoryId)?.region === "Corse",
    ).map(row => ({
      id: row.territoryId, value: row.value, portion: row.observed_value ?? null,
      state: row.quality?.state, reason: row.reason, fraction: row.spatial_coverage,
    })),
  });
}

async function replay(params: Record<string, string>, optional = false) {
  const query = new URLSearchParams(params);
  const began = performance.now();
  for (let attempt = 1; ; attempt++) {
    try {
      const payload = await agroclimaticData(query);
      record(payload, performance.now() - began);
      console.log(params.indicator, params.temporal ?? "history", params.start, params.end);
      return payload;
    } catch (error) {
      if (attempt === 1) continue;
      if (!optional) throw new Error(query.toString(), { cause: error });
      failures.push({ query: query.toString(), error: String(error) });
      console.warn(query.toString(), String(error));
      return null;
    }
  }
}

async function main() {
  mkdirSync(out, { recursive: true });
  const catalogue = await archiveCatalogue();
  const availableSeasons = [...new Set([
    ...catalogue?.era5.flatMap(entry => entry.dates) ?? [],
    ...catalogue?.weather.flatMap(entry => entry.dates) ?? [],
  ].map(date => date.slice(0, 7)))].sort();
  const run = catalogue?.weather.filter(entry => entry.run_date && entry.method_version === "pra-national-weather-daily-1")
    .sort((a, b) => b.run_date!.localeCompare(a.run_date!))[0];
  const firstLead = run?.run_date && new Date(Date.parse(run.run_date) + 86400000).toISOString().slice(0, 10);
  const summaries = [];
  for (const [start, end] of [["2026-10-24", "2026-10-30"], ["2026-11-10", "2026-11-16"], ["2026-10-01", "2026-10-30"]]) {
    for (const rule of FIELD_RULES) {
      const payload = await replay({ indicator: rule.id, start, end, summary: "1", compare: "previous" });
      assert.ok(payload?.summary);
      summaries.push(payload.summary);
    }
  }
  for (const rule of RULES) {
    await replay({ indicator: rule.id, start: "2026-10-24", end: "2026-10-30" });
    if (firstLead && run?.run_date) {
      await replay({ indicator: rule.id, temporal: "forecast", run: run.run_date, start: firstLead, end: firstLead }, true);
    }
  }
  writeFileSync(join(out, "rejeu.json"), JSON.stringify({ archiveMonths: availableSeasons, failures, report }, null, 2) + "\n");
  writeFileSync(join(out, "syntheses.json"), JSON.stringify(summaries, null, 2) + "\n");
  writeFileSync(join(out, "couverture-par-pra.csv.gz"), gzipSync(matrix.join("\n") + "\n"));
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
