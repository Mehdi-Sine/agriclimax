import {gunzipSync} from "node:zlib";
import {createHash} from "node:crypto";
import type {DailyEditorialSnapshot} from "../apps/web/features/nightly/snapshot";
import type {ArchivedDaily,NationalWeatherDocument} from "../apps/web/lib/server/weather-archives";
export async function readFrozenMapInputs(snapshot:DailyEditorialSnapshot){
  if(!snapshot.input_archive)throw Error("MAP_FROZEN_INPUTS_MISSING");
  const entry=snapshot.input_archive;
  if(entry.path!==`editorial-inputs/${entry.sha256}.json.gz`||entry.bytes>8*1024**2)throw Error("MAP_INPUT_PATH");
  const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  url.pathname=`/storage/v1/object/pra-climate-archives/${entry.path}`;
  const r=await fetch(url,{headers:{apikey:process.env.SUPABASE_SECRET_KEY!},redirect:"error",cache:"no-store",signal:AbortSignal.timeout(30000)});
  if(!r.ok||!r.body)throw Error("MAP_INPUT_READ");
  const reader=r.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8*1024**2){await reader.cancel();throw Error("MAP_INPUT_BUDGET");}chunks.push(value);}
  const bytes=Buffer.concat(chunks,size);
  if(bytes.length!==entry.bytes||createHash("sha256").update(bytes).digest("hex")!==entry.sha256)throw Error("MAP_INPUT_CHECKSUM");
  const inputs=JSON.parse(gunzipSync(bytes,{maxOutputLength:96*1024**2}).toString()) as {history:ArchivedDaily[];document:NationalWeatherDocument|null};
  return {inputs,bytes};
}
