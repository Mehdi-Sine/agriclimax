import {expect,it,vi,afterEach} from 'vitest';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {RULES, type Rule} from '../../features/agroclimatic/catalogue';
import {coverageRule, UNIFIED_AGRO_VERSION} from '../../features/climate-quality/calculate';
import {RECIPES, VERSION as EDITION_RULE_VERSION} from '../../features/multiproduction/registry';
import type {WeatherRow} from '../../features/operational/model';
import {coveragePaint} from '../../features/cartography/coverage';
import {unpackWeatherArchive} from './weather-archive-codec';
const remote=vi.hoisted(()=>vi.fn());
vi.mock('server-only',()=>({}));
vi.mock('./weather-archives',()=>({forecastMaskObject:remote}));
import {forecastQualified, retainedForecastRule} from './forecast-qualified';
const root=resolve(process.env.COUV05E_SIDECARS??'../../work/couv05e-candidate');
const pin='40cc3aebeb338f5cb63898f77a12680104749a7d9f67c27afc97810e5ec193c9';
afterEach(()=>{vi.unstubAllEnvs();remote.mockReset();});
it.skipIf(!existsSync(root))('reads all 1185 retained results and binds all 540 partial geometries through the actual reader',async()=>{
  vi.stubEnv('COUV05_RENDER_ENABLED','true');vi.stubEnv('COUV05_INDEX_SHA256',pin);
  remote.mockImplementation(async(path:string)=>readFileSync(resolve(root,path)));
  const index=JSON.parse(gunzipSync(readFileSync(resolve(root,`forecast-masks/indexes/${pin}.json.gz`))).toString()) as {archive_sha256:string;qualified_entries:{rule:Rule;start:string;end:string;model:string;run:string;path:string}[]};
  const archive=unpackWeatherArchive(readFileSync(resolve(process.env.COUV05E_ARCHIVE??'../../work/couv05e-store/ed93ab41472f81cec83a6039d8634133fa1feb42fe71d6513090d74d6985a398.json.gz')),index.archive_sha256);
  const times:number[]=[];let accepted=0,partial=0;
  const decisions = [];
  const selectedIndices = archive.selected_indices as number[];
  const selectedRows = selectedIndices.map(i => (archive.rows as WeatherRow[])[i]);
  const checkedIdentities = new Set<string>();
  for(const entry of index.qualified_entries){
    const rows=(archive.rows as WeatherRow[]).filter(r=>r.model===entry.model&&Date.parse(r.model_run_at??'')===Date.parse(entry.run)&&r.valid_date>=entry.start&&r.valid_date<=entry.end&&entry.rule.variables.includes(r.variable));
    expect(new Set(rows.map(r=>r.pra_id)).size).toBe(713);
    const began=performance.now();
    const result=await forecastQualified(rows,index.archive_sha256,entry.rule,entry.start,entry.end,entry.rule.threshold);
    times.push(performance.now()-began);
    const retained=JSON.parse(gunzipSync(readFileSync(resolve(root,entry.path))).toString()) as {rows:{pra_id:string;result:unknown;fraction:number;support_id:string}[]};
    expect(result.results.size,JSON.stringify({entry,reason:result.reason})).toBe(retained.rows.length);
    const base = RULES.find(rule => rule.id === entry.rule.id);
    const explorer = base && coverageRule(base);
    const edition = RECIPES.find(recipe => recipe.id === entry.rule.id)?.kernel;
    const explorerEquivalent = !!explorer && !!retainedForecastRule(explorer);
    const editionEquivalent = !!edition && !!retainedForecastRule(edition);
    const firstLead = (Date.parse(entry.start) - Date.parse('2026-11-14')) / 86400000;
    const lastLead = (Date.parse(entry.end) - Date.parse('2026-11-14')) / 86400000;
    const eligibleWindow = firstLead >= -1 && (lastLead <= 0 || firstLead >= 1 && lastLead <= 7);
    const routed = explorerEquivalent && eligibleWindow
      ? await forecastQualified(
          selectedRows.filter(row => row.valid_date >= entry.start && row.valid_date <= entry.end && explorer.variables.includes(row.variable)),
          index.archive_sha256, explorer, entry.start, entry.end, explorer.threshold, true,
        )
      : undefined;
    const adapted = explorerEquivalent
      ? await forecastQualified(rows,index.archive_sha256,explorer,entry.start,entry.end,explorer.threshold,true)
      : undefined;
    if (adapted) expect(adapted.results).toEqual(result.results);
    for(const r of retained.rows){
      const value=result.results.get(r.pra_id)!;expect(value).toEqual(r.result);accepted++;
      const geometry=result.collection.features.find(f=>f.id===r.pra_id);
      const reading={value:value.value??value.observed_value??null,quality:value.quality,field:'value' as const};
      expect(coveragePaint({...reading,geometrySupportId:geometry?.properties.support_id}).target).toBe(r.fraction<.9?'covered':'whole');
      decisions.push({model:entry.model, cycle:entry.run, start:entry.start, end:entry.end, indicator:entry.rule.id,
        pra:r.pra_id, fraction:r.fraction, support:r.support_id, exactReplayed:true,
        explorer: !base ? 'indicator_absent' : !explorerEquivalent ? 'rule_divergence' :
          !eligibleWindow ? 'window_outside_route' : routed?.results.has(r.pra_id) ? 'eligible_selected_transport' : 'source_not_selected',
        edition: !edition ? 'indicator_absent' : !editionEquivalent ? 'rule_divergence' : 'eligible_if_frozen_value_matches',
      });
      if(r.fraction<.9){partial++;expect(coveragePaint({...reading,geometrySupportId:'incompatible'}).target).toBe('unavailable');}
    }
    const identity = JSON.stringify([entry.model, entry.rule]);
    if (!checkedIdentities.has(identity)) {
      checkedIdentities.add(identity);
      expect((await forecastQualified(rows,'f'.repeat(64),entry.rule,entry.start,entry.end,entry.rule.threshold)).results.size).toBe(0);
      for (const version of [UNIFIED_AGRO_VERSION, EDITION_RULE_VERSION]) {
        const activeRule = {...entry.rule, version};
        expect((await forecastQualified(rows,index.archive_sha256,activeRule,entry.start,entry.end,entry.rule.threshold)).results.size).toBe(0);
      }
      expect((await forecastQualified(rows,index.archive_sha256,entry.rule,entry.start,entry.end,999)).results.size).toBe(0);
      const mutated=rows.map(r=>({...r,provenance_sha256:'f'.repeat(64)}));
      expect((await forecastQualified(mutated,index.archive_sha256,entry.rule,entry.start,entry.end,entry.rule.threshold)).results.size).toBe(0);
    }
  }
  expect(accepted).toBe(1185);expect(partial).toBe(540);
  times.sort((a,b)=>a-b);
  if (process.env.PREV01_SCIENTIFIC_MATRIX) {
    writeFileSync(process.env.PREV01_SCIENTIFIC_MATRIX, JSON.stringify(decisions, null, 2) + '\n');
  }
  mkdirSync('../../work/couv05e-results',{recursive:true});
  writeFileSync('../../work/couv05e-results/reader.json',JSON.stringify({accepted,partial,shards:times.length,rejected_model_rule_identities:checkedIdentities.size,local_reader_ms:{median:times[Math.floor(times.length/2)],p95:times[Math.floor(times.length*.95)],max:times.at(-1)},transport:'local retained bytes; no HTTP or browser latency',real_route_replay:false},null,2));
},120000);
it('does no read when disabled, and fails closed on corrupt bytes',async()=>{
  vi.stubEnv('COUV05_RENDER_ENABLED','false');
  expect((await forecastQualified([],'x',{} as Rule,'','',null)).results.size).toBe(0);expect(remote).not.toHaveBeenCalled();
  vi.stubEnv('COUV05_RENDER_ENABLED','true');vi.stubEnv('COUV05_INDEX_SHA256',pin);remote.mockResolvedValue(Buffer.from('corrupt'));
  expect((await forecastQualified([],'x',{} as Rule,'','',null)).results.size).toBe(0);
});
