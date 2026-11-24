import { describe, expect, it } from "vitest";
import { calculateQualified, type QualifiedDay } from "../climate-quality/calculate";
import { semanticPalette } from "../cartography/registry";
import { NEW_RECIPES } from "../multiproduction/agro03";
import { AGRO06_RULES, ANALYSIS_RULES } from "./analysis-catalogue";

const pra = "pra:29102";
const start = "2026-01-01";
const end = "2026-01-05";
const rows: QualifiedDay[] = [0, 0.99, 1, 10, 14].map((precipitation, index) => ({
  pra, date: `2026-01-0${index + 1}`,
  values: { precipitation, temperature_min: [20, 20.1, 21, 0, -2][index], temperature_max: [25, 27, 29, 0, -1][index] },
  compatible: true, complete: true, source: "synthetic", run: null, nature: "reanalysis",
  freshness: start, provenance: ["synthetic"], quality_flags: [],
  climate_support: { id: "fixture", fraction: 1, temporal_complete: true, mask: "native_valid_cells", method: "pra-native-1" },
}));
function calculate(id: string, input = rows) {
  const rule = AGRO06_RULES.find(candidate => candidate.id === id)!;
  return calculateQualified(pra, input, start, end, rule, rule.threshold);
}

describe("Analyse AGRO-06", () => {
  it("ouvre les huit recettes AGRO-03 sous leur identifiant et leur formule d’origine", () => {
    expect(new Set(ANALYSIS_RULES.map(rule => rule.id)).size).toBe(ANALYSIS_RULES.length);
    for (const { id, kernel } of NEW_RECIPES) {
      expect(AGRO06_RULES.find(rule => rule.id === id)).toMatchObject({
        operator: kernel.operator, threshold: kernel.threshold, formula: kernel.formula,
        variables: kernel.variables, science: { derivedFrom: kernel.version },
      });
    }
  });

  it.each([
    ["wet_days1", 3], ["wet_sequence1", 3], ["rain10_days", 2], ["rain_max1day", 14],
    ["wet_total1", 25], ["wet_intensity1", 25 / 3],
    ["warm_nights20", 2], ["warm_nights20_sequence", 2], ["ice_days", 1], ["ice_sequence", 1],
  ] as const)("%s calcule sur une fenêtre complète, avec une palette qualifiée", (id, expected) => {
    const result = calculate(id);
    expect(result).toMatchObject({ value: expected, quality: { journal_eligible: true } });
    expect(semanticPalette(id, result.unit, 5).family).not.toBe("agriculture");
    expect(calculate(id, rows.slice(1)).value).toBeNull();
    expect(calculate(id, rows.map((row, index) => index === 0
      ? { ...row, climate_support: { ...row.climate_support!, id: "different" } } : row)).value).toBeNull();
  });

  it("distingue un cumul nul d’une moyenne indéfinie", () => {
    const dry = rows.map(row => ({ ...row, values: { precipitation: 0.99 } }));
    expect(calculate("wet_total1", dry).value).toBe(0);
    expect(calculate("wet_intensity1", dry)).toMatchObject({
      value: null, status: "unavailable", reason: "no_wet_day", observedDays: 5,
      quality: { journal_eligible: false },
    });
  });

  it("réserve une partie du support à la carte et rejette la pluie négative", () => {
    const partial = rows.map(row => ({ ...row, climate_support: { ...row.climate_support!, fraction: 0.85 } }));
    expect(calculate("rain_max1day", partial)).toMatchObject({
      value: null, observed_value: 14, quality: { journal_eligible: false },
    });
    expect(calculate("wet_total1", rows.map((row, index) => index === 0
      ? { ...row, values: { precipitation: -1 } } : row)).value).toBeNull();
  });
});
