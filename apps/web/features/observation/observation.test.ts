import { describe, expect, it } from "vitest";
import {
  DemoObservationAdapter,
  ApiObservationAdapter,
  validateCollection,
} from "./adapter";
import {
  liveQuery,
  parseViewport,
  viewportParams,
  FRANCE_BOUNDS,
} from "./state";
import fixture from "../../../../fixtures/demo-risk.geojson.json";
import result from "../../../../fixtures/contracts/risk-result.json";
const liveCollection = () => ({
  type: "FeatureCollection",
  truncated: false,
  features: fixture.features.map((f) => ({
    ...f,
    properties: { ...f.properties, result },
  })),
});
const liveParams = new URLSearchParams(
  "production=wheat_soft&indicator=tmax_days_above&date=2026-07-01&rule=provided-rule&version=provided-version&territory=demo-001",
);
describe("Observation URL and boundaries", () => {
  it("round trips camera while preserving filters, mode, selection and view", () => {
    const params = new URLSearchParams("mode=live&territory=cell-1&view=watch");
    const v = {
      bounds: [-4, 42, 8, 50] as [number, number, number, number],
      zoom: 6.25,
    };
    const next = viewportParams(params, v);
    expect(parseViewport(next)).toEqual(v);
    expect(next.get("territory")).toBe("cell-1");
    expect(next.get("view")).toBe("watch");
    expect(next.get("mode")).toBe("live");
  });
  it.each([
    "0,0,0,0",
    "NaN,40,4,50",
    "1,2,3",
    "-200,40,4,50",
    "2,50,1,40",
    ",40,4,50",
  ])("rejects invalid bounds %s", (bbox) => {
    expect(parseViewport(new URLSearchParams({ bbox, zoom: "oops" }))).toEqual({
      bounds: FRANCE_BOUNDS,
      zoom: 5,
    });
  });
  it("requires explicit live scientific context and sends only Task 04 keys", () => {
    expect(() =>
      liveQuery(new URLSearchParams(), parseViewport(new URLSearchParams())),
    ).toThrow("LIVE_CONTEXT_REQUIRED");
    const query = liveQuery(liveParams, { bounds: FRANCE_BOUNDS, zoom: 6.25 });
    expect(query.get("zoom")).toBe("6");
    expect(query.has("territory")).toBe(false);
    expect(query.get("rule")).toBe("provided-rule");
    expect(query.get("version")).toBe("provided-version");
  });
});
describe("Observation data adapters", () => {
  it("uses only the existing fictitious cell and separates selection from spatial filtering", async () => {
    const adapter = new DemoObservationAdapter();
    const data = await adapter.read(liveParams, {
      bounds: [1.2, 48.2, 1.8, 48.8],
      zoom: 8,
    });
    expect(data.mode).toBe("demo");
    expect(data.collection.features).toHaveLength(1);
    expect(data.collection.features[0].properties.risk_level).toBe("moderate");
    expect(data.collection.features[0].properties.confidence_level).toBe("low");
    expect(data.collection.features[0].properties.result?.rule.version).toBe(
      result.rule.version,
    );
    expect(
      (
        await adapter.read(new URLSearchParams("production=dairy_cattle"), {
          bounds: FRANCE_BOUNDS,
          zoom: 5,
        })
      ).collection.features,
    ).toHaveLength(0);
    expect(
      (await adapter.read(liveParams, { bounds: [3, 43, 4, 44], zoom: 8 }))
        .collection.features,
    ).toHaveLength(0);
  });
  it("retains live freshness, confidence and risk unchanged", async () => {
    const payload = liveCollection();
    payload.features[0].properties.freshness = "stale";
    const adapter = new ApiObservationAdapter(async () =>
      Response.json(payload),
    );
    const data = await adapter.read(liveParams, {
      bounds: FRANCE_BOUNDS,
      zoom: 5,
    });
    expect(data.mode).toBe("live");
    expect(data.collection.features[0].properties.freshness).toBe("stale");
    expect(data.collection.features[0].properties.confidence_level).toBe("low");
  });
  it("returns no-data for empty live and never silently replaces API errors with fixtures", async () => {
    const viewport = { bounds: FRANCE_BOUNDS, zoom: 5 };
    const empty = new ApiObservationAdapter(async () =>
      Response.json({
        type: "FeatureCollection",
        features: [],
        truncated: false,
      }),
    );
    expect(
      (await empty.read(liveParams, viewport)).collection.features,
    ).toHaveLength(0);
    const failed = new ApiObservationAdapter(
      async () => new Response(null, { status: 503 }),
    );
    await expect(failed.read(liveParams, viewport)).rejects.toThrow(
      "SOURCE_ERROR",
    );
  });
  it("rejects invalid properties, evidence and geometry", () => {
    const payload = liveCollection();
    payload.features[0].properties.risk_level = "invented";
    expect(() => validateCollection(payload)).toThrow("INVALID_RESPONSE");
    expect(() =>
      validateCollection({
        type: "FeatureCollection",
        features: [null],
        truncated: false,
      }),
    ).toThrow();
  });
});
