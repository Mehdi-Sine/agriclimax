import "server-only";
import {editorialRPC,SupabaseEditorialStore} from "../../features/editorial-ai/supabase-store";
import type {Run} from "../../features/editorial-ai/archive";
import {consultableEdition,verifyConsultable,unpackConsultable,type ConsultableEdition} from "../../features/editorial-ai/consultable";
import bootstrap from "../../data/editorial/consultable-bootstrap.json";
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
   try {const a=await new SupabaseEditorialStore("").read(run.archive_id!);if(a){editions.set(a.edition_id,consultableEdition(a));liveIds.add(a.edition_id);}}catch{/* skip this corrupt/incompatible archive and keep the previous edition */}
  }
 }catch{/* a durable public edition remains available during a database outage */}
 previous=[...editions.values()].sort((a,b)=>b.date.localeCompare(a.date)||b.generated_at.localeCompare(a.generated_at));
 sharedIds=liveIds;
 return previous;
}
