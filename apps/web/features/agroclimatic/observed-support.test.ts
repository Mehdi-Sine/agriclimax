import { expect, it } from "vitest";
import { RULES } from "./catalogue";
import {
  calculateObserved,
  observedRule,
  type SupportedDay,
} from "./observed-support";
const rule = (id: string) => observedRule(RULES.find((r) => r.id === id)!);
const day = (
  date: string,
  value: number,
  coverage = 0.95,
  id = "mask",
): SupportedDay => ({
  pra: "pra:06245",
  date,
  values: { temperature: value, precipitation: value },
  complete: true,
  compatible: true,
  source: "era5-land",
  run: null,
  nature: "reanalysis",
  freshness: "archive",
  provenance: ["native-weights"],
  quality_flags: [],
  support: {
    id,
    identity: "weights/reference/v1",
    coverage,
    temporal_coverage: 1,
  },
});
it("qualifies mean-derived GDD ≥90% without claiming whole-PRA measurement", () => {
  const r = calculateObserved(
    "pra:06245",
    [day("2026-10-30", 10), day("2026-10-31", 12)],
    "2026-10-30",
    "2026-10-31",
    rule("gdd"),
    0,
  );
  expect(r).toMatchObject({
    value: 22,
    observed_value: 22,
    support_scope: "qualified_pra_estimate",
    spatial_coverage: 0.95,
    temporal_coverage: 1,
    status: "partial",
    rule_version: "agroclimatic-1.1.0",
  });
});
it("retains only the observed portion below 90%, including zero rainfall", () => {
  const r = calculateObserved(
    "pra:06245",
    [day("2026-10-31", 0, 0.4)],
    "2026-10-31",
    "2026-10-31",
    rule("rain"),
    null,
  );
  expect(r).toMatchObject({
    value: null,
    observed_value: 0,
    support_id: "mask",
    support_scope: "observed_area",
    temporal_coverage: 1,
  });
});
it("does not aggregate differing masks, weight identities, or whole/partial supports", () => {
  for (const next of [
    day("2026-10-31", 10, 0.95, "other"),
    day("2026-10-31", 10, 0.94),
    { ...day("2026-10-31", 10), support: undefined },
    {
      ...day("2026-10-31", 10),
      support: { ...day("2026-10-31", 10).support!, identity: "other-weights" },
    },
  ]) {
    const r = calculateObserved(
      "pra:06245",
      [day("2026-10-30", 10), next],
      "2026-10-30",
      "2026-10-31",
      rule("gdd"),
      0,
    );
    expect(r).toMatchObject({
      value: null,
      observed_value: null,
      support_id: null,
      reason: "incompatible_spatial_support",
    });
  }
});
it("never paints a multi-day portion when any day is absent", () => {
  const r = calculateObserved(
    "pra:06245",
    [day("2026-10-31", 8)],
    "2026-10-30",
    "2026-10-31",
    rule("rain"),
    null,
  );
  expect(r).toMatchObject({
    value: null,
    observed_value: null,
    support_id: null,
    temporal_coverage: 0.5,
    reason: "incomplete_period",
  });
});
it("limits precipitation events to the observed support even above 90%", () => {
  const r = calculateObserved(
    "pra:06245",
    [day("2026-10-31", 25)],
    "2026-10-31",
    "2026-10-31",
    rule("heavy_rain"),
    20,
  );
  expect(r).toMatchObject({
    value: null,
    observed_value: 1,
    support_scope: "observed_area",
  });
  expect(r.quality_flags).toContain(
    "event_of_spatial_mean_not_fraction_of_affected_area",
  );
});
it("averages daily mean temperature on the stable support", () => {
  expect(
    calculateObserved(
      "pra:06245",
      [day("2026-10-30", 10), day("2026-10-31", 12)],
      "2026-10-30",
      "2026-10-31",
      rule("temperature_mean"),
      null,
    ).value,
  ).toBe(11);
});
