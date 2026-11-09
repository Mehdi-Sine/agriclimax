// Synthetic publication catalogue, LOCAL UI tests only; no remote write or paid provider.
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToReadableStream } from "react-dom/server";
vi.mock("server-only",()=>({}));
vi.mock("../../lib/server/editorial-published",()=>({operationalEditions:vi.fn()}));
import { operationalEditions } from "../../lib/server/editorial-published";
import { previewEditions } from "../../lib/server/editorial-preview";
import Page from "../../app/journal/page";
import { GET as mapGET } from "../../app/api/journal/edition-map/route";
import { GET as editionGET } from "../../app/api/journal/edition/route";
import { GET as healthGET } from "../../app/api/journal/availability/route";
afterEach(()=>{delete process.env.AGRICLIMAX_JOURNAL_PUBLISHED_READ;vi.resetAllMocks();});
describe("published read path (synthetic manifest)",()=>{
 it("retains the old date and displays a delay without generation",async()=>{
  process.env.AGRICLIMAX_JOURNAL_PUBLISHED_READ="true";
  vi.mocked(operationalEditions).mockResolvedValue(previewEditions());
  const stream=await renderToReadableStream(<Page searchParams={Promise.resolve({})}/>);await stream.allReady;
  const html=await new Response(stream).text();
  expect(html).toContain("La dernière édition validée conserve sa date réelle");
  expect(html).toContain("/api/journal/edition?id=");
  expect(html).toContain('data-cycle="2026-11-07T00:00:00+00:00"');
  expect(html).not.toContain("/api/journal-preview/map");
 });
 it("keeps historical maps and immutable ETags",async()=>{
  const editions=previewEditions();vi.mocked(operationalEditions).mockResolvedValue(editions);
  const a=editions[0], map=a.illustrations[0];
  const r=await mapGET(new Request(`http://local/api/journal/edition-map?id=${a.edition_id}&map=${map.id}`));
  expect(r.status).toBe(200);expect((await r.json()).run).toBe(map.cycle);
  expect((await mapGET(new Request(`http://local/api/journal/edition-map?id=${a.edition_id}&map=absent`))).status).toBe(404);
  const e=await editionGET(new Request(`http://local/api/journal/edition?id=${a.edition_id}`));
  expect(e.status).toBe(200);
  expect((await editionGET(new Request(`http://local/api/journal/edition?id=${a.edition_id}`,{headers:{"if-none-match":e.headers.get("etag")!}}))).status).toBe(304);
 });
 it("health identifies a delayed edition instead of inventing today",async()=>{
  vi.mocked(operationalEditions).mockResolvedValue(previewEditions());
  expect((await (await healthGET()).json()).status).toBe("delayed");
 });
});
