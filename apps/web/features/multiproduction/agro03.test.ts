import { expect, it } from "vitest";
import { computeBatch, type ProductionDay } from "./engine";
import { RECIPES, PRODUCTIONS } from "./registry";
import { AGRO03_RECIPES, AGRO03_PRODUCTIONS, AGRO03_VERSION, AGRONOMY, NEW_RECIPES, REFERENCES, computeAgro03 } from "./agro03";
import { calculateQualified } from "../climate-quality/calculate";
import Ajv from "ajv/dist/2020";
import schema from "../../../../contracts/jsonschema/agro03-catalogue.schema.json";

// Synthetic hand-calculated reference, never presented as operational weather.
const rows = (): ProductionDay[] => [
  [20, 30, 1], [21, 32, 10], [22, 31, 0.999], [-4, -1, 0], [-3, -0.1, 15], [-2, 0, 1],
].map(([low, high, rain], i) => ({
  pra: "pra:28341", date: `2026-01-0${i + 1}`,
  values: { temperature: (low + high) / 2, temperature_min: low, temperature_max: high, precipitation: rain },
  compatible: true, complete: true, source: "synthetic-test", run: null, nature: "reanalysis",
  freshness: "synthetic", provenance: ["synthetic-hand-reference"], quality_flags: [],
  climate_support: { id: "test-mask", fraction: 1, temporal_complete: true, mask: "native_valid_cells", method: "test" },
}));
const period: [string, string] = ["2026-01-01", "2026-01-06"];
function result(id: string, data = rows()) {
  return computeAgro03(["pra:28341"], period, () => data).measurements.find(m => m.production === "wheat" && m.indicator === id)!.result;
}
it("checks eight independent manual results, exact thresholds and wet/dry complementarity", () => {
  const expected = { warm_nights20: 2, warm_nights20_sequence: 2, wet_days1: 4, wet_sequence1: 2, rain10_days: 2, rain_max1day: 15, ice_days: 2, ice_sequence: 2 };
  for (const [id, value] of Object.entries(expected)) expect(result(id).value, id).toBe(value);
  expect(result("wet_days1").value! + result("dry").value!).toBe(6);
  expect(result("wet_days1").signals.map(s => s.comparison)).toEqual([">=", ">=", ">=", ">="]);
  expect(result("wet_sequence1")).toMatchObject({ episodes: 2, longest: 2 });
  expect(result("rain_max1day")).toMatchObject({ unit: "mm", episodes: null, longest: null, signals: [] });
  expect(result("ice_days").signals.map(s => s.date)).toEqual(["2026-01-04", "2026-01-05"]);
});
it.each(NEW_RECIPES.map(r => r.id))("%s stays null on gaps, invalid variables, incompatible runs and unidentified support", id => {
  const rule = AGRO03_RECIPES.find(r => r.id === id)!;
  const gap = rows().filter((_, i) => i !== 1);
  expect(result(id, gap).value).toBeNull();
  expect(result(id, gap).longest).toBeNull();
  for (const value of [null, NaN, Infinity, -Infinity]) {
    const invalid = rows(); invalid[1].values[rule.kernel.variables[0]] = value;
    expect(result(id, invalid).value).toBeNull();
  }
  const run = rows(); run[1].nature = "forecast"; run[1].run = "2025-12-31T00:00:00Z";
  expect(result(id, run).value).toBeNull();
  const unqualified = rows(); delete unqualified[1].climate_support;
  expect(result(id, unqualified).value).toBeNull();
  const partial = rows().map(r => ({ ...r, climate_support: { ...r.climate_support!, fraction: 0.8 } }));
  expect(result(id, partial)).toMatchObject({ value: null, support_scope: "observed_area", quality: { journal_eligible: false } });
  expect(result(id, partial).observed_value).toBe(result(id).value);
});
it("keeps the active catalogue unchanged and preserves every existing result under default invocation", () => {
  expect(RECIPES).toHaveLength(20);
  expect(PRODUCTIONS).toHaveLength(6);
  expect(RECIPES.some(r => r.id === "wet_days1")).toBe(false);
  const before = computeBatch(["pra:28341"], period, () => rows());
  const after = computeAgro03(["pra:28341"], period, () => rows());
  for (const m of before.measurements) {
    const extended = after.measurements.find(x => x.production === m.production && x.indicator === m.indicator)!;
    expect({ ...extended.result, rule_version: m.result.rule_version }).toEqual(m.result);
  }
  const a = after.measurements.find(m => m.production === "pigs" && m.indicator === "warm_nights20")!;
  const b = after.measurements.find(m => m.production === "dairy_cattle" && m.indicator === "warm_nights20")!;
  expect(a.result).toBe(b.result);
  expect(() => Object.assign(a.result, { value: 999 })).toThrow();
});
it("checks input units and physical values via the shared contracts, without inventing animal THI", () => {
  const invalid = rows(); invalid[1].values.precipitation = -1;
  expect(result("wet_days1", invalid).value).toBeNull();
  expect(AGRO03_PRODUCTIONS.filter(p => ["pigs", "poultry", "beef_cattle"].includes(p.id)).every(p => !p.indicators.includes("thi"))).toBe(true);
  const cattle = computeAgro03(["pra:28341"], period, () => rows()).measurements.find(m => m.production === "dairy_cattle" && m.indicator === "thi")!;
  expect(cattle.result).toMatchObject({ value: null, reason: "humidity_missing" });
  expect(() => result("wet_days1", [rows()[0], rows()[0]])).toThrow("DUPLICATE_DAY");
});
it("handles zero rain, leap day, censored window boundaries, forecast cycle and missing archive horizons", () => {
  const data = rows().slice(0, 2).map((r, i) => ({ ...r, date: i ? "2024-03-01" : "2024-02-29", values: { precipitation: 0 } }));
  const rule = AGRO03_RECIPES.find(r => r.id === "rain_max1day")!.kernel;
  expect(calculateQualified("pra:28341", data, "2024-02-29", "2024-03-01", rule, null).value).toBe(0);
  const forecast = rows().map(r => ({ ...r, nature: "forecast", run: "2025-12-31T00:00:00Z" }));
  expect(result("wet_sequence1", forecast).value).toBe(2);
  forecast[1].run = "2025-12-31T06:00:00Z";
  expect(result("wet_sequence1", forecast).value).toBeNull();
  const r = AGRO03_RECIPES.find(r => r.id === "wet_sequence1")!.kernel;
  expect(calculateQualified("pra:28341", rows().slice(0, 2), ...period, r, 1).value).toBeNull();
  expect(calculateQualified("pra:28341", rows().slice(0, 2), "2026-01-01", "2026-01-02", r, 1).longest).toBe(2);
});
it("validates the machine catalogue, metadata and scientific boundaries", () => {
  const validate = new Ajv({ strict: true }).compile(schema);
  const catalogue = { version: AGRO03_VERSION, productions: AGRO03_PRODUCTIONS, recipes: AGRO03_RECIPES, agronomy: AGRONOMY, references: REFERENCES };
  expect(validate(catalogue), JSON.stringify(validate.errors)).toBe(true);
  expect(validate({ ...catalogue, version: "unversioned" })).toBe(false);
  expect(validate({ ...catalogue, agronomy: { ...AGRONOMY, wet_days1: { ...AGRONOMY.wet_days1, editorial: { ...AGRONOMY.wet_days1.editorial, causal_claims_allowed: true } } } })).toBe(false);
  for (const r of AGRO03_RECIPES) {
    expect(AGRONOMY[r.id].productions.length).toBeGreaterThan(0);
    expect(AGRONOMY[r.id].references.every(id => REFERENCES[id]?.url)).toBe(true);
    expect(AGRONOMY[r.id].parameters.threshold).toBe(r.kernel.threshold);
  }
});
