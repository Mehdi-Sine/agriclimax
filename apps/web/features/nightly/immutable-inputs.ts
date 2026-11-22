import "server-only";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
export const FROZEN_INPUT_COMPRESSED_LIMIT = 8 * 1024 ** 2;
export const FROZEN_INPUT_DECODED_LIMIT = 128 * 1024 ** 2;
export function encodeFrozenInputs(value: unknown) {
  const json = JSON.stringify(value);
  const decoded_bytes = Buffer.byteLength(json);
  const bytes = decoded_bytes <= FROZEN_INPUT_DECODED_LIMIT ? gzipSync(json) : null;
  return {bytes,metrics:{decoded_bytes,decoded_limit:FROZEN_INPUT_DECODED_LIMIT,
    compressed_bytes:bytes?.length??null,compressed_limit:FROZEN_INPUT_COMPRESSED_LIMIT,
    exceeded:!bytes?"decoded":bytes.length>FROZEN_INPUT_COMPRESSED_LIMIT?"compressed":null}};
}
type EncodedInputs = ReturnType<typeof encodeFrozenInputs>;
export function validateFrozenInputBudget(encoded: EncodedInputs) {
  if (!encoded.bytes || encoded.metrics.exceeded) {
    console.error(JSON.stringify({error:"INPUT_ARCHIVE_BUDGET",...encoded.metrics}));
    throw Error("INPUT_ARCHIVE_BUDGET");
  }
  return encoded.bytes;
}
export function archiveInputs(value: unknown) {
  return storeFrozenInputs(encodeFrozenInputs(value));
}
/** Existing private bucket; content-addressed, no upsert and exact readback. */
export async function storeFrozenInputs(encoded: EncodedInputs) {
  const bytes = validateFrozenInputBudget(encoded);
  const sha256=createHash("sha256").update(bytes).digest("hex");
  const path=`editorial-inputs/${sha256}.json.gz`;
  const base=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SECRET_KEY;
  if(!base||!key) throw Error("INPUT_ARCHIVE_CONFIGURATION");
  const origin=new URL(base);
  if(origin.protocol!=="https:"||origin.username||origin.password||origin.pathname!=="/"||origin.search||origin.hash) throw Error("INPUT_ARCHIVE_ORIGIN");
  origin.pathname=`/storage/v1/object/pra-climate-archives/${path}`;
  const options={headers:{apikey:key},cache:"no-store" as const,redirect:"error" as const,signal:AbortSignal.timeout(12000)};
  let response=await fetch(origin,options);
  if(!response.ok) {
    if(![400,404].includes(response.status)) throw Error("INPUT_ARCHIVE_READ_FAILED");
    response=await fetch(origin,{...options,method:"POST",headers:{apikey:key,"Content-Type":"application/gzip"},body:bytes});
    // A concurrent immutable insert may win. Always verify the stored bytes below.
    if(!response.ok && ![400,409].includes(response.status)) throw Error("INPUT_ARCHIVE_WRITE_FAILED");
    response=await fetch(origin,{...options,signal:AbortSignal.timeout(12000)});
  }
  if(!response.ok) throw Error("INPUT_ARCHIVE_READBACK");
  const restored=Buffer.from(await response.arrayBuffer());
  if(!restored.equals(bytes)) throw Error("INPUT_ARCHIVE_INTEGRITY");
  return {path,sha256,bytes:bytes.length};
}
