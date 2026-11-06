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
