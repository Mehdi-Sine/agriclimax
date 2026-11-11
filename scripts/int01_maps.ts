/** INT-01: read-only preparation by default; publication requires an exact reviewed bundle. No AI imports. */
import {mkdirSync,writeFileSync,readFileSync} from "node:fs";
import {join,resolve} from "node:path";
import {gunzipSync} from "node:zlib";
import {createHash} from "node:crypto";
import {editorialRPC,SupabaseEditorialStore} from "../apps/web/features/editorial-ai/supabase-store";
import {consultableEdition} from "../apps/web/features/editorial-ai/consultable";
import {verifySnapshot,type DailyEditorialSnapshot} from "../apps/web/features/nightly/snapshot";
import {verifyBundle,mapInfo,type MapApproval} from "../apps/web/features/edition-maps/model";
import {publishMapBundle,encodeMapBundle} from "../apps/web/lib/server/edition-maps";
import type {ArchivedDaily,NationalWeatherDocument} from "../apps/web/lib/server/weather-archives";
import {buildEditionMaps} from "./int01_map_builder";
const [command,id]=process.argv.slice(2);
function arg(name:string){const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];}
async function main(){
  if(!["prepare","publish"].includes(command)||!id||!/^[a-f0-9]{64}$/.test(id))throw Error("USAGE_INT01_PREPARE_OR_PUBLISH_EDITION_ID");
  const archive=await new SupabaseEditorialStore("").read(id);if(!archive)throw Error("MAP_EDITION_NOT_FOUND");
  const publicEdition=consultableEdition(archive); // preserves existing text admission; never promotes/revalidates it
  const publish=command==="publish";
  if(publish&&(!process.argv.includes("--execute")||!arg("--bundle")||!arg("--approval")||!arg("--expected-bundle")))throw Error("EXPLICIT_MAP_PUBLICATION_REQUIRED");
  const snapshot=await editorialRPC<DailyEditorialSnapshot|null>("snapshot_read",{edition_date:archive.date});
  if(!snapshot?.input_archive)throw Error("MAP_FROZEN_INPUTS_MISSING");verifySnapshot(snapshot);
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
  const bundle=buildEditionMaps(archive,snapshot,inputs);
  if(publish){
    const path=arg("--bundle"),review=arg("--approval"),expected=arg("--expected-bundle");
    if(!process.argv.includes("--execute")||!path||!review||!expected)throw Error("EXPLICIT_MAP_PUBLICATION_REQUIRED");
    const reviewed=verifyBundle(JSON.parse(readFileSync(path,"utf8")),archive);
    const approval=JSON.parse(readFileSync(review,"utf8")) as MapApproval;
    if(bundle.sha256!==expected||reviewed.sha256!==bundle.sha256)throw Error("EXACT_MAP_BUNDLE_REQUIRED");
    const control=await editorialRPC<{emergency_stop:boolean;publication_enabled:boolean}>("control");
    if(control.emergency_stop||!control.publication_enabled)throw Error("MAP_PUBLICATION_DISABLED");
    // Review covers descriptive cartography only. Editorial approval remains independently required.
    console.log(JSON.stringify({status:"published",publication:await publishMapBundle(bundle,approval),openai_calls:0}));return;
  }
  const out=resolve(arg("--out")??"work/int-01/candidates");mkdirSync(out,{recursive:true});
  writeFileSync(join(out,`${id}.json`),JSON.stringify(bundle));
  writeFileSync(join(out,"maps.json.gz"),encodeMapBundle(bundle).bytes);
  writeFileSync(join(out,"consultable-edition.json"),JSON.stringify(publicEdition));
  // Capture provider-independent replay material locally, with the original exact compressed bytes.
  writeFileSync(join(out,"frozen-inputs.json.gz"),bytes);
  writeFileSync(join(out,"snapshot.json"),JSON.stringify(snapshot));
  writeFileSync(join(out,"archive.json"),JSON.stringify(archive));
  const report={status:"candidate_not_published",edition_id:id,edition_checksum:archive.checksum,bundle_sha256:bundle.sha256,
    snapshot_id:snapshot.id,input_archive_sha256:entry.sha256,maps:bundle.maps.map(mapInfo),remote_writes:0,openai_calls:0};
  writeFileSync(join(out,"report.json"),JSON.stringify(report,null,2));
  console.log(JSON.stringify({...report,maps:report.maps.map(m=>({indicator:m.indicator,nature:m.nature,period:m.period,coverage:m.coverage}))}));
}
main().catch(e=>{console.error(e instanceof Error&&/^[A-Z][A-Z0-9_]+$/.test(e.message)?e.message:"INT01_MAPS_FAILED");process.exitCode=1;});
