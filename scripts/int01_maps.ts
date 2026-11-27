/** INT-01: read-only preparation by default; publication requires an exact reviewed bundle. No AI imports. */
import {mkdirSync,writeFileSync,readFileSync} from "node:fs";
import {join,resolve} from "node:path";
import {readFrozenMapInputs} from "./edit04_frozen";
import {editorialRPC,SupabaseEditorialStore} from "../apps/web/features/editorial-ai/supabase-store";
import {consultableEdition} from "../apps/web/features/editorial-ai/consultable";
import {verifySnapshot,type DailyEditorialSnapshot} from "../apps/web/features/nightly/snapshot";
import {verifyBundle,mapInfo,type MapApproval} from "../apps/web/features/edition-maps/model";
import {publishMapBundle,encodeMapBundle,readPublishedMaps} from "../apps/web/lib/server/edition-maps";
import {selectedMapIds} from "../apps/web/features/editorial-map-selection/daily";
import {publishJournal} from "./opti01_journal_projection";
import type {Archive} from "../apps/web/features/editorial-ai/model";
import type {EditionMapBundle} from "../apps/web/features/edition-maps/model";
import {buildEditionMaps} from "./int01_map_builder";
const [command,id]=process.argv.slice(2);
function arg(name:string){const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];}
async function journalProjection(archive: Archive, bundle: EditionMapBundle, execute: boolean) {
  const cwd = process.cwd();
  process.chdir(resolve("apps/web"));
  try {
    console.log(JSON.stringify({edition_id:archive.edition_id, ...await publishJournal(archive,bundle,undefined,execute)}));
  } finally {process.chdir(cwd);}
}
async function optionalJournalProjection(archive: Archive, bundle: EditionMapBundle) {
  if (process.env.AGRICLIMAX_JOURNAL_PROJECTION_ENABLED !== "true") return;
  try {await journalProjection(archive,bundle,true);}
  catch {console.error("JOURNAL_PROJECTION_PENDING");}
}
async function main(){
  if(!["prepare","publish","publish-experimental","journal-projection"].includes(command)||!id||!/^[a-f0-9]{64}$/.test(id))throw Error("USAGE_INT01_PREPARE_OR_PUBLISH_EDITION_ID");
  const archive=await new SupabaseEditorialStore("").read(id);if(!archive)throw Error("MAP_EDITION_NOT_FOUND");
  const publicEdition=consultableEdition(archive); // preserves existing text admission; never promotes/revalidates it
  if (command==="journal-projection") {
    const {operationalEditions} = await import("../apps/web/lib/server/editorial-published");
    const admitted = (await operationalEditions(archive.date)).some(edition =>
      edition.edition_id === archive.edition_id && edition.checksum === archive.checksum);
    if (!admitted) throw Error("JOURNAL_EDITION_NOT_CONSULTABLE");
    const existing = await readPublishedMaps(archive);
    if (!existing) throw Error("MAP_NOT_PUBLISHED");
    if (process.argv.includes("--execute")) {
      const control=await editorialRPC<{emergency_stop:boolean}>("control");
      if (control.emergency_stop) throw Error("EMERGENCY_STOP");
    }
    await journalProjection(archive,existing,process.argv.includes("--execute"));
    return;
  }
  const publish=command==="publish";
  if(publish&&(!process.argv.includes("--execute")||!arg("--bundle")||!arg("--approval")||!arg("--expected-bundle")))throw Error("EXPLICIT_MAP_PUBLICATION_REQUIRED");
  const snapshot=await editorialRPC<DailyEditorialSnapshot|null>("snapshot_read",{edition_date:archive.date});
  if(!snapshot?.input_archive)throw Error("MAP_FROZEN_INPUTS_MISSING");verifySnapshot(snapshot);
  const {inputs,bytes}=await readFrozenMapInputs(snapshot);
  const bundle=buildEditionMaps(archive,snapshot,inputs);
  if(archive.map_selection)selectedMapIds(archive.map_selection,bundle);
  if(command==="publish-experimental"){
    const control=await editorialRPC<{emergency_stop:boolean}>("control");
    if(control.emergency_stop)throw Error("EMERGENCY_STOP");
    // Machine qualification is explicit; this is not a human scientific certification.
    const prior=await readPublishedMaps(archive);
    if(prior){if(prior.sha256!==bundle.sha256)throw Error("MAP_IMMUTABLE_CONFLICT");await optionalJournalProjection(archive,prior);console.log(JSON.stringify({status:"already_published",edition_id:id}));return;}
    const approval:MapApproval={bundle_sha256:bundle.sha256,reviewer:"automatic:experimental-integrity-1",reviewed_at:new Date().toISOString(),scope:"descriptive_maps"};
    await publishMapBundle(bundle,approval);
    await optionalJournalProjection(archive,bundle);
    console.log(JSON.stringify({status:"published_experimental",edition_id:id,bundle_sha256:bundle.sha256,maps:bundle.maps.map(mapInfo)}));return;
  }
  if(publish){
    const path=arg("--bundle"),review=arg("--approval"),expected=arg("--expected-bundle");
    if(!process.argv.includes("--execute")||!path||!review||!expected)throw Error("EXPLICIT_MAP_PUBLICATION_REQUIRED");
    const reviewed=verifyBundle(JSON.parse(readFileSync(path,"utf8")),archive);
    const approval=JSON.parse(readFileSync(review,"utf8")) as MapApproval;
    if(bundle.sha256!==expected||reviewed.sha256!==bundle.sha256)throw Error("EXACT_MAP_BUNDLE_REQUIRED");
    const control=await editorialRPC<{emergency_stop:boolean;publication_enabled:boolean}>("control");
    if(control.emergency_stop||!control.publication_enabled)throw Error("MAP_PUBLICATION_DISABLED");
    // Review covers descriptive cartography only. Editorial approval remains independently required.
    const publication=await publishMapBundle(bundle,approval);
    await optionalJournalProjection(archive,bundle);
    console.log(JSON.stringify({status:"published",publication,openai_calls:0}));return;
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
    snapshot_id:snapshot.id,input_archive_sha256:snapshot.input_archive.sha256,maps:bundle.maps.map(mapInfo),remote_writes:0,openai_calls:0};
  writeFileSync(join(out,"report.json"),JSON.stringify(report,null,2));
  console.log(JSON.stringify({...report,maps:report.maps.map(m=>({indicator:m.indicator,nature:m.nature,period:m.period,coverage:m.coverage}))}));
}
main().catch(e=>{console.error(e instanceof Error&&/^[A-Z][A-Z0-9_]+$/.test(e.message)?e.message:"INT01_MAPS_FAILED");process.exitCode=1;});
