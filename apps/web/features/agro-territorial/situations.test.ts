import { describe, expect, it } from "vitest";
import { shortlist, territorialDay, type Profile, type TerritorialEvidence } from "./situations";

const beauce = { id: "pra:28341", name: "Beauce Dunoise", region: "Centre-Val de Loire" };
const corse = { id: "pra:2A259", name: "Coteaux corses", region: "Corse" };
const crozon = { id: "pra:29102", name: "Presqu’île de Crozon", region: "Bretagne" };
const profile: Profile = {
  crops: ["cereals", "vine", "orchard"].map(id => ({ id, label: id, hectares: 10, sha256: "rpg" })),
  orientations: [{ id: "L", label: "Bovins lait" }],
  sampled: true, systems_basin: 1, otex_sha256: "otex",
};
const evidence = (pra: string, date: string, phenomenon: string, value: number | null): TerritorialEvidence => ({
  pra, date, phenomenon, value, detected: value === null ? null : true,
  unit: phenomenon === "rain" ? "mm" : "°C", nature: "reanalysis",
  signature: "ERA5-Land", rule_version: "test", provenance: ["input"], data_freshness: [date],
  quality_flags: value === null ? ["partial_or_missing_native_support"] : [],
});

describe("scientific admission by PRA", () => {
  it("qualifies heavy daily rainfall for documented broadacre crops and excludes missing coastal coverage", () => {
    const date = "2026-11-15";
    const results = territorialDay(date, "reanalysis", [beauce, crozon],
      { [beauce.id]: profile, [crozon.id]: profile },
      [evidence(beauce.id, date, "rain", 27), evidence(crozon.id, date, "rain", null)]);
    expect(results).toHaveLength(8);
    expect(results[0].situation).toMatchObject({ value: 27, unit: "mm", window: "ALM-005", provenance: ["input", "rpg"] });
    expect(results[4]).toMatchObject({ state: "climate_insufficient", situation: null });
  });

  it("keeps frost and documented Corsican crops conditional on stage and season", () => {
    for (const [date, expected] of [["2026-04-15", "potential_sensitivity"], ["2026-11-15", "outside_sensitivity_window"]]) {
      const results = territorialDay(date, "reanalysis", [corse], { [corse.id]: profile },
        [evidence(corse.id, date, "frost", -2)]);
      expect(results.filter(r => r.rule.startsWith("frost")).map(r => r.state)).toEqual([expected, expected]);
      if (expected === "potential_sensitivity") {
        const selected = shortlist(results.flatMap(r => r.situation ? [r.situation] : []));
        expect(selected).toHaveLength(1);
        expect(selected[0].href).toContain("pra=pra%3A2A259");
      }
    }
  });

  it("uses bovine orientation as an indicative heat context and abstains without sampled evidence", () => {
    const date = "2026-07-20";
    const results = territorialDay(date, "reanalysis", [beauce, crozon],
      { [beauce.id]: profile, [crozon.id]: { ...profile, sampled: false, orientations: [] } },
      [evidence(beauce.id, date, "heat", 31), evidence(crozon.id, date, "heat", 30)]);
    expect(results[3].situation).toMatchObject({ confidence: "indicative", window: "ALM-039", provenance: ["input", "otex"] });
    expect(results[7]).toMatchObject({ state: "agriculture_insufficient", situation: null });
  });
});
