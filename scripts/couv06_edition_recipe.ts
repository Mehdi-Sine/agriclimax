/** Read existing local replay material, attach frozen ERA evidence, write candidates locally only. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {freezeHistoricalCartography} from '../apps/web/lib/server/historical-cartography';
import {buildEditionMaps} from './int01_map_builder';
import {coveragePaint} from '../apps/web/features/cartography/coverage';
import {hash,shift} from '../apps/web/features/editorial/temporal';
import {verifyBundle,mapInfo} from '../apps/web/features/edition-maps/model';
import type {Archive} from '../apps/web/features/editorial-ai/model';
import type {DailyEditorialSnapshot} from '../apps/web/features/nightly/snapshot';
import type {ArchivedDaily,NationalWeatherDocument} from '../apps/web/lib/server/weather-archives';
import {gunzipSync} from 'node:zlib';
import {verifyConsultable,type ConsultableEdition} from '../apps/web/features/editorial-ai/consultable';
async function main(){
const root=process.argv[2];
if(!root)throw Error('LOCAL_REPLAY_ROOT_REQUIRED');
const archive=JSON.parse(readFileSync(join(root,'archive.json'),'utf8')) as Archive;
const snapshot=JSON.parse(readFileSync(join(root,'snapshot.json'),'utf8')) as DailyEditorialSnapshot;
const inputs=JSON.parse(gunzipSync(readFileSync(join(root,'frozen-inputs.json.gz'))).toString()) as {history:ArchivedDaily[];document:NationalWeatherDocument|null};
const begun=performance.now();
const original=buildEditionMaps(archive,snapshot,inputs);
const end=archive.briefing.validity.history_cutoff;
const historical_cartography=await freezeHistoricalCartography(inputs.history,[shift(end,-6),end]);
const enriched={...inputs,historical_cartography};
const bytes=gzipSync(JSON.stringify(enriched));
console.log(JSON.stringify({input_bytes:bytes.length,support_bytes:gzipSync(JSON.stringify(historical_cartography)).length}));
if(bytes.length>8*1024**2||Buffer.byteLength(JSON.stringify(enriched))>96*1024**2)throw Error('INPUT_ARCHIVE_BUDGET');
const sha256=createHash('sha256').update(bytes).digest('hex');
const {id:oldId,...body}=snapshot;void oldId;
const newBody={...body,input_archive:{sha256,path:`editorial-inputs/${sha256}.json.gz`,bytes:bytes.length}};
const candidateSnapshot={...newBody,id:hash(newBody)};
const candidate=buildEditionMaps(archive,candidateSnapshot,enriched);
verifyBundle(candidate,archive);
const replay=buildEditionMaps(archive,candidateSnapshot,JSON.parse(gunzipSync(bytes).toString()));
if(replay.sha256!==candidate.sha256)throw Error('REPLAY_MISMATCH');
const maps=candidate.maps.map(map=>{
 const before=original.maps.find(m=>m.indicator===map.indicator&&m.nature===map.nature)!;
 const supports=new Map(map.rendering?.covered_support.features.map(f=>[String(f.id),f.properties.support_id]));
 const counts={whole:0,covered:0,unavailable:0};let preserved=0,added=0;
 for(const row of map.rows){
  const prior=before.rows.find(r=>r.territoryId===row.territoryId)!;
  if(prior.value!==null){if(prior.value!==row.value)throw Error('EXISTING_VALUE_CHANGED');preserved++;}
  if(prior.value===null&&prior.observed_value===null&&(row.value??row.observed_value)!==null)added++;
  counts[coveragePaint({value:row.value??row.observed_value??null,quality:row.quality,field:'value',geometrySupportId:supports.get(row.territoryId)}).target]++;
 }
 return {...mapInfo(map),before:mapInfo(before).coverage,render_counts:counts,preserved,added};
});
for(const [label,bundle] of [['before',original],['after',candidate]] as const){
 const out=`work/couv06/edition-${label}`;mkdirSync(out,{recursive:true});
 writeFileSync(join(out,`${archive.edition_id}.json`),JSON.stringify(bundle));
 const consultable=JSON.parse(readFileSync(join(root,'consultable-edition.json'),'utf8')) as ConsultableEdition;
 // Local recipe only: retain the exact editorial choices, map them to the new sealed identities.
 if(label==='after'&&consultable.map_selection){
  const translate=(id:string)=>{const prior=original.maps.find(m=>m.id===id)!;return candidate.maps.find(m=>m.indicator===prior.indicator&&m.nature===prior.nature)!.id;};
  consultable.map_selection={hero_map_id:consultable.map_selection.hero_map_id?translate(consultable.map_selection.hero_map_id):null,map_ids:consultable.map_selection.map_ids.map(translate)};
  const {content_sha256,...body}=consultable;void content_sha256;consultable.content_sha256=hash(body);
 }
 verifyConsultable(consultable);
 writeFileSync(join(out,'consultable-edition.json'),JSON.stringify(consultable));
}
writeFileSync('work/couv06/edition-after/frozen-inputs.json.gz',bytes);
const report={status:'local_candidate_not_published',original_bundle_sha256:original.sha256,candidate_bundle_sha256:candidate.sha256,
 original_input_sha256:snapshot.input_archive!.sha256,candidate_input_sha256:sha256,input_bytes:bytes.length,
 input_decoded_bytes:Buffer.byteLength(JSON.stringify(enriched)),bundle_bytes:gzipSync(JSON.stringify(candidate)).length,maps,ms:Math.round(performance.now()-begun),rss_bytes:process.memoryUsage().rss,
 identical_replay:true,remote_writes:0,openai_calls:0};
writeFileSync('docs/codex/COUV-06/evidence/edition-recipe.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,maps:maps.map(m=>({indicator:m.indicator,nature:m.nature,added:m.added,render_counts:m.render_counts}))}));

}
void main().catch(error=>{console.error(error);process.exitCode=1;});
