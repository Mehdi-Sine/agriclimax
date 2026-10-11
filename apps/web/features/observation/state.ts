export type Bounds = [number, number, number, number];
export const FRANCE_BOUNDS: Bounds = [-5.5, 41, 10, 51.5];
export interface Viewport {
  bounds: Bounds;
  zoom: number;
}
export function parseViewport(params: URLSearchParams): Viewport {
  const parts = params.get("bbox")?.split(",");
  const b = parts?.map(Number);
  const valid =
    parts?.length === 4 &&
    parts.every((p) => /^-?\d+(\.\d+)?$/.test(p)) &&
    b?.every(Number.isFinite) &&
    b[0] >= -180 &&
    b[2] <= 180 &&
    b[1] >= -85 &&
    b[3] <= 85 &&
    b[0] < b[2] &&
    b[1] < b[3];
  const zoom = Number(params.get("zoom"));
  return {
    bounds: valid ? (b as Bounds) : [...FRANCE_BOUNDS],
    zoom:
      params.has("zoom") && Number.isFinite(zoom) && zoom >= 0 && zoom <= 18
        ? zoom
        : 5,
  };
}
export function viewportParams(
  params: URLSearchParams,
  viewport: Viewport,
): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set("bbox", viewport.bounds.map((v) => v.toFixed(5)).join(","));
  next.set("zoom", viewport.zoom.toFixed(2));
  return next;
}
export function liveQuery(
  params: URLSearchParams,
  viewport: Viewport,
): URLSearchParams {
  const query = new URLSearchParams();
  for (const key of ["production", "indicator", "date", "rule", "version"]) {
    const value = params.get(key);
    if (!value) throw new Error("LIVE_CONTEXT_REQUIRED");
    query.set(key, value);
  }
  query.set("bbox", viewport.bounds.join(","));
  // Task 04 accepts integer zooms; preserve the precise camera zoom in the UI URL.
  query.set("zoom", String(Math.round(viewport.zoom)));
  query.set("limit", "1000");
  return query;
}
