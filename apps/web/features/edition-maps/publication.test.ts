import {describe,it,expect,vi,afterEach} from "vitest";
vi.mock("server-only",()=>({}));
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {verifyBundle,sealBundle,sealMap,publicationPath,type EditionMapBundle,type MapApproval} from "./model";
import {publishMapBundle,readPublishedMaps,editionMaps} from "../../lib/server/edition-maps";
import type {MapObjectStore} from "../../lib/server/immutable-map-storage";
const real=JSON.parse(gunzipSync(readFileSync(new URL("../../../../docs/codex/INT-01/evidence/real-map-bundle.json.gz",import.meta.url))).toString()) as EditionMapBundle;
const edition={edition_id:real.edition_id,checksum:real.edition_checksum,date:real.edition_date};
const approval:MapApproval={bundle_sha256:real.sha256,reviewer:"Test only — not an operational approval",reviewed_at:"2026-11-11T16:00:00Z",scope:"descriptive_maps"};
class MemoryStore implements MapObjectStore {
  objects=new Map<string,Uint8Array>(); writes=0; interrupt=false;
  async read(path:string){return this.objects.get(path)??null;}
  async insert(path:string,bytes:Uint8Array){
    if(this.interrupt&&path.endsWith("publication.json"))throw Error("SIMULATED_INTERRUPTION");
    if(this.objects.has(path))throw Error("NO_UPSERT");
    this.objects.set(path,bytes);this.writes++;
  }
}
const dirs:string[]=[];
afterEach(()=>{vi.unstubAllEnvs();dirs.splice(0).forEach(p=>rmSync(p,{recursive:true,force:true}));});
describe("real frozen edition, immutable map companion",()=>{
  it("retains 713 official identities, six Corsican PRA, NULLs and original dates",()=>{
    expect(verifyBundle(real,edition)).toBe(real);
    for(const m of real.maps){expect(m.rows).toHaveLength(713);expect(m.rows.filter(r=>/^pra:2[AB]/.test(r.territoryId))).toHaveLength(6);}
    const historical=real.maps.find(m=>m.nature==="reanalysis")!;
    expect(historical.period).toEqual(["2026-10-29","2026-11-04"]);
    expect(historical.rows.filter(r=>r.value===null)).toHaveLength(68);
    expect(historical.rows.filter(r=>r.spatial_coverage!>0&&r.spatial_coverage!<1).length).toBeGreaterThan(0);
  });
  it("rejects alteration, wrong edition/checksum, invented identities and partial values relabelled as territorial",()=>{
    const tampered=structuredClone(real);tampered.maps[0].rows[0].value=999;
    expect(()=>verifyBundle(tampered,edition)).toThrow();
    expect(()=>verifyBundle(real,{...edition,checksum:"0".repeat(64)})).toThrow();
    expect(()=>verifyBundle(real,{...edition,edition_id:"0".repeat(64)})).toThrow();
    const changed=structuredClone(real);const row=changed.maps[0].rows.find(r=>r.value===null)!;row.value=1;row.support_scope="observed_area";
    const {id:unused,...body}=changed.maps[0];void unused;changed.maps[0]=sealMap(body);
    const {sha256:unused2,...bundle}=changed;void unused2;
    expect(()=>verifyBundle(sealBundle(bundle),edition)).toThrow("MAP_ROW_QUALIFICATION");
    body.rows[0].territoryId="pra:invented";changed.maps[0]=sealMap(body);bundle.maps=changed.maps;
    expect(()=>verifyBundle(sealBundle(bundle),edition)).toThrow();
  });
  it("requires exact review before any write, then publishes/reloads exact bytes idempotently",async()=>{
    const store=new MemoryStore();
    await expect(publishMapBundle(real,{...approval,bundle_sha256:"0".repeat(64)},store)).rejects.toThrow("MAP_PUBLICATION_CONTRACT");
    expect(store.writes).toBe(0);
    await publishMapBundle(real,approval,store);expect(store.writes).toBe(2);
    expect(await readPublishedMaps(edition,store)).toEqual(real);
    await publishMapBundle(real,approval,store);expect(store.writes).toBe(2);
    const before=store.objects.get(publicationPath(edition));
    await expect(publishMapBundle(real,{...approval,reviewer:"another review"},store)).rejects.toThrow("MAP_IMMUTABLE_CONFLICT");
    expect(store.objects.get(publicationPath(edition))).toBe(before);
  },15000);
  it("keeps a partial upload invisible; a retry completes it without changing older editions",async()=>{
    const store=new MemoryStore();store.interrupt=true;
    const oldPath="edition-maps/old-certified-edition";store.objects.set(oldPath,new Uint8Array([1,2,3]));
    await expect(publishMapBundle(real,approval,store)).rejects.toThrow("SIMULATED_INTERRUPTION");
    expect(await readPublishedMaps(edition,store)).toBeNull();expect(store.writes).toBe(1);
    store.interrupt=false;await publishMapBundle(real,approval,store);expect(store.writes).toBe(2);
    expect(store.objects.get(oldPath)).toEqual(new Uint8Array([1,2,3]));
    const blob=[...store.objects.keys()].find(k=>k.endsWith(".gz"))!;store.objects.set(blob,new Uint8Array([1]));
    await expect(readPublishedMaps(edition,store)).rejects.toThrow("MAP_BLOB_INTEGRITY");
  },15000);
  it("isolates candidates behind an explicit preview mode; the same file is never a publication",async()=>{
    const root=mkdtempSync(join(tmpdir(),"int01-"));dirs.push(root);writeFileSync(join(root,`${real.edition_id}.json`),JSON.stringify(real));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","");vi.stubEnv("SUPABASE_SECRET_KEY","");vi.stubEnv("AGRICLIMAX_MAP_PREVIEW_DIR",root);
    expect((await editionMaps(edition)).view.status).toBe("absent");
    vi.stubEnv("AGRICLIMAX_MAP_PREVIEW_ENABLED","true");
    expect((await editionMaps(edition)).view.status).toBe("preview");
    expect((await editionMaps({...edition,checksum:"0".repeat(64)})).view.status).toBe("error");
  });
  it("allows one concurrent publication winner, never a replacement",async()=>{
    class RacingStore extends MemoryStore {
      override async insert(path:string,bytes:Uint8Array){
        await Promise.resolve();
        // Storage's atomic create returns conflict without replacing existing bytes.
        if(!this.objects.has(path))await super.insert(path,bytes);
      }
    }
    const {sha256:unused,...body}=real;void unused;
    const small=sealBundle({...body,maps:[real.maps[0]]}),store=new RacingStore();
    const review={...approval,bundle_sha256:small.sha256};
    const results=await Promise.allSettled([publishMapBundle(small,review,store),publishMapBundle(small,{...review,reviewer:"Second concurrent test reviewer"},store)]);
    expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
    expect(results.filter(r=>r.status==="rejected")).toHaveLength(1);
    expect(store.writes).toBe(2);expect(await readPublishedMaps(edition,store)).toEqual(small);
  });
});
