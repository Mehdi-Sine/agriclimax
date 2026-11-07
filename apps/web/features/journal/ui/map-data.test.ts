import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  mapTheme,
  mapPalette,
  journalMapData,
  sameMapContext,
  explorerHref,
} from "./map-data";
import { semanticPalette } from "../../cartography/registry";
import {
  PHENOMENA,
  WATCH_VERSION,
  type WatchSummary,
} from "../../national-watch/model";
import geography from "../../../data/operational/pra-watch-places.json";
import { buildEdition } from "../model";
import { selectKeyFigures, validFigureValue } from "./key-figures";
// Synthetic climate values, real official place identifiers: unit tests ONLY.
function fixture(): WatchSummary {
  const region = geography.places[0].region,
    ids = geography.places
      .filter((p) => p.region === region)
      .slice(0, 3)
      .map((p) => p.id),
    values = { frost: -2, heat: 30, rain: 25, dry: 4, thi: 75 },
    period: [string, string] = ["2026-11-08", "2026-11-14"];
  const metrics = geography.places.flatMap((p) =>
    PHENOMENA.map((f) => ({
      pra: p.id,
      phenomenon: f.id,
      value: values[f.id],
      days: 4,
      detected: ids.includes(p.id),
      state: ids.includes(p.id)
        ? ("detected" as const)
        : ("no_threshold_crossing" as const),
      evidence_id: "e0",
    })),
  );
  return {
    version: WATCH_VERSION,
    identity: "synthetic-only",
    source_version: "synthetic-sha",
    run: "2026-11-07T00:00:00Z",
    acquired_at: "2026-11-07T01:00:00Z",
    published_at: null,
    source_nature: "forecast",
    period,
    places: geography.places,
    metrics,
    evidence: {
      e0: {
        sources: ["synthetic-only/2026-11-07T00:00:00Z/forecast"],
        provenance: ["synthetic-sha"],
        rule_version: WATCH_VERSION + "/synthetic-rule",
        quality_flags: [],
        data_freshness: ["fresh"],
      },
    },
    productions: [],
    coverage: [],
    calculated_at: "2026-11-07T01:00:00Z",
    compute_ms: 0,
    events: PHENOMENA.map((p) => ({
      id: p.id,
      phenomenon: p.id,
      region,
      start: period[0],
      end: period[1],
      value: values[p.id],
      unit: p.unit,
      pra_ids: ids,
      evaluated: geography.places.filter((p) => p.region === region).length,
      duration: 4,
      text: "Synthetic unit test only",
      intensity: 1,
      production_ids: [],
      provenance: ["synthetic-sha"],
      quality_flags: [],
      rule_version: WATCH_VERSION,
      data_freshness: ["fresh"],
    })),
  };
}
describe("PRA theme and cycle adapter", () => {
  it.each([
    ["frost", "frost_min", "°C"],
    ["heat", "temperature_max", "°C"],
    ["rain", "rain", "mm/j"],
    ["dry", "dry_sequence", "jours"],
    ["thi", "thi", "THI"],
  ])("selects %s from the existing cartographic registry", (p, i, u) => {
    expect(mapTheme(p).indicator).toBe(i);
    expect(mapPalette(p).tokens).toEqual(
      semanticPalette(i, p === "rain" ? "mm" : u, 1).tokens,
    );
    expect(mapTheme(p).unit).toBe(u);
  });
  it("rejects unsupported anomalies without a qualified reference", () =>
    expect(() => mapTheme("anomaly")).toThrow());
  it("retains 713 official PRA and verbatim verified metric values", () => {
    const s = fixture(),
      d = journalMapData(s, "frost");
    expect(d.rows).toHaveLength(713);
    for (const r of d.rows)
      expect(r.value).toBe(
        s.metrics.find((m) => m.pra === r.id && m.phenomenon === "frost")!
          .value,
      );
    expect(d.source).toBe(s.source_version);
  });
  it("keeps missing and partial support distinct from an available zero", () => {
    const s = fixture();
    s.metrics[0] = { ...s.metrics[0], value: 0, detected: false };
    s.metrics[5] = { ...s.metrics[5], value: null, detected: null };
    s.metrics[10] = {
      ...s.metrics[10],
      value: null,
      detected: null,
      evidence_id: "partial",
    };
    s.evidence.partial = {
      ...s.evidence.e0,
      quality_flags: ["partial_spatial_support_not_evaluated"],
    };
    const d = journalMapData(s, "heat");
    expect(d.rows[0].value).toBe(0);
    expect(d.rows[0].status).toBe("available");
    expect(d.rows[1].value).toBeNull();
    expect(d.rows[2].status).toBe("partial");
  });
  it("marks incomplete temporal support without displaying a fabricated value", () => {
    const s = fixture();
    s.metrics[0] = {
      ...s.metrics[0],
      value: null,
      detected: null,
      state: "insufficient",
    };
    const d = journalMapData(s, "heat");
    expect(d.rows[0].value).toBeNull();
    expect(d.rows[0].status).toBe("partial");
  });
  it("refuses mismatching cycle, theme, period and archive identity", () => {
    const s = fixture(),
      d = journalMapData(s, "frost");
    expect(sameMapContext(d, s.run, "frost", s.period, s.source_version)).toBe(
      true,
    );
    expect(
      sameMapContext(
        d,
        "2026-11-06T00:00:00Z",
        "frost",
        s.period,
        s.source_version,
      ),
    ).toBe(false);
    expect(sameMapContext(d, s.run, "rain", s.period, s.source_version)).toBe(
      false,
    );
    expect(
      sameMapContext(
        d,
        s.run,
        "frost",
        ["2026-11-07", "2026-11-13"],
        s.source_version,
      ),
    ).toBe(false);
    expect(sameMapContext(d, s.run, "frost", s.period, "different-sha")).toBe(
      false,
    );
  });
  it("preserves exact archived explorer context and PRA", () => {
    const url = new URL(
      explorerHref("2026-11-06T06:00:00+00:00", "frost", "pra:01195"),
      "https://test",
    );
    expect(url.searchParams.get("cycle")).toBe("2026-11-06T06:00:00+00:00");
    expect(url.searchParams.get("pra")).toBe("pra:01195");
    expect(url.searchParams.get("phenomene")).toBe("frost");
  });
  it("ships the 713 real official geometries with complete matching identities and Corsica", () => {
    const g = JSON.parse(
      readFileSync("public/maps/journal-pra-v1.geojson", "utf8"),
    );
    expect(g.features).toHaveLength(713);
    expect(new Set(g.features.map((f: { id: string }) => f.id))).toEqual(
      new Set(geography.places.map((p) => p.id)),
    );
    expect(
      g.features.some(
        (f: { properties: { region_name: string } }) =>
          f.properties.region_name === "Corse",
      ),
    ).toBe(true);
  });
});
describe("Key figures: documented breadth before isolated extremes", () => {
  it("publishes three diverse qualified ratios and preserves the extreme in source evidence", () => {
    const s = fixture(),
      e = buildEdition(s, { now: s.acquired_at }),
      f = selectKeyFigures(e, s);
    expect(f).toHaveLength(3);
    expect(new Set(f.map((v) => v.phenomenon)).size).toBe(3);
    expect(f.every((v) => v.value === 3 && v.denominator > 3)).toBe(true);
    expect(e.key_facts[0].value).not.toBe(3);
  });
  it("does not arbitrarily discard a plausible -19.8 °C extreme, but does not promote it", () => {
    const s = fixture();
    s.events.find((e) => e.phenomenon === "frost")!.value = -19.8;
    s.metrics
      .filter((m) => m.phenomenon === "frost")
      .forEach((m) => (m.value = -19.8));
    const e = buildEdition(s, { now: s.acquired_at });
    expect(
      selectKeyFigures(e, s).find((f) => f.phenomenon === "frost")?.value,
    ).toBe(3);
    expect(e.evidence.facts.some((f) => f.value === -19.8)).toBe(true);
  });
  it("rejects inconsistent factual values and chooses another documented phenomenon", () => {
    const s = fixture(),
      e = buildEdition(s, { now: s.acquired_at });
    e.evidence.facts.find((f) => e.main_story!.facts.includes(f.id))!.value =
      99999;
    const f = selectKeyFigures(e, s);
    expect(f.some((f) => f.id === e.main_story!.id)).toBe(false);
    expect(f.length).toBeGreaterThan(0);
  });
  it.each([
    "partial_spatial_support_not_evaluated",
    "incomplete_or_incompatible_7day_window",
    "invalid_physical_value",
  ])("excludes invalid evaluated support (%s)", (flag) => {
    const s = fixture();
    s.evidence.e0.quality_flags = [flag];
    expect(
      selectKeyFigures(buildEdition(s, { now: s.acquired_at }), s),
    ).toEqual([]);
  });
  it("rejects physically impossible and inconsistent durations without new risk thresholds", () => {
    expect(validFigureValue("frost", -300, 7)).toBe(false);
    expect(validFigureValue("rain", -2, 7)).toBe(false);
    expect(validFigureValue("dry", 8, 7)).toBe(false);
    expect(validFigureValue("frost", -19.8, 7)).toBe(true);
  });
  it("has no fallback invented number for absent or mismatched data", () => {
    const s = fixture(),
      e = buildEdition(s, { now: s.acquired_at });
    expect(selectKeyFigures(e)).toEqual([]);
    s.run = "2026-11-06T00:00:00Z";
    expect(selectKeyFigures(e, s)).toEqual([]);
  });
});
