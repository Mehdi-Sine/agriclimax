/** Read-only evidence capture. No RPC mutation, provider or acquisition. */
import {mkdirSync,writeFileSync} from "node:fs";
import {gzipSync} from "node:zlib";
import {editorialRPC,SupabaseEditorialStore} from "../apps/web/features/editorial-ai/supabase-store";
import type {Run} from "../apps/web/features/editorial-ai/archive";
import {readPublishedMaps} from "../apps/web/lib/server/edition-maps";
import {mapObjectStore} from "../apps/web/lib/server/immutable-map-storage";
import {publicationPath,verifyPublication} from "../apps/web/features/edition-maps/model";
import {readEdit04Archive,DATES} from "./edit04_archives";
import {createHash} from "node:crypto";
async function main(){
 if(process.argv.includes("--verify-only")){
  const store=new SupabaseEditorialStore("");
  const checked=[];
  for(const date of DATES){
   const original=readEdit04Archive(date),archive=await store.read(original.archive.edition_id);
   if(!archive||archive.checksum!==original.archive.checksum)throw Error("EDIT04_REMOTE_ARCHIVE_CHANGED");
   const bundle=await readPublishedMaps(archive);
   if(bundle?.sha256!==original.bundle.sha256)throw Error("EDIT04_REMOTE_MAPS_CHANGED");
   checked.push({date,edition_id:archive.edition_id,archive_checksum:archive.checksum,bundle_sha256:bundle.sha256,unchanged:true});
  }
  console.log(JSON.stringify({checked,remote_writes:0,openai_calls:0}));return;
 }
 const date="2026-11-14",runs=await editorialRPC<Run[]>("runs"),store=new SupabaseEditorialStore("");
 const candidates=runs.filter(r=>r.edition_date===date&&r.archive_id&&r.state==="completed");
 const archives=await Promise.all(candidates.map(r=>store.read(r.archive_id!)));
 const archive=archives.filter(a=>a!==null).sort((a,b)=>b.revision-a.revision)[0];
 if(!archive)throw Error("EDIT04_REAL_ARCHIVE_MISSING");
 const bundle=await readPublishedMaps(archive);if(!bundle)throw Error("EDIT04_REAL_MAPS_MISSING");
 const raw=await mapObjectStore.read(publicationPath(archive),16*1024);if(!raw)throw Error("EDIT04_MANIFEST_MISSING");
 const publication=verifyPublication(JSON.parse(Buffer.from(raw).toString()),archive);
 const bytes=gzipSync(JSON.stringify({archive,bundle,publication}));
 const out="fixtures/editorial/edit04";mkdirSync(out,{recursive:true});writeFileSync(`${out}/${date}.json.gz`,bytes,{flag:"wx"});
 writeFileSync(`${out}/manifest.json`,JSON.stringify({date,file:`${date}.json.gz`,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex"),edition_id:archive.edition_id,edition_checksum:archive.checksum,bundle_sha256:bundle.sha256,remote_writes:0},null,2)+"\n",{flag:"wx"});
 console.log(JSON.stringify({date,edition_id:archive.edition_id,maps:bundle.maps.length,bytes:bytes.length,remote_writes:0}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
