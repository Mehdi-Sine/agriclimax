import type {Archive} from "../editorial-ai/model";
import {consultableEdition} from "../editorial-ai/consultable";

/** Factual revisions already have a completed, zero-cost ledger row. The legacy
 * recovery RPC only admits live archives; never send it a fallback checksum. */
export async function resumeArchivedEdition(
 archive:Archive,
 recoverLive:(payload:{edition_date:string;id:string;checksum:string})=>Promise<unknown>,
 publishMaps:(archive:Archive)=>void,
) {
 consultableEdition(archive);
 if(archive.mode==="live")await recoverLive({edition_date:archive.date,id:archive.edition_id,checksum:archive.checksum});
 publishMaps(archive);
 return {status:"archive_recovered",id:archive.edition_id,checksum:archive.checksum,paid_calls:0};
}
