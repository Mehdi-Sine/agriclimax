import {it, expect, vi} from "vitest";
vi.mock("server-only", () => ({}));
import sharp from "sharp";
import {readArchivedMaps, DATES} from "../../../../scripts/edit03_archives";
import {mapInfo} from "./model";
import {journalMapCards} from "./carousel-model";
import {mapThumbnail, thumbnailSvg} from "../../lib/server/map-thumbnail";
import {semanticPalette, classIndex, classLabel} from "../cartography/registry";

for (const date of DATES) it(`renders the ten real ${date} maps without changing order, values, dates or legend`, async () => {
  const {archive, bundle} = readArchivedMaps(date), original = JSON.stringify(bundle);
  const cards = journalMapCards({status:"published",code:"MAP_PUBLISHED",maps:bundle.maps.map(mapInfo)},archive.edition_id,date);
  expect(cards.map(c => c.map_id)).toEqual(bundle.maps.map(m => m.id));
  expect(cards).toHaveLength(10);
  const sizes = [];
  for (const [i, map] of bundle.maps.entries()) {
    const card = cards[i], url = new URL(card.interactive_url,"https://example.invalid");
    expect(url.searchParams.get("date")).toBe(date);
    expect(url.searchParams.get("id")).toBe(archive.edition_id);
    expect(url.searchParams.get("map")).toBe(map.id);
    expect(card.info.period).toEqual(map.period);
    const svg = thumbnailSvg(map), palette = semanticPalette(map.indicator,map.unit,(Date.parse(map.period[1])-Date.parse(map.period[0]))/86400000+1);
    expect((svg.match(/stroke-width=".45"/g)??[]).length).toBe(713);
    const colors = [...svg.matchAll(/fill="(#[\da-f]{6})" fill-opacity/g)].map(m=>m[1]);
    expect(colors).toHaveLength(713);
    expect(colors.filter(c=>c==="#8a969b")).toHaveLength(map.rows.filter(r=>r.value===null&&!(r.support_scope==="observed_area"&&r.observed_value!==null)).length);
    for (const r of map.rows) if (r.value!==null) expect(classIndex(r.value,palette)).toBeGreaterThanOrEqual(0);
    expect(palette.bounds.map((_,i)=>classLabel(palette,i))).toHaveLength(5);
    const result = await mapThumbnail(map), metadata = await sharp(result.bytes).metadata();
    expect(metadata.format).toBe("webp");expect(metadata.width).toBe(480);expect(metadata.height).toBe(300);
    expect(result.bytes.length).toBeLessThan(50000);sizes.push(result.bytes.length);
    expect((await mapThumbnail(map)).bytes).toBe(result.bytes);
  }
  expect(sizes.reduce((a,b)=>a+b,0)).toBeLessThan(500000);
  expect(JSON.stringify(bundle)).toBe(original);
}, 30000);
it("preserves zero, NULL, observed-only values and hatching independently of the numerical class", () => {
  const {bundle} = readArchivedMaps("2026-11-13"), map = structuredClone(bundle.maps[3]);
  const row = map.rows[0];
  row.value=0;row.status="available";row.support_scope="whole_pra";
  const zero = thumbnailSvg(map);
  row.value=null;const missing=thumbnailSvg(map);
  expect(zero).not.toBe(missing);
  row.observed_value=0;row.support_scope="observed_area";row.status="partial";
  const partial=thumbnailSvg(map);
  expect(partial).not.toBe(missing);expect(partial).toContain('fill="url(#partial)"');
});
