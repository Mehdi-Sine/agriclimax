import "server-only";
import {readFileSync,statSync,existsSync} from "node:fs";
import {join} from "node:path";
import {gunzipSync} from "node:zlib";
import {createHash} from "node:crypto";
import identities from "../../data/operational/pra-identities.json";
import type {AgroResult} from "../../features/agroclimatic/calculate";
export interface ManualMap {id:string;production:string;indicator:string;nature:string;period:[string,string];unit:string;source_sha256:string;rows:Pick<AgroResult,"territoryId"|"value"|"observed_value"|"status"|"reason"|"support_scope"|"spatial_coverage"|"temporal_coverage"|"data_freshness"|"rule_version"|"quality_flags"|"provenance">[]}
export type ManualMapInfo=Omit<ManualMap,"rows">;
let cached:{root:string;sha:string;maps:ManualMap[]}|undefined;
export function manualMaps():ManualMap[] {
 const root=process.env.AGRICLIMAX_MANUAL_RUN_DIR;if(!root||!existsSync(join(root,"maps-manifest.json")))return [];
 const manifest=JSON.parse(readFileSync(join(root,'maps-manifest.json'),'utf8')) as {sha256:string;bytes:number};
 if(cached?.root===root&&cached.sha===manifest.sha256)return cached.maps;
 const file=join(root,'maps.json.gz');if(statSync(file).size>8*1024**2)throw Error('MANUAL_MAP_BUDGET');
 const raw=readFileSync(file);if(raw.length!==manifest.bytes||createHash('sha256').update(raw).digest('hex')!==manifest.sha256)throw Error('MANUAL_MAP_CHECKSUM');
 const maps=JSON.parse(gunzipSync(raw,{maxOutputLength:64*1024**2}).toString()) as ManualMap[];
 if(!Array.isArray(maps)||maps.some(m=>m.rows.length!==713||new Set(m.rows.map(r=>r.territoryId)).size!==713||m.rows.some(r=>!identities.ids.includes(r.territoryId)||r.value!==null&&!Number.isFinite(r.value))))throw Error('MANUAL_MAP_CONTRACT');
 cached={root,sha:manifest.sha256,maps};return maps;
}
export function manualCatalogue():ManualMapInfo[]{return manualMaps().map(({rows,...m})=>{void rows;return m;});}
