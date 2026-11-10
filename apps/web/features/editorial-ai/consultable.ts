import {hash} from "../editorial/temporal";
import {verifyArchive} from "./archive";
import {validateDraft} from "./validate";
import {assertDraft} from "./validate";
import type {Archive,Validation} from "./model";
import {gunzipSync} from "node:zlib";
import {createHash} from "node:crypto";
/** Public editorial content only. Provider receipts, parameters and diagnostics stay server-side. */
export type ConsultableEdition=Pick<Archive,"edition_id"|"revision"|"date"|"generated_at"|"mode"|"status"|"draft"|"illustrations"|"validation"|"checksum">&{
 briefing:{bundle_id:string;edition_date:string;validity:Archive["briefing"]["validity"];national:Pick<Archive["briefing"]["national"],"facts">;seasonal:Pick<Archive["briefing"]["seasonal"],"windows">;documentary:Pick<Archive["briefing"]["documentary"],"publications">};
 assessment:Validation;consultable:true;scientifically_validated:boolean;content_sha256:string;
};
// Editorial evidence resolution affects certification, not experimental text access.
// Identity, structured figures and map bindings still fail closed.
const incompatible=new Set(["DRAFT_CONTRACT","DRAFT_IDENTITY","CANDIDATE_REFERENCE","DOCUMENTARY_REFERENCE","REGION_REFERENCE","PRODUCTION_REFERENCE","FIGURE_MISMATCH","FIGURE_REGION","FIGURE_SCOPE","FIGURE_NATURE","PRA_ATTRIBUTION","ILLUSTRATION_CONTEXT"]);
export function consultableEdition(a:Archive):ConsultableEdition {
 verifyArchive(a,false);
 if(a.mode!=="live"||!a.receipt?.response_id||a.briefing.status==="insufficient") throw Error("NOT_A_CONSULTABLE_AI_EDITION");
 const assessment=validateDraft(a.draft,a.briefing,a.illustrations);
 if(assessment.errors.some(e=>incompatible.has(e))) throw Error("INCOMPATIBLE_EDITORIAL_DATA");
 const body={edition_id:a.edition_id,revision:a.revision,date:a.date,generated_at:a.generated_at,mode:a.mode,status:a.status,consultable:true as const,scientifically_validated:assessment.status==="validated_automatically"&&a.validation.status==="validated_automatically",
  draft:a.draft,briefing:{bundle_id:a.briefing.bundle_id,edition_date:a.briefing.edition_date,validity:a.briefing.validity,national:{facts:a.briefing.national.facts},seasonal:{windows:a.briefing.seasonal.windows},documentary:{publications:a.briefing.documentary.publications}},illustrations:a.illustrations,validation:a.validation,checksum:a.checksum,assessment};
 return {...body,content_sha256:hash(body)};
}
export function verifyConsultable(value:unknown):ConsultableEdition {
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("CONSULTABLE_CONTENT_INTEGRITY");
 const a=value as ConsultableEdition;
 const {content_sha256,...body}=a;
 if(hash(body)!==content_sha256||a.mode!=="live"||a.consultable!==true||typeof a.scientifically_validated!=="boolean"||a.date!==a.draft.edition_date||a.date!==a.briefing.edition_date) throw Error("CONSULTABLE_CONTENT_INTEGRITY");
 assertDraft(a.draft);
 if(a.briefing.bundle_id!==a.draft.bundle_id||!Array.isArray(a.briefing.national.facts)||!Array.isArray(a.briefing.seasonal.windows)||!Array.isArray(a.briefing.documentary.publications)||a.assessment.errors.some(e=>incompatible.has(e))) throw Error("INCOMPATIBLE_EDITORIAL_DATA");
 return a;
}
/** Same exact-byte pack as historical previews: bundlers must never rewrite scientific floats. */
export function unpackConsultable(pack:{version:string;bytes:number;sha256:string;content:string}) {
 if(pack.version!=="consultable-archive-pack-1")throw Error("CONSULTABLE_PACK_VERSION");
 const raw=gunzipSync(Buffer.from(pack.content,"base64"),{maxOutputLength:2*1024**2});
 if(raw.length!==pack.bytes||createHash("sha256").update(raw).digest("hex")!==pack.sha256)throw Error("CONSULTABLE_PACK_INTEGRITY");
 const values:unknown=JSON.parse(raw.toString());
 if(!Array.isArray(values))throw Error("CONSULTABLE_PACK_INTEGRITY");
 return values.map(verifyConsultable);
}
