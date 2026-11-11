import {sealArchive,verifyArchive} from "./archive";
import {validateDraft} from "./validate";
import {hash} from "../editorial/temporal";
import type {Archive} from "./model";
export const REVALIDATION_VERSION="editorial-revalidation-negation-1";
/** Reassess the same immutable provider output; never edit prose or call a provider. */
export function revalidateArchive(original:Archive,expectedChecksum:string):Archive {
 verifyArchive(original,false);
 if(original.checksum!==expectedChecksum||original.mode!=="live"||!original.receipt) throw Error("REVALIDATION_SOURCE_REQUIRED");
 const validation=validateDraft(original.draft,original.briefing,original.illustrations);
 if(validation.status==="rejected") throw Error("REVALIDATION_REJECTED");
 const {checksum,...body}=original;void checksum;
 const result=sealArchive({...body,edition_id:hash([original.checksum,REVALIDATION_VERSION,validation]),
  revision:original.revision+1,supersedes:original.edition_id,status:validation.status,validation});
 verifyArchive(result);
 return result;
}
