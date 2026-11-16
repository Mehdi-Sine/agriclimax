/** Real aggregate archive fallback check; never a native-geography acceptance test. */
import {expect,it,vi} from 'vitest';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
vi.mock('server-only',()=>({}));
import {unpackWeatherArchive} from '../../lib/server/weather-archive-codec';
import {thumbnailSvg} from '../../lib/server/map-thumbnail';
import {weatherQualityBundle,weatherQualityKey} from '../climate-quality/adapters';
import type {WeatherRow} from '../operational/model';
import type {EditionMap} from '../edition-maps/model';
import {coveragePaint} from './coverage';
const archive=process.env.COUV05_REAL_ARCHIVE;
it.skipIf(!archive)('keeps all 713 contours and numeric values with real archive / missing native proof',()=>{
  const raw=readFileSync(archive!),sha=createHash('sha256').update(raw).digest('hex');
  const d=unpackWeatherArchive(raw,sha),all=d.rows as WeatherRow[];
  const date='2026-11-15';
  const rows=all.filter(r=>r.model==='arpege-0p1'&&r.valid_date===date&&r.variable==='temperature');
  expect(rows).toHaveLength(713);
  const before=weatherQualityBundle(rows),after=weatherQualityBundle(rows,{proofs:[],referenceSha:''});
  const make=(q:typeof before):EditionMap=>({id:'forecast-fallback-real',indicator:'temperature_mean',title:'Température moyenne',
    nature:'forecast',period:[date,date],unit:'°C',sources:['meteofrance-arpege'],cycles:[rows[0].model_run_at!],input_sha256:sha,
    rows:rows.map(r=>({territoryId:r.pra_id,value:r.value,observed_value:null,status:r.status,reason:null,
      support_scope:'whole_pra',support_id:q.definitions[q.lookup[weatherQualityKey(r)]].evidence.support_id,
      quality:q.definitions[q.lookup[weatherQualityKey(r)]],rule_version:r.rule_version,data_freshness:[r.acquired_at],
      quality_flags:r.quality_flags,provenance:[r.provenance_sha256]}))});
  const a=make(before),b=make(after),svgs=[thumbnailSvg(a,{exhaustive:true}),thumbnailSvg(b,{exhaustive:true})];
  expect(a.rows.map(r=>r.value)).toEqual(b.rows.map(r=>r.value));
  for(const svg of svgs)expect((svg.match(/data-pra-outline="true"/g)||[]).length).toBe(713);
  expect(b.rows.every(r=>coveragePaint({value:r.value,quality:r.quality,field:'value'}).target==='unavailable')).toBe(true);
  const output=process.env.COUV05_VISUAL_OUTPUT;
  if(output){
    mkdirSync(output,{recursive:true});
    writeFileSync(resolve(output,'before.svg'),svgs[0]);writeFileSync(resolve(output,'after.svg'),svgs[1]);
    writeFileSync(resolve(output,'fallback.html'),`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>COUV-05 — Repli gris sur archive réelle</title><style>body{overflow-wrap:anywhere;font:16px sans-serif;margin:16px}main{max-width:1300px;margin:auto}.maps{display:flex;flex-wrap:wrap;gap:16px}figure{flex:1 1 320px;min-width:0;margin:0}svg{width:100%;height:auto}p{max-width:80ch}</style><main><h1>Repli gris sans preuve native</h1><p>Archive réelle ${sha}. ARPEGE · ${date} · 713 PRA, dont six corses. Valeurs inchangées. Ce contrôle de miniature ne valide aucune géométrie native ni la carte interactive.</p><div class="maps"><figure><figcaption>Avant · contrat COUV-04 existant</figcaption>${svgs[0]}</figure><figure><figcaption>Après · recette COUV-05, preuve native absente</figcaption>${svgs[1]}</figure></div></main></html>`);
    writeFileSync(resolve(output,'render.json'),JSON.stringify({archive_sha256:sha,date,model:rows[0].model,cycle:rows[0].model_run_at,
      contours_before:713,contours_after:713,numeric_values_unchanged:true,spatial_proofs:0,
      missing_after:713,kind:'real archive / thumbnail fallback only',interactive_map_validated:false},null,2));
  }
});

