import { describe, expect, it } from "vitest";
import { calculateQualified, coverageRule, type QualifiedDay } from "../climate-quality/calculate";
import { FIELD_RULES } from "./catalogue";
import { compareFieldPeriods, fieldSummary } from "./national-summary";

const dates = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07"];
const period = { start: dates[0], end: dates[6], timezone: "UTC" };
const prairie = "pra:29102";
const rows: QualifiedDay[] = dates.map((date, index) => ({
  pra: prairie,
  date,
  values: {
    temperature: [2, 6, 10, 36, 6, 15, 9][index],
    temperature_min: [-2, 0, 4, 16, 6, 10, 5][index],
    temperature_max: [5, 12, 16, 40, 6, 20, 13][index],
    precipitation: [1, 0, 0.99, 1, 5, 30, 10][index],
  },
  compatible: true,
  complete: true,
  source: "era5-land",
  run: null,
  nature: "reanalysis",
  freshness: date,
  provenance: ["fixture"],
  quality_flags: [],
  climate_support: { id: "fixture", fraction: 1, temporal_complete: true, mask: "native_valid_cells", method: "pra-native-1" },
}));
const expected = [40, 1, 2, 47.99, 46.99];
const run = (index: number, input = rows) => {
  const rule = FIELD_RULES[index];
  return calculateQualified(prairie, input, period.start, period.end, coverageRule(rule, rule.version), rule.threshold);
};

describe("indicateurs agricoles nationaux", () => {
  it.each(FIELD_RULES.map((rule, index) => [rule.id, index] as const))("%s applique sa formule et s’abstient si la période est incomplète", (_, index) => {
    const result = run(index);
    expect(result.value).toBeCloseTo(expected[index]);
    expect(result).toMatchObject({ rule_version: "agro-field-1.0.0", observedDays: 7, quality: { journal_eligible: true } });
    expect(run(index, rows.filter((_, day) => day !== 2))).toMatchObject({ value: null, observedDays: 6 });
  });

  it("s’abstient si la température moyenne manque même quand les extrema existent", () => {
    const input = structuredClone(rows);
    input[0].values.temperature = null;
    expect(run(0, input).value).toBeNull();
  });

  it("refuse un seuil personnalisé et un pic calculé sur moins de cinq jours", () => {
    const rule = FIELD_RULES[4];
    expect(() => calculateQualified(prairie, rows.slice(0, 4), dates[0], dates[3], rule, null)).toThrow("INVALID_PERIOD_OR_PARAMETER");
    expect(() => calculateQualified(prairie, rows, period.start, period.end, FIELD_RULES[1], -2)).toThrow("INVALID_PERIOD_OR_PARAMETER");
  });

  it("exclut un cumul littoral partiel et publie les abstentions", () => {
    const partial = rows.map(row => ({ ...row, climate_support: { ...row.climate_support!, fraction: 0.65 } }));
    const result = run(3, partial);
    expect(result).toMatchObject({ value: null, observed_value: 47.99, reason: "observed_area_only" });
    const summary = fieldSummary(FIELD_RULES[3], period, "fixture", [result], [{id: prairie, name: "Crozon", region: "Bretagne"}], {});
    expect(summary).toMatchObject({ total_pra: 1, evaluable_pra: 0, abstentions: { observed_area_only: 1 }, remarkable: { maximum: null } });
  });

  it("compare des fenêtres contiguës avec un support apparié", () => {
    const rule = FIELD_RULES[4];
    const result = run(4);
    const before = {
      history_series: "exact-storage-1", rule, source_version: "before",
      period: { start: "2026-09-24", end: "2026-09-30", timezone: "UTC" },
      data: [{ ...result, value: result.value! - 3 }],
    };
    const after = { ...before, period, source_version: "after", data: [result] };
    expect(compareFieldPeriods(after, before)).toMatchObject({ value: 3, paired_pra: 1 });
    expect(compareFieldPeriods(after, { ...before, history_series: "legacy-rpc-1" })).toEqual({
      value: null, reason: "previous_period_not_homologous",
    });
    expect(compareFieldPeriods(after, { ...before, data: [{ ...result, support_id: "other" }] })).toEqual({
      value: null, reason: "no_paired_pra_with_homologous_support",
    });
  });

  it("conserve zéro parmi les PRA évaluables et refuse un référentiel incomplet", () => {
    const result = run(1, rows.map(row => ({ ...row, values: { ...row.values, temperature_min: 0 } })));
    const places = [{id: prairie, name: "Crozon", region: "Bretagne"}];
    const summary = fieldSummary(FIELD_RULES[1], period, "fixture", [result], places, {});
    expect(summary).toMatchObject({
      evaluable_pra: 1,
      remarkable: { maximum: 0, highest: [], maximum_count: 1 },
      regions: [{ evaluable_pra: 1 }],
    });
    expect(summary.distribution[0].count).toBe(1);
    expect(() => fieldSummary(FIELD_RULES[1], period, "fixture", [], places, {})).toThrow("FIELD_SUMMARY_PRA_REFERENCE");
  });
});
