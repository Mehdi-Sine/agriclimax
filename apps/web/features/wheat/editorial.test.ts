import { it, expect } from "vitest";
import { summarizeWheat, verifyWheatSummary } from "./national";
import { WheatEditorialContributor } from "./editorial";
import { WHEAT_VERSION, wheatRules, type WheatDay } from "./qualified";
import { createRegistry, defaultContributors } from "../journal/registry";
import { buildEdition } from "../journal/model";
import { assertEdition } from "../journal/validate";
import type { WatchSummary } from "../national-watch/model";
import geography from "../../data/operational/pra-watch-places.json";
const run = "2026-11-07T00:00:00Z",
  period: [string, string] = ["2026-11-08", "2026-11-08"];
const inputs = Object.fromEntries(
  geography.places.map((p, i) => [
    p.id,
    [
      {
        pra: p.id,
        date: period[0],
        values: {
          temperature: 10,
          temperature_min: 0,
          temperature_max: 25,
          precipitation: 0,
        },
        complete: i !== 0,
        compatible: true,
        source: "synthetic",
        run,
        nature: "forecast",
        freshness: "synthetic",
        provenance: ["synthetic-only"],
        quality_flags: [],
        support_key: "synthetic-" + p.id,
        spatial_coverage: i === 0 ? 0.8 : 1,
        temporal_coverage: 1,
      } satisfies WheatDay,
    ],
  ]),
);
const source = {
  version: "synthetic-source",
  nature: "forecast" as const,
  run,
};
const batch = summarizeWheat(geography.places, inputs, period, source);
const watch: WatchSummary = {
  version: "synthetic",
  identity: "synthetic-watch",
  source_version: source.version,
  run,
  acquired_at: run,
  published_at: null,
  source_nature: "forecast",
  period: ["2026-11-08", "2026-11-14"],
  places: geography.places,
  productions: [],
  metrics: [],
  evidence: {},
  events: [],
  coverage: [],
  calculated_at: run,
  compute_ms: 0,
};
const read = (snapshots = [batch.summary]) =>
  createRegistry([
    ...defaultContributors.filter((c) => c.id !== "wheat"),
    WheatEditorialContributor(snapshots),
  ]);
it("publishes descriptive wheat facts using the unmodified T31 public contracts", () => {
  const registry = read(),
    edition = buildEdition(watch, { now: run, registry });
  assertEdition(edition);
  const wheat = edition.production_sections.find((p) => p.id === "wheat")!;
  expect(wheat.indicators).toHaveLength(10);
  expect(wheat.label).toBe("Blé tendre");
  for (const i of wheat.indicators) {
    expect(i.version).toBe(WHEAT_VERSION);
    expect(i.qualified && i.publishable).toBe(true);
    for (const f of i.facts!) {
      expect(edition.evidence.facts).toContainEqual(f);
      expect(i.limits).toContain("sans validation de risque agronomique");
      expect(f.text).toContain("aucun stade, dommage ou rendement déduit");
      expect(f.quality_flags).toContain(
        "agronomic_interpretation_not_validated",
      );
      expect(f.href).toContain("agro_start=");
    }
  }
  expect(
    wheat.indicators.find((i) => i.id.startsWith("dry:"))!.facts![0].text,
  ).toContain("712/713");
  expect(
    wheat.indicators.find((i) => i.id.startsWith("hot:"))!.facts![0].value,
  ).toBe(0);
  expect(edition.regional_sections).toHaveLength(13);
  const cattle = edition.production_sections.find((p) => p.id === "cattle")!;
  expect(cattle.indicators).toEqual([]);
  expect(
    cattle.indicator_inventory?.every((i) => !i.qualified && !i.publishable),
  ).toBe(true);
});
it("keeps inventory but refuses unqualified, wrong-cycle, corrupted or incompatible snapshots", () => {
  for (const w of [
    { ...batch.summary, version: "legacy" },
    { ...batch.summary, run: "2026-11-06T00:00:00Z" },
    { ...batch.summary, source_version: "different" },
    { ...batch.summary, nature: "reanalysis" as const },
    {
      ...batch.summary,
      qualification: {
        ...batch.summary.qualification,
        descriptive_publication: false,
      },
    },
    {
      ...batch.summary,
      qualification: {
        ...batch.summary.qualification,
        calculation: "unvalidated" as "technically_validated",
      },
    },
  ]) {
    expect(verifyWheatSummary(w)).toBe(false);
    const section = read([w])
      .read(watch)
      .find((p) => p.id === "wheat")!;
    expect(section.indicators).toEqual([]);
    expect(section.indicator_inventory).toHaveLength(10);
  }
  expect(
    read([])
      .read(watch)
      .find((p) => p.id === "wheat")!.indicators,
  ).toEqual([]);
});
it("preserves unavailable conditions and deterministic identities without arithmetic regional means", () => {
  const repeat = summarizeWheat(
    [...geography.places].reverse(),
    inputs,
    period,
    source,
  );
  // Input geography ordering is canonicalized by caller in national archives; numeric summaries are stable.
  expect(repeat.summary.indicators.map((i) => i.territories)).toEqual(
    batch.summary.indicators.map((i) => i.territories),
  );
  expect(batch.summary.indicators[0].territories).toHaveLength(14);
  const coverage = batch.summary.indicators[0].territories[0].coverage;
  expect(coverage.complete + coverage.partial + coverage.unavailable).toBe(713);
  expect(JSON.stringify(batch.summary)).not.toContain("regional_mean");
  const unavailable = summarizeWheat(
    geography.places,
    {},
    period,
    source,
  ).summary;
  expect(
    read([unavailable])
      .read(watch)
      .find((p) => p.id === "wheat")!.indicators,
  ).toEqual([]);
  expect(() =>
    summarizeWheat(geography.places, { unknown: [] }, period, source),
  ).toThrow("UNKNOWN");
  expect(() =>
    summarizeWheat(
      geography.places,
      {
        [geography.places[0].id]: [
          { ...inputs[geography.places[0].id][0], nature: "observation" },
        ],
      },
      period,
      source,
    ),
  ).toThrow("INCOMPATIBLE");
  expect(wheatRules.every((r) => r.scientific_status === "exploratory")).toBe(
    true,
  );
});