// A real native sidecar can be supplied without enabling any remote environment.
vi.mock('../../lib/server/weather-archives',()=>({forecastMaskObject:async(path:string)=>{
  const root=process.env.COUV05_REAL_SIDECARS;
  if(!root)return null;
  return readFileSync(resolve(root,path));
}}));
import {forecastMasks} from '../../lib/server/forecast-masks';
it.skipIf(!archive||!process.env.COUV05_REAL_SIDECARS)('binds a real national native support through the server reader and COUV-04 thumbnail',async()=>{
  const root=process.env.COUV05_REAL_SIDECARS!,raw=readFileSync(archive!),sha=createHash('sha256').update(raw).digest('hex');
  const summary=JSON.parse(readFileSync(resolve(root,'summary.json'),'utf8'));
  vi.stubEnv('COUV05_RENDER_ENABLED','true');vi.stubEnv('COUV05_INDEX_SHA256',summary.spatial_index.sha256);
  try {
    const data=unpackWeatherArchive(raw,sha),all=data.rows as WeatherRow[],date='2026-11-15';
    const rows=all.filter(r=>r.model==='arpege-0p1'&&r.valid_date===date&&r.variable==='temperature');
    const spatial=await forecastMasks(rows,sha);
    expect(rows).toHaveLength(713);expect(spatial?.proofs).toHaveLength(713);
    const bundles=[weatherQualityBundle(rows),weatherQualityBundle(rows,spatial)];
    const maps:EditionMap[]=bundles.map(bundle=>({id:'native-real',indicator:'temperature_mean',title:'Température moyenne',nature:'forecast',
      period:[date,date],unit:'°C',sources:['meteofrance-arpege'],cycles:[rows[0].model_run_at!],input_sha256:sha,
      rows:rows.map(r=>({territoryId:r.pra_id,value:r.value,observed_value:null,status:r.status,reason:null,support_scope:'whole_pra',
        support_id:bundle.definitions[bundle.lookup[weatherQualityKey(r)]].evidence.support_id,
        quality:bundle.definitions[bundle.lookup[weatherQualityKey(r)]],rule_version:r.rule_version,
        data_freshness:[r.acquired_at],quality_flags:r.quality_flags,provenance:[r.provenance_sha256]}))}));
    expect(maps[0].rows.map(r=>r.value)).toEqual(maps[1].rows.map(r=>r.value));
    const svgs=maps.map(map=>thumbnailSvg(map,{exhaustive:true,coveredSupport:spatial?.collection}));
    for(const svg of svgs)expect((svg.match(/data-pra-outline="true"/g)||[]).length).toBe(713);
    const output=process.env.COUV05_VISUAL_OUTPUT;
    if(output){
      mkdirSync(output,{recursive:true});
      for(const [i,name] of ['native-before','native-after'].entries())writeFileSync(resolve(output,name+'.svg'),svgs[i]);
      writeFileSync(resolve(output,'native.html'),`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>COUV-05 — support natif réel</title><style>body{overflow-wrap:anywhere;font:16px sans-serif;margin:16px}main{max-width:1300px;margin:auto}.maps{display:flex;flex-wrap:wrap;gap:16px}figure{flex:1 1 320px;min-width:0;margin:0}svg{width:100%;height:auto}</style><main><h1>Support natif réel · ARPEGE</h1><p>${date} · 713 PRA dont six corses · valeurs inchangées. Archive ${sha}. Géométries natives vérifiées, index ${summary.spatial_index.sha256}. Comparaison du moteur de miniature COUV-04 ; la carte interactive et les recettes ne sont pas validées par cette capture.</p><div class="maps"><figure><figcaption>Avant · qualité existante</figcaption>${svgs[0]}</figure><figure><figcaption>Après · support natif lié à l'archive exacte</figcaption>${svgs[1]}</figure></div></main></html>`);
      writeFileSync(resolve(output,'native-render.json'),JSON.stringify({archive_sha256:sha,index_sha256:summary.spatial_index.sha256,
        model:'arpege',date,proofs:spatial?.proofs.length,contours:713,numeric_values_unchanged:true,
        paint_targets:maps.map(map=>map.rows.reduce<Record<string,number>>((counts,r)=>{const target=coveragePaint({value:r.value,quality:r.quality,field:'value'}).target;counts[target]=(counts[target]??0)+1;return counts;},{})),interactive_map_validated:false},null,2));
    }
  } finally {vi.unstubAllEnvs();}
},30000);
