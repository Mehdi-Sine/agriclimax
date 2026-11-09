import "server-only";
import {editorialRPC} from "../../features/editorial-ai/supabase-store";
import {verifyArchive} from "../../features/editorial-ai/archive";
import type {Run} from "../../features/editorial-ai/archive";
import type {Archive} from "../../features/editorial-ai/model";
export interface EditorialReview {archive_id:string;checksum:string;decision:"approved"|"rejected";reviewed_by:string;reviewed_at:string}
export async function personalEditions() {
 const editions=await editorialRPC<Archive[]>("private_editions");
 editions.forEach(verifyArchive);
 return editions.filter(a=>a.mode==="live"&&a.receipt&&a.validation.status!=="rejected"&&a.validation.errors.length===0);
}
export async function personalReviews() {return editorialRPC<EditorialReview[]>("reviews");}

export async function personalAttempts() {return editorialRPC<Run[]>("runs");}
