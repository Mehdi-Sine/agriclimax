import { it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));
const archive = vi.hoisted(() => ({
  daily: vi.fn(),
  catalogue: vi.fn(),
  weather: vi.fn(),
}));
vi.mock("./weather-archives", () => ({
  archivedEra5Day: archive.daily,
  archiveCatalogue: archive.catalogue,
  nationalWeatherDocument: archive.weather,
}));
import {
  forecastWheatInputs,
  historicalWheatInputs,
  wheatForecast,
  wheatHistory,
} from "./wheat";
import type {
  ArchivedDaily,
  NationalWeatherDocument,
} from "./weather-archives";
import { wheatRules, calculateWheat } from "../../features/wheat/qualified";
import type { WeatherRow } from "../../features/operational/model";
const rule = wheatRules.find((r) => r.id === "rain")!;
function weather(date: string): WeatherRow {
  return {
    contract_version: "pra-weather-1",
    pra_id: "pra:29102",
    variable: "precipitation",
    unit: "mm",
    value: 1,
    status: "available",
    valid_date: date,
    valid_from: date + "T00:00:00+00:00",
    valid_to: new Date(Date.parse(date) + 86400000).toISOString(),
    source_id: "synthetic",
    model: "synthetic",
    nature: "forecast",
    model_run_at: "2026-11-07T00:00:00Z",
    lead_hours: 48,
    rule_version: "synthetic",
    data_freshness: "fresh",
    provenance: {
      source_id: "synthetic",
      checksum: "checksum",
      grid_version: "grid",
      reference_version: "reference",
    },
    grid_version: "grid",
    weights_sha256: "weights",
    spatial_coverage: 1,
    temporal_coverage: 1,
    quality_flags: ["synthetic-only"],
    provenance_sha256: "proof",
    acquired_at: "2026-11-07T00:00:00Z",
    published_at: null,
    unavailable_reason: null,
    delayed: false,
    scientific_status: "exploratory",
  };
}
const document = (rows: WeatherRow[]) =>
  ({
    archive_sha256: "synthetic-sha",
    rows,
    selected_indices: rows.map((_, i) => i),
    run: "2026-11-07T00:00:00Z",
    acquired_at: "2026-11-07T00:00:00Z",
    pra_count: 713,
    attribution: "synthetic",
    recent_estimate_status: "synthetic",
  }) as NationalWeatherDocument;
it("uses the requested variable provenance, UTC dates, units and immutable native weights", () => {
  const r = weather("2026-11-08");
  const doc = document([
    {
      ...r,
      variable: "temperature",
      unit: "degC",
      source_id: "wrong-unused-source",
    },
    r,
  ]);
  const input = forecastWheatInputs(doc, rule, ["2026-11-08"]);
  expect(input[r.pra_id][0].source).toBe("synthetic");
  expect(input[r.pra_id][0].provenance[0]).not.toContain("wrong");
  expect(
    calculateWheat(r.pra_id, input[r.pra_id], r.valid_date, r.valid_date, rule)
      .value,
  ).toBe(1);
  for (const change of [
    { unit: "degC" },
    { valid_to: r.valid_from },
    { spatial_coverage: 0.9 },
    { temporal_coverage: 0.5 },
  ] as Partial<WeatherRow>[]) {
    const bad = forecastWheatInputs(document([{ ...r, ...change }]), rule, [
      r.valid_date,
    ]);
    expect(
      calculateWheat(r.pra_id, bad[r.pra_id], r.valid_date, r.valid_date, rule)
        .value,
    ).toBeNull();
  }
  const duplicate = forecastWheatInputs(document([r, r]), rule, [r.valid_date]);
  expect(
    calculateWheat(
      r.pra_id,
      duplicate[r.pra_id],
      r.valid_date,
      r.valid_date,
      rule,
    ).value,
  ).toBeNull();
});
it("does not splice model runs, sources, grids or changed calculation methods", () => {
  const first = weather("2026-11-08"),
    last = weather("2026-11-09");
  for (const change of [
    { source_id: "different" },
    { model_run_at: "2026-11-07T06:00:00Z" },
    { weights_sha256: "other" },
    { grid_version: "other" },
    { rule_version: "other" },
  ]) {
    const rows = forecastWheatInputs(
      document([first, { ...last, ...change }]),
      rule,
      [first.valid_date, last.valid_date],
    );
    expect(
      calculateWheat(
        first.pra_id,
        rows[first.pra_id],
        first.valid_date,
        last.valid_date,
        rule,
      ).value,
    ).toBeNull();
  }
});
it("shares all input I/O and caches the small forecast summary by cycle and rules", async () => {
  const d = document([weather("2026-11-08")]);
  const a = await wheatForecast(d),
    b = await wheatForecast(d);
  expect(b).toBe(a);
  expect(a).toHaveLength(2);
  expect(a[0].indicators).toHaveLength(10);
  expect(
    a[1].indicators.find((i) => i.id === "rain")!.territories[0].coverage
      .complete,
  ).toBe(0);
  expect(JSON.stringify(a)).not.toContain("selected_indices");
  expect(JSON.stringify(a)).not.toContain("series");
});
it("keeps real historical incomplete windows unavailable and checks daily native support identity", async () => {
  const first: ArchivedDaily = {
    pra_id: "pra:29102",
    valid_date: "2026-11-01",
    temperature: 10,
    temperature_min: 5,
    temperature_max: 15,
    precipitation: 1,
    coverage: [1, 1, 1, 1],
    valid_counts: [10, 10, 10, 10],
    expected_cells: 10,
    status: "available",
    quality_flags: ["synthetic"],
    batch_key: "synthetic-batch",
    computed_at: "2026-11-07T00:00:00Z",
    identity: {
      method: "pra-native-1",
      weights_sha256: "weights",
      reference_geometry_sha256: "geometry",
      dataset: { version: "synthetic" },
    },
  };
  const rows = historicalWheatInputs(
    [
      first,
      {
        ...first,
        valid_date: "2026-11-02",
        identity: { ...first.identity, weights_sha256: "other" },
      },
    ],
    rule,
  );
  expect(
    calculateWheat(
      first.pra_id,
      rows[first.pra_id],
      "2026-11-01",
      "2026-11-02",
      rule,
    ).value,
  ).toBeNull();
  archive.catalogue.mockResolvedValue({
    era5: [{ dates: ["2026-11-01"], sha256: "synthetic" }],
  });
  archive.daily.mockResolvedValue([first]);
  const batch = await wheatHistory(["2026-10-27", "2026-11-01"]);
  expect(archive.daily).toHaveBeenCalledTimes(1);
  expect(
    batch.summary.indicators.every(
      (i) => i.territories[0].coverage.complete === 0,
    ),
  ).toBe(true);
});
