import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { coveragePaint } from "../../apps/web/features/cartography/coverage";
import type { CoverageQuality } from "../../apps/web/features/climate-quality/policy";
import { RULES } from "../../apps/web/features/agroclimatic/catalogue";
import { VARIABLES, type WeatherRow } from "../../apps/web/features/operational/model";
import { weatherQualityKey, type WeatherQualityBundle } from "../../apps/web/features/climate-quality/adapters";
import { INDICATORS } from "../../apps/web/features/unified/model";

const origin = process.env.COUV08_ORIGIN ?? "http://127.0.0.1:3018";
const output = process.env.COUV08_OUTPUT ?? "work/couv08/matrix.json";
const requireNative = process.env.COUV08_REQUIRE_NATIVE === "true";
const corsica = /^pra:2[AB]/;
type Row = {
  territoryId: string;
  value: number | null;
  observed_value?: number | null;
  unit: string;
  rule_version: string;
  provenance: string | string[];
  quality?: CoverageQuality;
};
type Support = {
  verified: boolean;
  collection: { features: { id: string; properties: { support_id: string }; geometry: { type: string } }[] };
};
async function read<T>(path: string, params: Record<string, string>) {
  const started = performance.now();
  const response = await fetch(`${origin}/api/${path}?${new URLSearchParams(params)}`, {
    signal: AbortSignal.timeout(120_000),
  });
  assert.equal(response.status, 200, response.url);
  const bytes = await response.text();
  return { data: JSON.parse(bytes) as T, ms: Math.round(performance.now() - started), bytes: Buffer.byteLength(bytes) };
}

async function historical(start: string, end: string) {
  const support = new Map<string, Promise<Support>>();
  async function check(path: string, indicator: string, variable: string | null, parameters: Record<string, string>) {
    if (variable && !support.has(variable)) {
      support.set(variable, read<Support>("national/support", { start, end, variable }).then(result => result.data));
    }
    const [{ data: payload, ms, bytes }, geometry] = await Promise.all([
      read<{ data: Row[] }>(path, { start, end, indicator, ...parameters }),
      variable ? support.get(variable) : undefined,
    ]);
    const ids = new Set(payload.data.map(row => row.territoryId));
    assert.equal(payload.data.length, 713);
    assert.equal(ids.size, 713);
    assert.equal([...ids].filter(id => corsica.test(id)).length, 6);
    const shapes = new Map(geometry?.collection.features.map(feature => [feature.id, feature]));
    const counts = { whole: 0, covered: 0, unavailable: 0 };
    const corsicanCounts = { ...counts };
    for (const row of payload.data) {
      const shape = shapes.get(row.territoryId);
      const value = row.value ?? row.observed_value ?? null;
      const { target, fraction } = coveragePaint({
        value, field: "value", quality: row.quality, geometrySupportId: shape?.properties.support_id,
      });
      counts[target]++;
      if (corsica.test(row.territoryId)) corsicanCounts[target]++;
      if (target === "covered") {
        assert.ok(geometry?.verified && shape);
        assert.match(shape.geometry.type, /^(Multi)?Polygon$/);
        assert.ok(fraction !== null && fraction < 0.9);
      }
      if (target !== "unavailable") {
        assert.ok(Number.isFinite(value) && row.unit && row.rule_version && row.provenance.length);
      }
      if (indicator.startsWith("thi")) assert.equal(value, null);
    }
    return { model: "ERA5-Land", path, indicator, start, end, counts, corsicanCounts, ms, bytes };
  }
  const cases = [
    ...INDICATORS.map(def => () => check("unified", def.id, def.variable, { threshold: String(def.parameter ?? 25) })),
    ...RULES.map(rule => () => check("agroclimatic", rule.id, rule.variables.length === 1 ? rule.variables[0] : null, { temporal: "history" })),
  ];
  const checks = [];
  for (let i = 0; i < cases.length; i += 3) {
    checks.push(...await Promise.allSettled(cases.slice(i, i + 3).map(run => run())));
  }
  return checks.map((check, i) => check.status === "fulfilled" ? check.value : { start, end, case: i, error: String(check.reason) });
}

type WeatherView = {
  run: string;
  available_dates: string[];
  rows: WeatherRow[];
  coverage_quality: WeatherQualityBundle;
  forecast_support?: Support["collection"];
};

