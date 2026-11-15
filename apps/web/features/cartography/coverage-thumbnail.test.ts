import {it,expect,vi} from 'vitest';
import {readFileSync,writeFileSync} from 'node:fs';
import sharp from 'sharp';
import {gzipSync} from 'node:zlib';
vi.mock('server-only',()=>({}));
import {thumbnailSvg} from '../../lib/server/map-thumbnail';
import type {EditionMap} from '../edition-maps/model';
import type {CoverageQuality} from '../climate-quality/policy';
import type {PraCollection} from '../national/map';
import geometry from '../../data/operational/era5-spatial-support.json';
import {qualifyCoverage} from '../climate-quality/policy';
import identities from '../../data/operational/pra-identities.json';

it('keeps all 713 outlines with NULL, zero and partial supports in the thumbnail renderer',()=>{
 const e={fraction:.5,support_id:'exact',mask:'native_valid_cells' as const,represented_area_m2:null,expected_days:1,available_days:1,continuous:true,homogeneous:true,method:'test',estimate_certificate:null,reference_compatible:false};
 const rows=identities.ids.map((territoryId,i)=>({territoryId,value:i===0?0:null,observed_value:i===1?12:null,status:'partial' as const,reason:null,support_scope:'observed_area' as const,support_id:'exact',quality:qualifyCoverage(i===0?0:i===1?12:null,'mean_sum',e),data_freshness:[],rule_version:'test',quality_flags:[],provenance:[]}));
 const map:EditionMap={id:'test',indicator:'rain',title:'Test',nature:'reanalysis',period:['2026-11-01','2026-11-01'],unit:'mm',sources:[],cycles:[],input_sha256:'test',rows};
 const svg=thumbnailSvg(map,{exhaustive:true});
 expect(svg.match(/data-pra-outline=/g)).toHaveLength(713);
 expect(svg).toContain('#e5e7eb');
 expect(thumbnailSvg(map)).not.toContain('data-pra-outline');
});

it.skipIf(process.env.COUV04_EVIDENCE!=='1')('renders before/after from frozen real values through the shared thumbnail engine',async()=>{
 type Reading={pra:string;indicator:string;period:[string,string];value:number|null;quality:CoverageQuality;support_id:string|null};
 const path='../../docs/codex/COUV-04/evidence';
 const readings=JSON.parse(readFileSync(`${path}/visual-readings.json`,'utf8')) as Reading[];
 const coveredSupport={type:'FeatureCollection',features:Object.values(geometry.geometries)} as PraCollection;
 for(const indicator of ['rain','temperature_mean','temperature_min']){
  const map:EditionMap={id:indicator,indicator,title:indicator,nature:'reanalysis',period:['2026-11-01','2026-11-01'],unit:indicator==='rain'?'mm':'°C',sources:['era5-land'],cycles:[],input_sha256:'frozen',rows:readings.filter(r=>r.indicator===indicator).map(r=>({territoryId:r.pra,value:r.quality.state==='observed_partial'?null:r.value,observed_value:r.quality.state==='observed_partial'?r.value:null,status:r.quality.state==='native_complete'?'available':'partial',reason:null,support_scope:r.quality.state==='observed_partial'?'observed_area':'whole_pra',support_id:r.support_id,quality:r.quality,data_freshness:['frozen'],rule_version:'frozen',quality_flags:[],provenance:['CORE-01/frozen-inputs']}))};
  expect(map.rows).toHaveLength(713);
  for(const [label,option] of [['before',undefined],['after',{exhaustive:true,coveredSupport}]] as const){
   const svg=thumbnailSvg(map,option);writeFileSync(`${path}/${indicator}-${label}.svg.gz`,gzipSync(svg));
   if(label==='after')expect(svg.match(/data-pra-outline=/g)).toHaveLength(713);
   await sharp(Buffer.from(svg)).resize(1440,900).png().toFile(`${path}/${indicator}-${label}.png`);
  }
 }
},30000);
