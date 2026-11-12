import "server-only";
import {editorialRPC,SupabaseEditorialStore} from "../../features/editorial-ai/supabase-store";
import type {Run} from "../../features/editorial-ai/archive";
import {consultableEdition,verifyConsultable,unpackConsultable,type ConsultableEdition} from "../../features/editorial-ai/consultable";
import bootstrap from "../../data/editorial/consultable-bootstrap.json";
import {mapPreviewEdition} from "./edition-maps";
import {hash} from "../../features/editorial/temporal";
let previous:ConsultableEdition[]=[];
let sharedIds=new Set<string>();
export function sharedArchiveRead(id:string){return sharedIds.has(id);}
/** Archive-only reads. The controlled public copy bridges DEV/production and cold-start outages. */
export async function operationalEditions() {
 const editions=new Map<string,ConsultableEdition>();
 const liveIds=new Set<string>();
 for(const a of previous) try {editions.set(a.edition_id,verifyConsultable(a));}catch{/* retain other dates */}
 try {for(const a of unpackConsultable(bootstrap))editions.set(a.edition_id,a);}catch{/* corrupted copy is never served */}
 try {
  const runs=await editorialRPC<Run[]>("runs");
  for(const run of runs.filter(r=>r.archive_id&&["completed","validation_failed"].includes(r.state)).slice(-60)) {
   try {const store=new SupabaseEditorialStore("");let a=await store.read(run.archive_id!);
    if(a?.validation.status==="rejected")a=await store.read(hash([a.checksum,"experimental-factual-fallback-1"]))??a;
    if(a){editions.set(a.edition_id,consultableEdition(a));liveIds.add(a.edition_id);}}catch{/* skip this corrupt/incompatible archive and keep the previous edition */}
  }
 }catch{/* a durable public edition remains available during a database outage */}
 previous=[...editions.values()].sort((a,b)=>b.date.localeCompare(a.date)||b.revision-a.revision||b.generated_at.localeCompare(a.generated_at));
 sharedIds=liveIds;
 try{const preview=mapPreviewEdition();if(preview)return [preview,...previous.filter(e=>e.edition_id!==preview.edition_id)].sort((a,b)=>b.date.localeCompare(a.date)||b.revision-a.revision||b.generated_at.localeCompare(a.generated_at));}catch{/* invalid local recipe is never substituted */}
 return previous;
}
