import "server-only";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {createHash} from "node:crypto";
import sharp from "sharp";
import type {FeatureCollection, Polygon, MultiPolygon} from "geojson";
import type {EditionMap} from "../../features/edition-maps/model";
import {semanticPalette, classIndex, PALETTE_VERSION} from "../../features/cartography/registry";
import {THUMBNAIL_VERSION} from "../../features/edition-maps/carousel-model";

const WIDTH = 480, HEIGHT = 300;
let assets: ReturnType<typeof readAssets> | undefined;
function readAssets() {
  const geometry = readFileSync(join(process.cwd(), "public/maps/journal-pra-v1.geojson"), "utf8");
  const css = readFileSync(join(process.cwd(), "styles/tokens.css"), "utf8");
  const collection = JSON.parse(geometry) as FeatureCollection<Polygon | MultiPolygon>;
  if (collection.features.length !== 713 || new Set(collection.features.map(f => f.id)).size !== 713) throw Error("THUMBNAIL_GEOMETRY");
  // Read the actual scientific CSS tokens, never a separately maintained palette.
  const rootCss = [...css.matchAll(/:root\s*\{([^}]+)\}/g)].map(m => m[1]).join(";");
  const tokens = new Map([...rootCss.matchAll(/(--[\w-]+)\s*:\s*(#[\da-fA-F]{6})(?=\s*[;}])/g)].map(m => [m[1], m[2]]));
  const color = (token: string) => {const value = tokens.get(token); if (!value) throw Error("THUMBNAIL_TOKEN"); return value;};
  const mercator = (lat: number) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
  const left = -5.3 * Math.PI / 180, right = 9.8 * Math.PI / 180, top = mercator(51.2), bottom = mercator(41.3);
  const scale = Math.min((WIDTH - 32) / (right - left), (HEIGHT - 32) / (top - bottom));
  const x0 = (WIDTH - (right - left) * scale) / 2, y0 = (HEIGHT - (top - bottom) * scale) / 2;
  const ring = (points: number[][]) => points.map(([lon, lat], i) => `${i ? "L" : "M"}${(x0 + (lon * Math.PI / 180 - left) * scale).toFixed(2)},${(y0 + (top - mercator(lat)) * scale).toFixed(2)}`).join("") + "Z";
  const paths = collection.features.map(f => ({id: String(f.id), d: (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates).flatMap(p => p.map(ring)).join("")}));
  return {paths, color, fingerprint: createHash("sha256").update(geometry).update(css).update(PALETTE_VERSION).update(THUMBNAIL_VERSION).digest("hex")};
}
/** Same values, classification, projection, opacity, missing grey and partial
 * hatching as EditionMaps/NationalMap. No recalculation or imputation. */
export function thumbnailSvg(map: EditionMap): string {
  const a = assets ??= readAssets();
  const days = (Date.parse(map.period[1]) - Date.parse(map.period[0])) / 86400000 + 1;
  const palette = semanticPalette(map.indicator, map.unit, days);
  const rows = new Map(map.rows.map(r => [r.territoryId, r]));
  const background = a.color("--surface-subtle"), ink = a.color("--text-primary"), missing = a.color("--national-unavailable");
  const shapes = a.paths.map(({id, d}) => {
    const row = rows.get(id);
    const value = row?.value ?? (row?.support_scope === "observed_area" ? row.observed_value : null);
    const band = classIndex(value, palette), fill = band < 0 ? missing : a.color(palette.tokens[band]);
    return `<path d="${d}" fill="${fill}" fill-opacity=".9" stroke="${ink}" stroke-opacity=".55" stroke-width=".45"/>${row?.status === "partial" ? `<path d="${d}" fill="url(#partial)"/>` : ""}`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><defs><pattern id="partial" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L8 0" stroke="${ink}" stroke-opacity=".25"/></pattern></defs><rect width="100%" height="100%" fill="${background}"/>${shapes}</svg>`;
}
const cache = new Map<string, Promise<{bytes: Buffer; etag: string}>>();
export function mapThumbnail(map: EditionMap) {
  const a = assets ??= readAssets(), key = `${a.fingerprint}:${map.id}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = sharp(Buffer.from(thumbnailSvg(map))).webp({lossless: true, effort: 6}).toBuffer().then(bytes => ({bytes, etag: `"${createHash("sha256").update(bytes).digest("hex")}"`}));
    // Bounded process cache; HTTP/CDN caches handle subsequent cold instances.
    if (cache.size >= 40) cache.delete(cache.keys().next().value!);
    cache.set(key, pending);
    void pending.catch(() => cache.delete(key));
  }
  return pending;
}
