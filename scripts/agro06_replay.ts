/** Rejoue les archives déjà acquises. Aucune écriture distante. */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { AGRO06_RULES } from "../apps/web/features/agroclimatic/analysis-catalogue";
import { calendarDays } from "../apps/web/features/national/daily-availability";
import { agroclimaticData } from "../apps/web/lib/server/agroclimatic";
import { climateHistoryWindow } from "../apps/web/lib/server/climate-history";
import { archiveCatalogue, type ArchivedDaily } from "../apps/web/lib/server/weather-archives";

const regions = {
  "pra:28342": "Beauce, grandes cultures",
  "pra:71187": "Charollais, élevage",
  "pra:33128": "Côtes du Bordelais, viticulture",
  "pra:84467": "Comtat, arboriculture",
  "pra:29102": "Crozon, littoral",
  "pra:06249": "Littoral niçois",
  "pra:06250": "Alpes niçoises",
  "pra:73229": "Maurienne, montagne",
  "pra:2A258": "Littoral corse",
  "pra:2B260": "Montagne corse",
};
const windows = [
  ["2026-10-24", "2026-10-30"],
  ["2026-11-10", "2026-11-16"],
  ["2026-10-01", "2026-10-30"],
];
const count = (items: boolean[]) => items.filter(Boolean).length;
const longest = (items: boolean[]) => Math.max(...items.map(Number).join("").split("0").map(run => run.length));
function reference(id: string, days: ArchivedDaily[]) {
  const rain = days.map(day => day.precipitation!);
  const wet = rain.filter(amount => amount >= 1);
  switch (id) {
    case "wet_days1": return wet.length;
    case "wet_sequence1": return longest(rain.map(amount => amount >= 1));
    case "rain10_days": return count(rain.map(amount => amount >= 10));
    case "rain_max1day": return Math.max(...rain);
    case "wet_total1": return wet.reduce((sum, amount) => sum + amount, 0);
    case "wet_intensity1": return wet.length ? wet.reduce((sum, amount) => sum + amount, 0) / wet.length : null;
    case "warm_nights20": return count(days.map(day => day.temperature_min! > 20));
    case "warm_nights20_sequence": return longest(days.map(day => day.temperature_min! > 20));
    case "ice_days": return count(days.map(day => day.temperature_max! < 0));
    case "ice_sequence": return longest(days.map(day => day.temperature_max! < 0));
    default: throw Error(id);
  }
}

const fetchOriginal = globalThis.fetch;
const storageReads: { kind: string; status: number; contentLength: number | null }[] = [];
globalThis.fetch = async (input, init) => {
  const response = await fetchOriginal(input, init);
  const url = new URL(input instanceof Request ? input.url : input);
  const match = url.pathname.match(/^\/storage\/v1\/object\/pra-climate-archives\/([^/]+)/);
  if (match) {
    const length = response.headers.get("content-length");
    storageReads.push({ kind: match[1], status: response.status, contentLength: length === null ? null : Number(length) });
  }
  return response;
};

async function main() {
  const out = process.argv[2] ?? "work/agro06";
  mkdirSync(out, { recursive: true });
  const archive = await archiveCatalogue();
  const reports = [];
  const syntheses = [];
  for (const [start, end] of windows) {
    if (!archive && start === "2026-11-10") continue;
    const dates = calendarDays(start, end);
    const dataByPra = new Map<string, ArchivedDaily[]>();
    for (const row of (await climateHistoryWindow(dates)).rows) {
      const series = dataByPra.get(row.pra_id) ?? [];
      series.push(row);
      dataByPra.set(row.pra_id, series);
    }
    assert.equal(dataByPra.size, 713);
    for (const rule of AGRO06_RULES) {
      const params = new URLSearchParams({ indicator: rule.id, start, end });
      const began = performance.now();
      const payload = await agroclimaticData(params);
      const elapsed = performance.now() - began;
      assert.equal(new Set(payload.data.map(row => row.territoryId)).size, 713);
      let crossChecks = 0;
      for (const row of payload.data) {
        if (row.support_scope !== "whole_pra" && !(row.reason === "no_wet_day" && (row.spatial_coverage ?? 0) >= 0.9999)) continue;
        const native = dataByPra.get(row.territoryId)!;
        assert.equal(native.length, dates.length);
        const values = native.map(day => day[rule.variables[0] as "precipitation" | "temperature_min" | "temperature_max"]);
        assert.ok(values.every(value => value !== null && Number.isFinite(value)), `${rule.id} ${start} ${row.territoryId} ${row.reason}`);
        const expected = reference(rule.id, native);
        if (expected === null) assert.equal(row.value, null);
        else assert.ok(row.value !== null && Math.abs(row.value - expected) < 1e-9);
        crossChecks++;
      }
      const summaryStart = performance.now();
      const exported = await agroclimaticData(new URLSearchParams({ indicator: rule.id, start, end, summary: "1" }));
      const summary = exported.summary!;
      const summaryMs = Math.round(performance.now() - summaryStart);
      assert.equal(summary.total_pra, 713);
      assert.equal(summary.distribution.reduce((sum, group) => sum + group.count, 0), summary.evaluable_pra);
      assert.equal(Object.values(summary.abstentions).reduce((sum, n) => sum + n, 0) + summary.evaluable_pra, 713);
      assert.ok(summary.map?.startsWith("/analyse?"));
      assert.equal(summary.anomaly.value, null);
      if (start === "2026-11-10") {
        const sample = await agroclimaticData(new URLSearchParams({ indicator: rule.id, start, end, summary: "1", compare: "previous" }));
        syntheses.push(sample.summary);
      } else if (!archive && start === "2026-10-24") syntheses.push(summary);
      const map = JSON.stringify(payload), compact = JSON.stringify(summary);
      reports.push({
        rule: rule.id, period: payload.period, sourceVersion: payload.source_version, historySeries: payload.history_series,
        crossChecks, evaluable: summary.evaluable_pra, abstentions: summary.abstentions,
        calculationMs: Math.round(payload.calculation_ms), routeMs: Math.round(elapsed),
        summaryMs,
        mapBytes: Buffer.byteLength(map), mapGzipBytes: gzipSync(map).length,
        summaryBytes: Buffer.byteLength(compact), summaryGzipBytes: gzipSync(compact).length,
        examples: Object.entries(regions).map(([id, context]) => {
          const row = payload.data.find(result => result.territoryId === id)!;
          return { id, context, value: row.value, portion: row.observed_value, reason: row.reason };
        }),
      });
    }
  }
  writeFileSync(join(out, "rejeu.json"), JSON.stringify({ archiveAvailable: !!archive, storageReads, reports }, null, 2) + "\n");
  writeFileSync(join(out, "syntheses.json"), JSON.stringify(syntheses, null, 2) + "\n");
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
