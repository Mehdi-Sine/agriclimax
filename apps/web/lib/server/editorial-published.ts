import "server-only";
import {editorialRPC,SupabaseEditorialStore} from "../../features/editorial-ai/supabase-store";
import type {Run} from "../../features/editorial-ai/archive";
import {consultableEdition,verifyConsultable,unpackConsultable,type ConsultableEdition} from "../../features/editorial-ai/consultable";
import bootstrap from "../../data/editorial/consultable-bootstrap.json";
import {mapPreviewEdition,readPublishedMaps} from "./edition-maps";
import {selectedMapIds} from "../../features/editorial-map-selection/daily";
import {hash} from "../../features/editorial/temporal";
let previous:ConsultableEdition[]=[];
let sharedIds=new Set<string>();
export function sharedArchiveRead(id:string){return sharedIds.has(id);}
/** Archive-only reads. The controlled public copy bridges DEV/production and cold-start outages. */
let loading:Promise<ConsultableEdition[]>|undefined;
/** Share concurrent page/map reads, but recheck publication on every later request. */
export function operationalEditions() {
 if(!loading)loading=readOperationalEditions().finally(()=>{loading=undefined;});
 return loading;
}
async function readOperationalEditions() {
 const editions=new Map<string,ConsultableEdition>();
 const liveIds=new Set<string>();
 for(const a of previous) try {editions.set(a.edition_id,verifyConsultable(a));}catch{/* retain other dates */}
 try {for(const a of unpackConsultable(bootstrap))editions.set(a.edition_id,a);}catch{/* corrupted copy is never served */}
 try {
  const runs=await editorialRPC<Run[]>("runs");
  const ids=[...new Set(runs.filter(r=>r.archive_id&&["completed","validation_failed","outcome_unknown"].includes(r.state)).slice(-60).map(r=>r.archive_id!))];
  const store=new SupabaseEditorialStore("");
  // Rejected runs can point to the same fallback as a completed run. Read each
  // immutable archive once per refresh, including failed reads (retried next time).
  const reads=new Map<string,ReturnType<typeof store.read>>();
  const read=(id:string)=>{let value=reads.get(id);if(!value){value=store.read(id);reads.set(id,value);}return value;};
  const results=new Array<ConsultableEdition|undefined>(ids.length);
  let next=0;
  // Bound pressure on storage while avoiding one network round trip per archive
  // in series on a cold Vercel instance. Selection order remains deterministic.
  await Promise.all(Array.from({length:Math.min(6,ids.length)},async()=>{
   for(let index=next++;index<ids.length;index=next++) {
   try {let a=await read(ids[index]);
    if(runs.some(r=>r.archive_id===ids[index]&&r.state==="outcome_unknown")&&a?.mode!=="fallback")continue;
    if(a?.validation.status==="rejected")a=await read(hash([a.checksum,"experimental-factual-fallback-1"]))??a;
    if(a){const edition=consultableEdition(a);
     // New experimental publications become visible only after the immutable map commit.
     if(a.map_selection||["editorial-board-fr-4","editorial-board-fr-5"].includes(a.prompt_version)||a.mode==="fallback"){
      const maps=await readPublishedMaps(a);if(!maps)continue;
      if(a.map_selection)selectedMapIds(a.map_selection,maps);
     }
     results[index]=edition;}}catch{/* skip this corrupt/incompatible archive and keep the previous edition */}
   }
  }));
  for(const edition of results)if(edition){editions.set(edition.edition_id,edition);liveIds.add(edition.edition_id);}
 }catch{/* a durable public edition remains available during a database outage */}
 previous=[...editions.values()].sort((a,b)=>b.date.localeCompare(a.date)||b.revision-a.revision||b.generated_at.localeCompare(a.generated_at));
 sharedIds=liveIds;
 try{const preview=mapPreviewEdition();if(preview)return [preview,...previous.filter(e=>e.edition_id!==preview.edition_id)].sort((a,b)=>b.date.localeCompare(a.date)||b.revision-a.revision||b.generated_at.localeCompare(a.generated_at));}catch{/* invalid local recipe is never substituted */}
 return previous;
}
