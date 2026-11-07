import { expect, it } from "vitest";
import { RULES } from "./catalogue";
import { observedRule, NATIVE_RULE_VERSION } from "./observed-support";
import { calculateComplementary } from "./complement-calculate";
import type { ComplementaryDay } from "./complement-model";
const certificate = {
  source_id: "era5-land-neighbour-reconstruction",
  method_version: "test-spatial-1",
  accepted: true,
  quality_flags: ["spatial_reconstruction_not_native_observation"],
  validation: {
    reference: "ERA5-Land field, not an independent station" as const,
    pra: 9,
    pra_days: 117,
    mae: 0.2,
    p95_absolute_error: 0.5,
    unit: "°C" as const,
  },
};
const row = (date: string, value: number): ComplementaryDay => ({
  date,
  value,
  support_id: "a".repeat(64),
  identity: "fixed-method-and-certificate",
  native_coverage: 0,
  temporal_coverage: 1,
  provenance: "source-checksum",
});
const run = (id: string, rows: ComplementaryDay[], accepted = true) =>
  calculateComplementary(
    "pra:29102",
    rows,
    "2026-10-30",
    "2026-10-31",
    observedRule(RULES.find((r) => r.id === id)!, NATIVE_RULE_VERSION),
    id === "gdd" ? 5 : null,
    { ...certificate, accepted },
  );
it("uses the existing GDD calculation while exposing a separate reconstruction with zero native coverage", () => {
  const result = run("gdd", [row("2026-10-30", 4), row("2026-10-31", 10)]);
  expect(result).toMatchObject({
    value: 5,
    days: 2,
    native_spatial_coverage: 0,
    temporal_coverage: 1,
    source_kind: "spatial_reconstruction",
  });
  expect(result?.series.map((r) => r.value)).toEqual([0, 5]);
});
it("preserves zero rain and never infers heat, frost, precipitation events or THI", () => {
  const rows = [row("2026-10-30", 0), row("2026-10-31", 0)];
  expect(run("rain", rows)?.value).toBe(0);
  for (const id of [
    "hot",
    "frost",
    "hot_sequence",
    "dry",
    "heavy_rain",
    "thi",
    "cattle_heat",
  ])
    expect(run(id, rows)).toBeUndefined();
});
it("refuses temporal gaps, duplicate dates, changing neighbors, unsupported native coverage and failed validation", () => {
  const a = row("2026-10-30", 10),
    b = row("2026-10-31", 12);
  for (const rows of [
    [a],
    [a, a],
    [a, { ...b, support_id: "b".repeat(64) }],
    [a, { ...b, identity: "other-certificate" }],
    [a, { ...b, temporal_coverage: 0.99 }],
    [a, { ...b, native_coverage: 0.1 }],
    [a, { ...b, value: null }],
  ])
    expect(run("gdd", rows)).toBeUndefined();
  expect(run("gdd", [a, b], false)).toBeUndefined();
});