async function forecast(requestedRun: string, model: string) {
  const params = { experimental: "weather", run: requestedRun, model };
  const cases = [];
  try {
    const { data: catalogue } = await read<WeatherView>("operational", { ...params, catalogue: "1" });
    assert.equal(catalogue.run.slice(0, 10), requestedRun);
    const days = catalogue.available_dates.filter(day => requireNative ? day > requestedRun : day >= requestedRun);
    assert.ok(days.length);
    for (const date of new Set([days[0], days.at(-1)!])) {
      for (const { id: variable } of VARIABLES) {
        try {
          const { data, ms, bytes } = await read<WeatherView>("operational", { ...params, date, variable });
          const ids = new Set(data.rows.map(row => row.pra_id));
          assert.equal(ids.size, 713);
          assert.equal(data.rows.length, 713);
          assert.equal([...ids].filter(id => corsica.test(id)).length, 6);
          assert.equal(data.run, catalogue.run);
          if (requireNative) assert.ok(data.forecast_support, "Native support transport missing");
          const supports = new Map(data.forecast_support?.features.map(feature => [feature.id, feature.properties.support_id]));
          const counts = { whole: 0, covered: 0, unavailable: 0 };
          const legacy = { available: 0, partial: 0, unavailable: 0 };
          let boundNative = 0;
          for (const row of data.rows) {
            assert.equal(row.variable, variable);
            assert.equal(row.valid_date, date);
            assert.ok(row.provenance_sha256 && row.rule_version && row.source_id);
            const quality = data.coverage_quality.definitions[data.coverage_quality.lookup[weatherQualityKey(row)]];
            if (quality?.evidence.mask === "native_valid_cells") boundNative++;
            const value = quality?.indicator_eligible ? row.value : null;
            if (value == null) legacy.unavailable++;
            else if (quality.state === "observed_partial" || row.status === "partial") legacy.partial++;
            else legacy.available++;
            const { target } = coveragePaint({ value, quality, field: "value", geometrySupportId: supports.get(row.pra_id) });
            counts[target]++;
          }
          cases.push({ model, path: "operational", requestedRun, run: data.run, date, variable, counts, legacy,
            nativeProofTransport: data.forecast_support !== undefined, ...(requireNative ? { boundNative } : {}), ms, bytes });
        } catch (error) {
          cases.push({ model, requestedRun, date, variable, error: String(error) });
        }
      }
    }
  } catch (error) {
    cases.push({ model, requestedRun, error: String(error) });
  }
  return cases;
}

async function forecastAgro(run: string) {
  const start = new Date(Date.parse(run) + 86_400_000).toISOString().slice(0, 10);
  const last = new Date(Date.parse(run) + 7 * 86_400_000).toISOString().slice(0, 10);
  const checks = [];
  for (const end of [start, last]) {
    for (const { id: indicator } of RULES) {
      const params = { start, end, indicator, temporal: "forecast", run };
      try {
        const { data, ms, bytes } = await read<{ data: Row[]; forecast_support?: Support["collection"] }>("agroclimatic", params);
        const ids = new Set(data.data.map(row => row.territoryId));
        assert.equal(ids.size, 713);
        assert.equal(data.data.length, 713);
        assert.equal([...ids].filter(id => corsica.test(id)).length, 6);
        const shapes = new Map(data.forecast_support?.features.map(feature => [feature.id, feature.properties.support_id]));
        const counts = { whole: 0, covered: 0, unavailable: 0 };
        for (const row of data.data) {
          assert.equal(row.rule_version, "agroclimatic-1.3.0");
          const value = row.value ?? row.observed_value ?? null;
          const { target } = coveragePaint({
            value, quality: row.quality, field: "value", geometrySupportId: shapes.get(row.territoryId),
          });
          if (indicator.startsWith("thi") && row.quality?.state === "observed_partial") assert.equal(target, "unavailable");
          counts[target]++;
        }
        checks.push({ model: "selected", path: "agroclimatic", ...params, counts,
          nativeProofTransport: data.forecast_support !== undefined, ms, bytes });
      } catch (error) {
        checks.push({ ...params, error: String(error) });
      }
    }
  }
  return checks;
}

async function main() {
  const checks = [];
  if (process.env.COUV08_FORECAST_ONLY !== "true") {
    for (const [start, end] of [["2026-11-01", "2026-11-01"], ["2026-11-08", "2026-11-08"], ["2026-11-02", "2026-11-08"]]) {
      checks.push(...await historical(start, end));
    }
  }
  if (process.env.COUV08_FORECAST === "true") {
    const runs = process.env.COUV08_RUN ? [process.env.COUV08_RUN] : ["2026-11-14", "2026-11-15"];
    for (const run of runs) {
      const jobs = [
        ...["arome", "arpege", "ifs"].map(model => forecast(run, model)),
        ...(process.env.COUV08_FORECAST_AGRO === "true" ? [forecastAgro(run)] : []),
      ];
      checks.push(...(await Promise.all(jobs)).flat());
    }
  }
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({ origin, checks }, null, 2) + "\n");
  assert.ok(checks.every(check => !("error" in check)), "Un ou plusieurs contrôles de l’API ont échoué");
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
