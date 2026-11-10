import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { computeBatch, type ProductionDay } from "./engine";
import { RECIPES, PRODUCTIONS, validateRegistry, VERSION } from "./registry";
import { compareMeasurements, createContributors } from "./editorial";
import { createRegistry } from "../journal/registry";
import type { WatchSummary } from "../national-watch/model";
const period: [string, string] = ["2026-12-31", "2027-01-02"];
function day(date: string, temperature = 30): ProductionDay {
  return {
    pra: "pra:1",
    date,
    values: {
      temperature,
      temperature_max: temperature,
      temperature_min: temperature,
      precipitation: 0,
      humidity: null,
    },
    compatible: true,
    complete: true,
    source: "test",
    run: null,
    nature: "reanalysis",
    freshness: "2027-01-03T00:00:00Z",
    provenance: ["test-only"],
    quality_flags: [],
    climate_support: {
      id: "mask1",
      identity: "dataset/model/grid/weights/version/params",
      fraction: 1,
      temporal_complete: true,
      mask: "native_valid_cells",
      method: "test",
    },
  };
}
const rows = () => [day(period[0]), day("2027-01-01"), day(period[1])];
const batch = (data = rows()) => computeBatch(["pra:1"], period, () => data);
const get = (id: string, data = rows(), production = "wheat") =>
  batch(data).measurements.find(
    (m) => m.production === production && m.indicator === id,
  )!;
