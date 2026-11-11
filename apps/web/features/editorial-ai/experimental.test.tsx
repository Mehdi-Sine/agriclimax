import {describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {renderToStaticMarkup} from "react-dom/server";
import bootstrap from "../../data/editorial/consultable-bootstrap.json";
import {unpackConsultable,verifyConsultable,consultableEdition} from "./consultable";
import {EditorialPreview} from "./preview";
import {previewEditions} from "../../lib/server/editorial-preview";
import {sealArchive,verifyArchive} from "./archive";
import {INSTRUCTIONS} from "./prompt";
import {readFileSync} from "node:fs";
const editions=unpackConsultable(bootstrap);
const a=editions.find(a=>a.date==="2026-11-10")!;
const unresolved="0e0bee7df8ae8508ac42265db0b908f4de832dbf8cb019cf245fdce92dd484fe";
describe("real November 10 experimental reading",()=>{
 it("retains rejection, original checksum and unresolved references without certification",()=>{
  expect(a.edition_id).toBe("a75a9f16667b5df0d706f51259dfeceb0bdf1996801ef6dc4b1c17693f1f189d");
  expect(a.checksum).toBe("cfc7b9a6de8163eb57dd7f941a8fe41734ca7ce4a42bc853a9821c9cd5cf9492");
  expect(a.scientifically_validated).toBe(false);
  expect(a.validation.errors).toContain("BLOCK_REFERENCE");
  expect(a.assessment.errors).toContain("BLOCK_REFERENCE");
  expect(a.draft.article[4].evidence_ids).toContain(unresolved);
  expect(verifyConsultable(a)).toBe(a);
 });
 it("projects incompatible editorial references without mutating the immutable source",()=>{
  const {checksum,...body}=previewEditions()[0];void checksum;
  const draft=structuredClone(body.draft);
  draft.article[0].evidence_ids=[unresolved];
  const source=sealArchive({...body,mode:"live",draft,receipt:{model:body.parameters.model,response_id:"SYNTHETIC_ONLY",usage:null,cost_eur:null,duration_ms:0,pricing_version:"synthetic"}});
  const original=JSON.stringify(source);
  const projection=consultableEdition(source);
  expect(projection.assessment.errors).toContain("BLOCK_REFERENCE");
  expect(projection.scientifically_validated).toBe(false);
  expect(JSON.stringify(source)).toBe(original);verifyArchive(source,false);
  expect(projection.draft).toEqual(source.draft);
  expect(()=>consultableEdition({...source,checksum:"0".repeat(64)})).toThrow();
 });
 it("renders the real article and archive links, and marks unknown references without links",()=>{
  const html=renderToStaticMarkup(<EditorialPreview edition={a} editions={editions} published/>);
  expect(html).toContain("Gel prévu en Auvergne-Rhône-Alpes");
  expect(html).toContain("Édition expérimentale IA — contenu non entièrement vérifié");
  expect(html).toContain("Référence non résolue");expect(html).toContain(unresolved);
  expect(html.match(/<p>La série historique compatible.*?<\/p>/s)?.[0]).not.toContain("<a");
  expect(html).not.toMatch(new RegExp(`href="[^"]*${unresolved}`));
  expect(html).toContain("/journal?date=2026-11-09");
  expect(html).toContain("DOCUMENTARY_CONFIRMATION");
  expect(JSON.stringify(a)).not.toMatch(/"(?:receipt|parameters|response_id)":/);
 });
 it("keeps the read path free of provider calls and constrains future evidence IDs",()=>{
  for(const path of ["lib/server/editorial-published.ts","features/editorial-ai/consultable.ts","app/api/journal/edition/route.ts"]){
   expect(readFileSync(path,"utf8")).not.toMatch(/from\s+["'][^"']*\/(?:provider|generate|generate-operational)["']/);
  }
  expect(INSTRUCTIONS).toContain("exclusivement des id de national.facts");
  expect(INSTRUCTIONS).toContain("ne sont JAMAIS des evidence_ids");
 });
});

it('keeps test edition links in preview and exposes the almanac without generating text',()=>{
 const preview=previewEditions()[0];
 const html=renderToStaticMarkup(<EditorialPreview edition={preview} editions={[preview]}/>);
 expect(html).toContain(`/journal/preview?date=${preview.date}&amp;id=${preview.edition_id}`);
 expect(html).not.toContain(`/cartes-du-jour?date=${preview.date}`);
 expect(html).toContain('/almanach');
 expect(html).toContain('/aide-et-documentation/indicateurs');
});
