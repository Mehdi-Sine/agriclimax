import "server-only";
import {editorialRPC,SupabaseEditorialStore} from "../../features/editorial-ai/supabase-store";
import {verifyArchive} from "../../features/editorial-ai/archive";
import type {Run} from "../../features/editorial-ai/archive";
import type {Archive} from "../../features/editorial-ai/model";
export interface EditorialReview {archive_id:string;checksum:string;decision:"approved"|"rejected";reviewed_by:string;reviewed_at:string}
export async function personalEditions() {
 const editions=await editorialRPC<Archive[]>("private_editions");
 const attempts=await editorialRPC<Run[]>("runs");
 // Owner inspection only; SQL approval and public promotion still reject these archives.
 const rejected=await Promise.all(attempts.filter(r=>r.state==="validation_failed"&&r.archive_id).slice(-30).map(r=>new SupabaseEditorialStore("").read(r.archive_id!)));
 for(const archive of rejected) if(archive?.mode==="live"&&archive.receipt&&archive.validation.status==="rejected") editions.push(archive);
 editions.forEach(a=>verifyArchive(a,false));
 return editions.filter(a=>a.mode==="live"&&a.receipt).sort((a,b)=>b.generated_at.localeCompare(a.generated_at));
}
export async function personalReviews() {return editorialRPC<EditorialReview[]>("reviews");}

export async function personalAttempts() {return editorialRPC<Run[]>("runs");}