describe("declarative multi-production engine", () => {
  it("keeps the wheat ten and discovers every production, shares immutable calculations", () => {
    validateRegistry();
    expect(PRODUCTIONS.find((p) => p.id === "wheat")!.indicators).toHaveLength(
      10,
    );
    const b = batch();
    expect(b.metrics.cache_hits).toBeGreaterThan(b.metrics.calculations);
    const a = b.measurements.find(
        (m) => m.production === "wheat" && m.indicator === "rain",
      )!,
      c = b.measurements.find(
        (m) => m.production === "vine" && m.indicator === "rain",
      )!;
    expect(a.result).toBe(c.result);
    expect(() => Object.assign(a.result, { value: 42 })).toThrow();
    expect(c.result.value).toBe(0);
    expect(() =>
      validateRegistry([{ ...PRODUCTIONS[0], indicators: ["absent"] }]),
    ).toThrow();
  });
  it("computes strict thresholds, independent explicit bases and minimum", () => {
    expect(get("hot").result.value).toBe(3);
    expect(get("hot30", rows(), "maize").result.value).toBe(0);
    expect(get("gdd_base6", rows(), "maize").result.value).toBe(72);
    expect(get("gdd_base10", rows(), "maize").result.value).toBe(60);
    expect(
      get(
        "temperature_min",
        [day(period[0], -5), day("2027-01-01", 0), day(period[1], 2)],
        "vine",
      ).result.value,
    ).toBe(-5);
    expect(get("dry").result.value).toBe(3);
    expect(
      get(
        "rain_frequency",
        rows().map((r) => ({ ...r, values: { precipitation: 0.1 } })),
        "grassland",
      ).result.value,
    ).toBe(0);
  });
  it("refuses missing days, duplicate days and out of period rows", () => {
    const r = get("dry_sequence", [day(period[0]), day(period[1])]).result;
    expect(r.value).toBeNull();
    expect(r.longest).toBeNull();
    expect(() => batch([day(period[0]), day(period[0])])).toThrow(
      "DUPLICATE_DAY",
    );
    expect(() => batch([day("2026-12-30")])).toThrow("OUTSIDE_INPUT");
    expect(() =>
      computeBatch(["pra:1"], ["2026-02-30", "2026-03-01"], () => []),
    ).toThrow();
  });
  it.each([
    "source",
    "run",
    "nature",
    "method",
    "id",
    "identity",
    "mask",
    "fraction",
    "represented_area_m2",
  ] as const)("refuses a rupture in %s", (field) => {
    const data = rows();
    if (field === "source") data[1].source = "other";
    else if (field === "run") data[1].run = "2026-12-30T00:00:00Z";
    else if (field === "nature") data[1].nature = "observation";
    else if (field === "fraction") data[1].climate_support!.fraction = 0.8;
    else if (field === "represented_area_m2")
      data[1].climate_support!.represented_area_m2 = 42;
    else if (field === "mask")
      data[1].climate_support!.mask = "geometric_proxy";
    else data[1].climate_support![field] = "other";
    expect(get("rain", data).result.value).toBeNull();
    expect(get("dry_sequence", data).result.longest).toBeNull();
  });
  it("keeps partial observed values, area and identity, without territorial publication", () => {
    const data = rows().map((r) => ({
      ...r,
      climate_support: {
        ...r.climate_support!,
        fraction: 0.8,
        represented_area_m2: 123,
      },
    }));
    const r = get("rain", data).result;
    expect(r.value).toBeNull();
    expect(r.observed_value).toBe(0);
    expect(r.quality?.evidence.represented_area_m2).toBe(123);
    expect(r.support_scope).toBe("observed_area");
    expect(r.quality?.journal_eligible).toBe(false);
    const c = createRegistry(
      createContributors(batch(data).measurements, [
        { id: "pra:1", name: "Test", region: "Test" },
      ]),
    ).read({} as WatchSummary);
    expect(c.every((p) => p.indicators.length === 0)).toBe(true);
  });
  it("requires paired daily T/RH, never approximates humidity", () => {
    expect(get("thi", rows(), "cattle").result.reason).toBe("humidity_missing");
    const data: ProductionDay[] = rows().map((r) => ({
      ...r,
      values: { ...r.values, humidity: 50 },
    }));
    expect(get("thi", data, "cattle").result.value).toBeNull();
    for (const r of data)
      r.pair_evidence = {
        temperature: {
          unit: "degC",
          from: r.date + "T00:00:00Z",
          to: new Date(Date.parse(r.date) + 86400000)
            .toISOString()
            .replace(".000Z", "Z"),
          source: r.source,
          run: r.run,
          support: "mask1",
          identity: r.climate_support!.identity!,
        },
        humidity: {
          unit: "%",
          from: r.date + "T00:00:00Z",
          to: new Date(Date.parse(r.date) + 86400000)
            .toISOString()
            .replace(".000Z", "Z"),
          source: r.source,
          run: r.run,
          support: "mask1",
          identity: r.climate_support!.identity!,
        },
      };
    expect(get("thi", data, "cattle").result.value).toBeCloseTo(78.3);
    data[1].pair_evidence!.humidity.from = "2027-01-01T01:00:00Z";
    expect(get("thi", data, "cattle").result.value).toBeNull();
    data[1].values.humidity = 101;
    expect(get("thi", data, "cattle").result.value).toBeNull();
  });
  it.each([NaN, Infinity, -101, 61])("rejects invalid temperatures %s", (t) => {
    const data = rows();
    data[1].values.temperature = t;
    expect(get("gdd", data).result.value).toBeNull();
  });
  it("qualifies homologous comparisons through T33 and excludes incompatible periods", () => {
    const a = get("temperature_mean");
    const prev = {
      ...a,
      period: ["2026-12-28", "2026-12-30"] as [string, string],
      result: { ...a.result, value: 29 },
    };
    expect(compareMeasurements(a, prev, 3)).toMatchObject({
      kind: "historical_evolution",
      delta: 1,
    });
    prev.signature = "other";
    expect(compareMeasurements(a, prev, 3)).toMatchObject({
      kind: "not_comparable",
      delta: null,
    });
    expect(compareMeasurements(a, undefined, 3).kind).toBe(
      "insufficient_history",
    );
  });
  it("provides structured T33/T35 facts through dynamic contributors, preserves unavailable inventory", () => {
    const b = batch(),
      places = [{ id: "pra:1", name: "Test", region: "Centre" }];
    const c = createRegistry(createContributors(b.measurements, places)).read(
      {} as WatchSummary,
    );
    expect(c).toHaveLength(6);
    expect(c.find((p) => p.id === "cattle")!.indicator_inventory).toHaveLength(
      5,
    );
    const fact = c.find((p) => p.id === "maize")!.indicators[0].facts![0];
    expect(fact).toMatchObject({
      production: "maize",
      regions: ["Centre"],
      pra_ids: ["pra:1"],
      rule_version: VERSION,
      nature: "reanalysis",
    });
    expect(
      RECIPES.every((r) => r.classification !== "agronomic_interpretative"),
    ).toBe(true);
  });
});

