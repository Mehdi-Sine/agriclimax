import "server-only";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
/** Existing private bucket; content-addressed, no upsert and exact readback. */
export async function archiveInputs(value: unknown) {
  const bytes = gzipSync(JSON.stringify(value));
  if(bytes.length>8*1024**2) throw Error("INPUT_ARCHIVE_BUDGET");
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
