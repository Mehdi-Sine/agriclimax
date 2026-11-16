import {describe, expect, it} from 'vitest';
import pilot from '../../data/operational/cycle.json';
import type {WeatherRow} from '../operational/model';
import type {PraCollection} from '../national/map';
import {weatherQualityBundle, weatherQualityKey} from '../climate-quality/adapters';
import {boundForecastGeometries, forecastSpatialQuality, matchesForecastSupport, type ForecastSupport} from './forecast-support';
import {coveragePaint} from './coverage';
const ref='a'.repeat(64), source='b'.repeat(64), support='c'.repeat(64);
const row:WeatherRow={...pilot.rows[0] as WeatherRow,spatial_coverage:1,value:0,status:'available',provenance_sha256:source,provenance:{...pilot.rows[0].provenance,checksum:source}};
const proof:ForecastSupport={pra_id:row.pra_id,model:'ifs',run:row.model_run_at!,period:row.valid_date,
  variable:row.variable,grid_version:row.grid_version,weights_sha256:"d".repeat(64),pra_weights_sha256:row.weights_sha256,
  reference_sha256:ref,source_sha256:source,support_id:support,fraction:1,status:'demonstrated',geometry_verified:true};
describe('forecast native support binding',()=>{
  it('delegates whole-PRA paint to COUV-04 only with matched native proof',()=>{
    const quality=forecastSpatialQuality(row,proof,ref);
    expect(quality.evidence.support_id).toBe(support);
    expect(coveragePaint({value:0,quality,field:'value'}).target).toBe('whole');
  });
  it('does not treat an aggregate >=90% as geographic proof',()=>{
    for(const fraction of [.9,.95,1]){
      const quality=forecastSpatialQuality({...row,spatial_coverage:fraction},undefined,ref);
      expect(quality.state).toBe('unknown');
      expect(coveragePaint({value:0,quality,field:'value'}).target).toBe('unavailable');
    }
  });
  it('rejects every mismatched identity and unverified geometry',()=>{
    for(const patch of [{pra_id:'pra:other'},{model:'arome'},{run:'2025-01-01T00:00:00Z'},
      {period:'2025-01-01'},{variable:'other'},{grid_version:'other'},{pra_weights_sha256:'other'},
      {reference_sha256:'other'},{source_sha256:'other'},{support_id:null},{fraction:.5},
      {geometry_verified:false},{status:'unknown' as const}]){
      expect(matchesForecastSupport(row,{...proof,...patch},ref)).toBe(false);
    }
    expect(matchesForecastSupport({...row,valid_to:row.valid_from},proof,ref)).toBe(false);
    expect(matchesForecastSupport({...row,rule_version:'another-scientific-rule'},proof,ref)).toBe(false);
  });
  it('preserves unknown proof separately from the numeric zero',()=>{
    const bundle=weatherQualityBundle([row],{proofs:[],referenceSha:ref});
    const q=bundle.definitions[bundle.lookup[weatherQualityKey(row)]];
    expect(q.numeric_value).toBe(true);expect(q.evidence.fraction).toBe(null);
    expect(q.indicator_eligible).toBe(false);expect(row.value).toBe(0);
  });
  it('binds geometry to exact PRA and support and rejects ambiguous candidates',()=>{
    const collection:PraCollection={type:'FeatureCollection',features:[{type:'Feature',id:row.pra_id,
      properties:{code:row.pra_id.slice(4),support_id:support,name:'test',department_name:'test',region_name:'test'},
      geometry:{type:'Polygon',coordinates:[[[1,45],[1.1,45],[1.1,45.1],[1,45]]]}}]};
    expect(boundForecastGeometries([row],[proof],collection,ref).features).toHaveLength(1);
    expect(boundForecastGeometries([row],[{...proof,source_sha256:'other'}],collection,ref).features).toHaveLength(0);
    expect(()=>boundForecastGeometries([row],[proof,proof],collection,ref)).toThrow('AMBIGUOUS');
  });
});

it('distinguishes native absence from missing proof',()=>{
  const unavailable={...row,value:null,status:'unavailable' as const,spatial_coverage:0};
  const q=forecastSpatialQuality(unavailable,{...proof,status:'absent',fraction:0,geometry_verified:false,valid_native_cells:0},ref);
  expect(q.state).toBe('unavailable');expect(q.evidence.fraction).toBe(0);
  expect(q.evidence.mask).toBe('native_valid_cells');
});
