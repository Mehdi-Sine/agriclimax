import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import type { FeatureCollection, Polygon, Geometry } from "geojson";
import mapSchema from "../../../../contracts/jsonschema/map-feature.schema.json";
import riskSchema from "../../../../contracts/jsonschema/risk-result.schema.json";
import evidence from "../../../../fixtures/contracts/risk-result.json";
import { DemoRiskRepository } from "../../lib/demo-repository";
import { parseContext } from "../../lib/url-state";
import type { MapProperties } from "../../lib/repositories";
import type { MapRiskLayerAdapter } from "../../lib/map-adapter";
import type { AppContext } from "../../lib/domain";
import { liveQuery, type Viewport, type Bounds } from "./state";

export interface Evidence {
  rule: { rule_id: string; version: string };
  confidence: { scientific_status: string; reasons?: string[] };
  provenance: Array<{
    source_id: string;
    observed_at?: string | null;
    retrieved_at?: string | null;
  }>;
  quality: { flags: string[] };
}
export type Properties = Omit<MapProperties, "demo"> & {
  demo?: true;
  result?: Evidence;
};
export type Collection = FeatureCollection<Polygon, Properties> & {
  truncated?: boolean;
};
export interface LayerData {
  mode: "demo" | "live";
  collection: Collection;
}
export interface ObservationAdapter extends MapRiskLayerAdapter {
  read(
    params: URLSearchParams,
    viewport: Viewport,
    signal?: AbortSignal,
  ): Promise<LayerData>;
}
const ajv = new Ajv2020({ strict: false });
addFormats(ajv);
const validateProperties = ajv.compile(mapSchema);
const validateRisk = ajv.compile(riskSchema);
export function validateCollection(value: unknown): Collection {
  if (!value || typeof value !== "object") throw new Error("INVALID_RESPONSE");
  const c = value as Collection;
  if (
    c.type !== "FeatureCollection" ||
    !Array.isArray(c.features) ||
    c.features.length > 2000 ||
    typeof c.truncated !== "boolean"
  )
    throw new Error("INVALID_RESPONSE");
  for (const f of c.features) {
    if (
      f.type !== "Feature" ||
      !validateProperties(f.properties) ||
      !validateRisk(f.properties.result) ||
      f.geometry?.type !== "Polygon" ||
      !Array.isArray(f.geometry.coordinates) ||
      !f.geometry.coordinates.length ||
      f.geometry.coordinates.some(
        (ring) =>
          !Array.isArray(ring) ||
          ring.length < 4 ||
          ring.some(
            (p) =>
              !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite),
          ),
      )
    )
      throw new Error("INVALID_RESPONSE");
  }
  return c;
}
export class DemoObservationAdapter implements ObservationAdapter {
  readonly kind = "geojson" as const;
  constructor(private readonly repository = new DemoRiskRepository()) {}
  async getSource(context: AppContext, bounds?: Bounds): Promise<Collection> {
    // Selection is independent of the spatial/filter query, allowing all cells to remain visible.
    const result = await this.repository.getMapFeatures({
      ...context,
      territoryId: null,
    });
    const collection: Collection = result.data;
    collection.features = collection.features.filter((f) => {
      if (!bounds) return true;
      const ring = f.geometry.coordinates[0];
      const xs = ring.map((p) => p[0]),
        ys = ring.map((p) => p[1]);
      return (
        Math.max(...xs) >= bounds[0] &&
        Math.min(...xs) <= bounds[2] &&
        Math.max(...ys) >= bounds[1] &&
        Math.min(...ys) <= bounds[3]
      );
    });
    for (const f of collection.features) {
      if (
        f.properties.cell_id === evidence.cell_id &&
        f.properties.valid_date === evidence.valid_date &&
        f.properties.production_id === evidence.production_id &&
        f.properties.indicator_id === evidence.indicator_id
      ) {
        f.properties.result = evidence;
      }
    }
    return collection;
  }
  async read(params: URLSearchParams, viewport: Viewport): Promise<LayerData> {
    return {
      mode: "demo",
      collection: await this.getSource(parseContext(params), viewport.bounds),
    };
  }
}
export class ApiObservationAdapter implements ObservationAdapter {
  readonly kind = "geojson" as const;
  constructor(private readonly transport: typeof fetch = (input, init) => fetch(input, init)) {}
  async getSource(): Promise<never> {
    throw new Error("Use read with an explicit scientific context");
  }
  async read(
    params: URLSearchParams,
    viewport: Viewport,
    signal?: AbortSignal,
  ): Promise<LayerData> {
    const response = await this.transport(
      `/api/risks/map?${liveQuery(params, viewport)}`,
      { signal, cache: "no-store" },
    );
    if (!response.ok)
      throw new Error(
        response.status === 400 ? "LIVE_CONTEXT_REQUIRED" : "SOURCE_ERROR",
      );
    return {
      mode: "live",
      collection: validateCollection(await response.json()),
    };
  }
}
/** Basemap geometry also crosses a repository boundary; components never query Supabase. */
export async function readBasemap(
  signal?: AbortSignal,
): Promise<FeatureCollection<Geometry>> {
  const response = await fetch("/maps/europe-overview.geojson", { signal });
  if (!response.ok) throw new Error("BASEMAP_ERROR");
  return (await response.json()) as FeatureCollection<Geometry>;
}
