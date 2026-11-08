vi.mock("./coastal-complement", () => ({
  coastalComplement: vi.fn().mockResolvedValue(undefined),
}));
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const sources = vi.hoisted(() => ({
  weather: vi.fn(),
  archived: vi.fn(),
  national: vi.fn(),
  days: vi.fn(),
}));
vi.mock("./weather-archives", () => ({
  nationalWeatherDocument: sources.weather,
  archivedEra5Day: sources.archived,
}));
vi.mock("./spatial-restitution", () => ({
  observedSupportDay: vi.fn().mockResolvedValue({
    verified: false,
    rows: [],
    geometries: {},
    identity: "unavailable",
  }),
}));
vi.mock("./national", () => ({ nationalData: sources.national }));
vi.mock("./national-availability", () => ({ nationalDays: sources.days }));
import { agroclimaticData, readAgroclimatic } from "./agroclimatic";
import Ajv2020 from "ajv/dist/2020";
import schema from "../../../../contracts/jsonschema/agroclimatic-1.schema.json";
import identities from "../../data/operational/pra-identities.json";
beforeEach(() => {
  vi.clearAllMocks();
  sources.archived.mockResolvedValue(null);
  sources.days.mockResolvedValue(["2026-10-30", "2026-10-31"]);
});
it("validates query shape and physical threshold bounds before archive access", async () => {
  for (const query of [
    "indicator=unknown",
    "indicator=hot&start=2026-11-07&end=2026-11-07&temporal=bad",
    "indicator=rain&start=2026-10-30&end=2026-10-31&threshold=NaN",
    "indicator=dry&start=2026-10-30&end=2026-10-31&threshold=-1",
    "indicator=gdd&start=2026-10-30&end=2026-10-31&pra=pra:XXXXX",
    "indicator=hot&start=2026-10-30&end=2026-10-31&indicator=frost",
  ])
    expect(
      (
        await readAgroclimatic(
          new Request("https://test/api/agroclimatic?" + query),
        )
      ).status,
    ).toBe(400);
  expect(sources.weather).not.toHaveBeenCalled();
  expect(sources.national).not.toHaveBeenCalled();
});
it("reads shared national dates and emits exactly 713 stable identities with selected details", async () => {
  sources.national.mockImplementation(async (p: URLSearchParams) => ({
    data: identities.ids.map((pra_id) => ({
      pra_id,
      date: p.get("date"),
      current_value: 2,
      current_status: "available",
      current_coverage: 1,
    })),
  }));
  const result = await agroclimaticData(
    new URLSearchParams({
      indicator: "gdd",
      start: "2026-10-30",
      end: "2026-10-31",
      pra: identities.ids[0],
    }),
  );
  const validate = new Ajv2020({ strict: false }).compile(schema);
  expect(validate(result), JSON.stringify(validate.errors)).toBe(true);
  expect(result.data).toHaveLength(713);
  expect(result.data[0]).toMatchObject({
    value: 4,
    status: "available",
    observedDays: 2,
  });
  expect(result.data[0].series).toHaveLength(2);
  expect(result.data[1].series).toEqual([]);
  expect(sources.national).toHaveBeenCalledTimes(2);
  // Detail selection does not recalculate or reload source dates.
  const replay = await agroclimaticData(
    new URLSearchParams({
      indicator: "gdd",
      start: "2026-10-30",
      end: "2026-10-31",
      pra: identities.ids[1],
    }),
  );
  expect(replay.data[1].series).toHaveLength(2);
  expect(sources.national).toHaveBeenCalledTimes(2);
  expect(replay.calculated_at).toBe(result.calculated_at);
});
it("does not invent national forecast data when verified archive is unavailable", async () => {
  sources.weather.mockResolvedValue(null);
  const response = await readAgroclimatic(
    new Request(
      "https://test/api/agroclimatic?indicator=thi&temporal=forecast&start=2026-11-07&end=2026-11-07",
    ),
  );
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(sources.national).not.toHaveBeenCalled();
});

it("replays verified daily archives without reading normals or acquiring any source", async () => {
  sources.archived.mockImplementation(async (date: string) =>
    identities.ids.map((pra_id) => ({
      pra_id,
      valid_date: date,
      temperature: 12,
      temperature_min: 3,
      temperature_max: 18,
      precipitation: date === "2026-10-30" ? 3 : 4,
      coverage: [1, 1, 1, 1],
      status: "available",
      quality_flags: [],
      computed_at: "2026-11-01T00:00:00Z",
      batch_key: "immutable-batch",
    })),
  );
  const result = await agroclimaticData(
    new URLSearchParams({
      rule_version: "agroclimatic-1.2.0",
      indicator: "rain",
      start: "2026-10-30",
      end: "2026-10-31",
    }),
  );
  expect(result.data.every((r) => r.value === 7)).toBe(true);
  expect(result.data[0].provenance[0]).toContain("immutable-batch");
  expect(sources.national).not.toHaveBeenCalled();
  expect(sources.weather).not.toHaveBeenCalled();
});

it("preserves strict 1.0.0 and publishes qualified results separately on native observed support", async () => {
  const { observedSupportDay } = await import("./spatial-restitution");
  sources.days.mockResolvedValue(["2026-09-20", "2026-09-21"]);
  const pra = identities.ids[0];
  vi.mocked(observedSupportDay).mockImplementation(async () => ({
    verified: true,
    data_sha256: "0".repeat(64),
    identity: "same-weights/reference",
    geometries: {
      mask: {
        type: "Feature",
        id: pra,
        properties: {
          code: pra.slice(4),
          name: "test",
          department_name: "test",
          region_name: "test",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ],
        },
      },
    },
    rows: [
      {
        pra_id: pra,
        coverage: 0.95,
        observed_value: 5,
        value: 5,
        support_id: "mask",
        temporal_coverage: 1,
        rule_version: "pra-observed-area-mean-90-1",
        quality_flags: [],
      },
    ],
  }));
  sources.archived.mockImplementation(async (date: string) =>
    identities.ids.map((pra_id) => ({
      pra_id,
      valid_date: date,
      temperature: pra_id === pra ? null : 5,
      temperature_min: null,
      temperature_max: null,
      precipitation: null,
      coverage: pra_id === pra ? [0.95, 0.95, 0.95, 0.95] : [1, 1, 1, 1],
      status: pra_id === pra ? "partial" : "available",
      quality_flags: [],
      computed_at: "2026-11-01T00:00:00Z",
      batch_key: "immutable-batch",
    })),
  );
  const q = {rule_version: "agroclimatic-1.2.0", indicator: "gdd", start: "2026-09-20", end: "2026-09-21", pra };
  const current = await agroclimaticData(new URLSearchParams(q));
  expect(current.data[0]).toMatchObject({
    value: 10,
    observed_value: 10,
    support_id: "mask",
    status: "partial",
    rule_version: "agroclimatic-1.2.0",
    spatial_coverage: 0.95,
    temporal_coverage: 1,
  });
  const strict = await agroclimaticData(
    new URLSearchParams({ ...q, rule_version: "agroclimatic-1.0.0" }),
  );
  expect(strict.data[0].value).toBeNull();
  expect(strict.data[0].rule_version).toBe("agroclimatic-1.0.0");
  expect(strict.data[0].observed_value).toBeUndefined();
});