it("reuses T33 episode censoring and never bridges a gap or model rupture", async () => {
  const { dailyEpisodeEvidence } = await import("./editorial");
  const { reconstructEpisodes } = await import("../editorial/temporal");
  const days = ["2027-01-01", "2027-01-02", "2027-01-04"];
  const measurements = days.flatMap((date) =>
    computeBatch(["pra:1"], [date, date], () => [
      day(date, -1),
    ]).measurements.filter(
      (m) => m.production === "vine" && m.indicator === "frost",
    ),
  );
  const evidence = dailyEpisodeEvidence(measurements, [
    { id: "pra:1", name: "Test", region: "Test" },
  ]);
  const episodes = reconstructEpisodes(evidence, "2027-01-04").sort((a, b) =>
    a.documented_start.localeCompare(b.documented_start),
  );
  expect(episodes.map((e) => e.duration_days)).toEqual([2, 1]);
  expect(episodes[0].status).toBe("continuity_unconfirmed");
  expect(episodes[1].left_censored).toBe(true);
  const changed = structuredClone(measurements);
  changed[1].signature = "different-model";
  expect(
    reconstructEpisodes(
      dailyEpisodeEvidence(changed, [
        { id: "pra:1", name: "Test", region: "Test" },
      ]),
      "2027-01-04",
    ),
  ).toHaveLength(3);
});

it("resolves each variable set once and keeps batch source selections isolated", () => {
  const data = rows();
  const provider = vi.fn(() => data);
  const a = computeBatch(["pra:1"], period, provider);
  expect(provider).toHaveBeenCalledTimes(5);
  const measured = a.measurements.find(
    (m) => m.indicator === "temperature_mean",
  )!;
  expect(() =>
    Object.assign(measured.result.series[0], { value: 99 }),
  ).toThrow();
  data[0].values.temperature = 29;
  const changed = rows().map((r) => ({
    ...r,
    source: "different-archive",
    values: {
      ...r.values,
      temperature: 20,
      temperature_min: 20,
      temperature_max: 20,
    },
  }));
  const b = computeBatch(["pra:1"], period, () => changed);
  expect(
    b.measurements.find((m) => m.indicator === "temperature_mean")!.signature,
  ).not.toBe(measured.signature);
  expect(measured.result.value).toBe(30);
});

it("attaches only a qualified homologous comparison to editorial facts", () => {
  const m = get("temperature_mean");
  const previous = {
    ...m,
    period: ["2026-12-28", "2026-12-30"] as [string, string],
    result: { ...m.result, value: 29 },
  };
  const places = [{ id: "pra:1", name: "Test", region: "Test" }];
  const contributors = createContributors([m], places, {
    previous: [previous],
    horizon: 3,
  });
  const facts = createRegistry(contributors)
    .read({} as WatchSummary)
    .find((p) => p.id === "wheat")!.indicators[0].facts!;
  expect(facts[0]).toMatchObject({
    comparison: { kind: "historical_evolution", delta: 1 },
  });
  previous.signature = "changed-grid";
  const invalid = createRegistry(
    createContributors([m], places, { previous: [previous], horizon: 3 }),
  ).read({} as WatchSummary);
  expect(
    invalid.find((p) => p.id === "wheat")!.indicators[0].facts![0],
  ).toMatchObject({ comparison: null });
});
