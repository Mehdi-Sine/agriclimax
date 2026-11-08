import { describe, it, expect } from "vitest";
import {
  calculateWheat,
  wheatRules,
  isPublishable,
  type WheatDay,
} from "./qualified";
import { calendarDays } from "../national/daily-availability";
const rule = (id: string) => wheatRules.find((r) => r.id === id)!;
export const sampleDay = (date: string, value: number): WheatDay => ({
  pra: "pra:28341",
  date,
  values: {
    temperature: value,
    temperature_min: value,
    temperature_max: value,
    precipitation: Math.max(0, value),
  },
  complete: true,
  compatible: true,
  source: "synthetic",
  run: null,
  nature: "reanalysis",
  freshness: "synthetic",
  provenance: ["synthetic-only"],
  quality_flags: [],
  support_key: "synthetic-grid",
  spatial_coverage: 1,
  temporal_coverage: 1,
});
function evaluate(id: string, values: number[]) {
  const dates = calendarDays(
    "2026-12-31",
    new Date(Date.parse("2026-12-31") + (values.length - 1) * 86400000)
      .toISOString()
      .slice(0, 10),
  );
  return calculateWheat(
    "pra:28341",
    dates.map((d, i) => sampleDay(d, values[i])),
    dates[0],
    dates.at(-1)!,
    rule(id),
  );
}
describe("AGRO01 synthetic technical qualification; no agronomic calibration", () => {
  it.each([1, 7, 30])(
    "validates all operations on a %i-day complete window",
    (n) => {
      for (const [id, expected] of [
        ["gdd", 4 * n],
        ["temperature_mean", 4],
        ["rain", 4 * n],
        ["dry", 0],
        ["dry_sequence", 0],
        ["hot", 0],
        ["hot_sequence", 0],
        ["frost", 0],
        ["frost_sequence", 0],
        ["heavy_rain", 0],
      ] as const) {
        const r = evaluate(id, Array(n).fill(4));
        expect(r.value).toBe(expected);
        expect(isPublishable(rule(id), r)).toBe(true);
      }
    },
  );
  it("uses strict threshold bounds and clips negative GDD without clipping the mean", () => {
    expect(evaluate("gdd", [-5, 0, 5]).value).toBe(5);
    expect(evaluate("temperature_mean", [-5, 0, 5]).value).toBe(0);
    expect(evaluate("hot", [25, 26, 27, 25, 28]).value).toBe(3);
    expect(evaluate("hot_sequence", [25, 26, 27, 25, 28]).value).toBe(2);
    expect(evaluate("frost", [0, -1, -2, 0, -3]).value).toBe(3);
    expect(evaluate("frost_sequence", [0, -1, -2, 0, -3]).value).toBe(2);
    expect(evaluate("dry", [0, 1, 0, 0, 2]).value).toBe(3);
    expect(evaluate("dry_sequence", [0, 1, 0, 0, 2]).value).toBe(2);
    expect(evaluate("heavy_rain", [20, 21, 0]).value).toBe(1);
    expect(evaluate("rain", [0, 0, 0]).value).toBe(0);
  });
  it("refuses incomplete days, spatial supports, source switches, runs and missing metadata", () => {
    const first = sampleDay("2026-12-31", 26),
      last = sampleDay("2027-01-01", 27);
    const changes: Partial<WheatDay>[] = [
      { complete: false },
      { compatible: false },
      { spatial_coverage: 0.95 },
      { temporal_coverage: 0.5 },
      { source: "other" },
      { run: "2027-01-01T00:00:00Z" },
      { nature: "forecast" },
      { support_key: "other" },
      { support_key: "" },
      { provenance: [] },
      { values: { temperature_max: null } },
      { values: { temperature_max: Infinity } },
      { values: { temperature_max: -101 } },
    ];
    for (const change of changes) {
      const r = calculateWheat(
        first.pra,
        [first, { ...last, ...change }],
        "2026-12-31",
        "2027-01-01",
        rule("hot_sequence"),
      );
      expect(r.value, JSON.stringify(change)).toBeNull();
      expect(isPublishable(rule("hot_sequence"), r)).toBe(false);
    }
    expect(
      calculateWheat(
        first.pra,
        [first],
        "2026-12-31",
        "2027-01-01",
        rule("hot"),
      ).value,
    ).toBeNull();
  });
  it("rejects duplicates, unknown rules, impossible dates and 31 days", () => {
    const d = sampleDay("2026-12-31", 26);
    expect(() =>
      calculateWheat(d.pra, [d, d], d.date, d.date, rule("hot")),
    ).toThrow("DUPLICATE");
    expect(() =>
      calculateWheat(d.pra, [], d.date, d.date, {
        ...rule("hot"),
        version: "legacy",
      }),
    ).toThrow("UNQUALIFIED");
    for (const [a, b] of [
      ["2026-02-30", "2026-03-01"],
      ["2026-12-01", "2026-12-31"],
    ])
      expect(() => calculateWheat(d.pra, [], a, b, rule("hot"))).toThrow();
  });
  it("does not qualify a changed threshold, incomplete result or agronomic risk", () => {
    const r = evaluate("hot", [26]);
    expect(isPublishable({ ...rule("hot"), threshold: 20 }, r)).toBe(false);
    expect(isPublishable(rule("hot"), { ...r, spatial_coverage: 0.99 })).toBe(
      false,
    );
    expect(r.scientific_status).toBe("exploratory");
    expect(r.normal).toBeNull();
    expect(r.anomaly).toBeNull();
    expect(rule("hot").limits).toContain("Aucun stade");
  });
});
