/** Real fresh weather -> local immutable persistence -> existing AGRO/INT-01 contracts.
 * No remote writes, provider calls, AI receipt fabrication or publication.
 */
import {mkdirSync,readFileSync,writeFileSync,existsSync} from "node:fs";
import {resolve,join,dirname,relative} from "node:path";
import {createHash} from "node:crypto";
import {gzipSync} from "node:zlib";
import {prepareDossier} from "./nightly_prepare";
import {recomputeIndicators} from "./manual_indicators";
import {buildEditionMaps} from "./int01_map_builder";
import {decodeNationalWeather,type ArchiveEntry} from "../apps/web/lib/server/weather-archives";
import {verifySnapshot} from "../apps/web/features/nightly/snapshot";
import {hash} from "../apps/web/features/editorial/temporal";
import {parisDate} from "../apps/web/features/editorial/almanac";
import {fallbackDraft} from "../apps/web/features/editorial-ai/fallback";
import {sealArchive,verifyArchive} from "../apps/web/features/editorial-ai/archive";
import {validateDraft} from "../apps/web/features/editorial-ai/validate";
import {ENGINE,PROMPT_VERSION,CONFIG_VERSION} from "../apps/web/features/editorial-ai/model";
import {INSTRUCTIONS} from "../apps/web/features/editorial-ai/prompt";
import {mapInfo,verifyBundle} from "../apps/web/features/edition-maps/model";
import {encodeMapBundle} from "../apps/web/lib/server/edition-maps";

function arg(name:string){const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];}
const sha=(raw:Uint8Array)=>createHash("sha256").update(raw).digest("hex");
async function main(){
 const weather=arg("--weather"),output=arg("--out");
 if(!weather||!output)throw Error("USAGE_WEATHER_AND_OUT_REQUIRED");
 const root=resolve(output),rel=relative(resolve("work"),root);
 if(!rel||rel.startsWith("..")||existsSync(join(root,"report.json")))throw Error("NEW_WORK_RECIPE_DIRECTORY_REQUIRED");
 mkdirSync(root,{recursive:true});
 const origin=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin,transport=globalThis.fetch;
 let remoteReads=0;
 globalThis.fetch=async(input,init)=>{
  const request=new Request(input,init);
  if(request.method!=="GET"||new URL(request.url).origin!==origin)throw Error("READ_ONLY_RECIPE_NETWORK_BLOCKED");
  remoteReads++;return transport(request);
 };
 const insert=(path:string,bytes:Uint8Array)=>{
  const target=join(root,path);mkdirSync(dirname(target),{recursive:true});
  if(existsSync(target)){if(!readFileSync(target).equals(Buffer.from(bytes)))throw Error("LOCAL_IMMUTABLE_CONFLICT");}
  else writeFileSync(target,bytes,{flag:"wx"});
  if(sha(readFileSync(target))!==sha(bytes))throw Error("LOCAL_PERSISTENCE_INTEGRITY");
 };
 const raw=readFileSync(weather),checksum=sha(raw),document=decodeNationalWeather(raw,checksum);
 const date=arg("--date")??parisDate(new Date().toISOString());
 const entry:ArchiveEntry={path:`weather/${checksum}.json.gz`,sha256:checksum,bytes:raw.length,
  dates:[...new Set(document.rows.map(r=>r.valid_date))],run_date:document.run.slice(0,10),run_at:document.run,
  method_version:"pra-national-weather-daily-1",pra_count:713};
 insert(entry.path,raw);
 let indicators:Awaited<ReturnType<typeof recomputeIndicators>>|undefined;
 const prepared=await prepareDossier({date,out:root,readOnly:true,recover:true,persistInputs:false,
  extraWeather:{entry,document},calculate:async(rows,doc)=>{
   if(doc?.archive_sha256!==checksum)throw Error("FRESH_WEATHER_NOT_SELECTED");
   indicators=await recomputeIndicators(rows,doc,date);return indicators.contributions;
  }});
 const bytes=gzipSync(JSON.stringify(prepared.inputs)),inputSha=sha(bytes);
 insert(`editorial-inputs/${inputSha}.json.gz`,bytes);
 const snapshot=prepared.snapshot;
 snapshot.input_archive={path:`editorial-inputs/${inputSha}.json.gz`,sha256:inputSha,bytes:bytes.length};
 const {id:unused,...body}=snapshot;void unused;snapshot.id=hash(body);verifySnapshot(snapshot);
 const briefing=snapshot.briefing;if(!briefing)throw Error("RECIPE_BRIEFING_ABSENT");
 const draft=fallbackDraft(briefing),validation=validateDraft(draft,briefing);
 const archive=sealArchive({version:"editorial-archive-1",edition_id:hash(["mf01-local-only",snapshot.id,draft]),
  revision:1,supersedes:null,date,generated_at:briefing.generated_at,engine:ENGINE,prompt_version:PROMPT_VERSION,
  config_version:CONFIG_VERSION,mode:"fallback",status:validation.status,draft,briefing,illustrations:[],validation,
  receipt:null,prompt_sha256:hash(INSTRUCTIONS),parameters:{model:"deterministic-local-recipe",max_output_tokens:6000}});
 verifyArchive(archive);
 insert("snapshot.json",Buffer.from(JSON.stringify(snapshot)));
 insert("archive.json",Buffer.from(JSON.stringify(archive)));
 const restored=JSON.parse(readFileSync(join(root,"archive.json"),"utf8"));verifyArchive(restored);
 const bundle=buildEditionMaps(restored,snapshot,prepared.inputs);
 const replay=buildEditionMaps(restored,snapshot,prepared.inputs);
 if(replay.sha256!==bundle.sha256)throw Error("MAP_REPLAY_MISMATCH");
 const pack=encodeMapBundle(bundle);insert(pack.reference.path,pack.bytes);
 verifyBundle(bundle,restored);
 insert("maps.json",Buffer.from(JSON.stringify(bundle)));
 const report={status:"candidate_not_published",scope:"local_immutable_persistence_with_remote_get_only",
  weather:{sha256:checksum,run:document.run,acquired_at:document.acquired_at,valid_dates:entry.dates},
  edition:{id:archive.edition_id,mode:archive.mode,validation:validation.status,consultable:false,
   blocker:"NEW_FALLBACK_CANDIDATE_HAS_NO_LIVE_AI_RECEIPT"},snapshot_id:snapshot.id,input_archive_sha256:inputSha,
  indicators:{measurements:indicators?.measurements,errors:indicators?.errors},
  bundle_sha256:bundle.sha256,maps:bundle.maps.map(mapInfo),replay_identical:true,
  persistence:{local_readback_verified:true,operational_supabase_weather_persisted:false,remote_reads:remoteReads,remote_writes:0},
  openai_calls:0,publication:false};
 insert("report.json",Buffer.from(JSON.stringify(report,null,2)));
 console.log(JSON.stringify({...report,maps:report.maps.map(m=>({indicator:m.indicator,nature:m.nature,period:m.period,coverage:m.coverage}))}));
}
main().catch(error=>{console.error(error instanceof Error&&/^[A-Z][A-Z0-9_]+$/.test(error.message)?error.message:"MF01_INTEGRATION_RECIPE_FAILED");process.exitCode=1;});
