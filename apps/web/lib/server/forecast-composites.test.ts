import {afterEach,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import pilot from '../../data/operational/cycle.json';
import type {WeatherRow} from '../../features/operational/model';
import type {ForecastSupport} from '../../features/cartography/forecast-support';
import {RULES} from '../../features/agroclimatic/catalogue';
import {coverageRule} from '../../features/climate-quality/calculate';
import {qualifyForecastRecipe,forecastRecipeMasks} from './forecast-composites';
import {editionForecastRendering} from './edition-forecast';
import type {EditionMap} from '../../features/edition-maps/model';
const ref='a'.repeat(64),source='b'.repeat(64);
const rule=coverageRule(RULES.find(r=>r.id==='thi')!);
function fixture(){
  const original=pilot.rows[0] as WeatherRow;
  const rows:WeatherRow[]=['temperature','humidity'].map((variable,i)=>({...original,
    variable:variable as WeatherRow['variable'],value:i?50:0,unit:i?'%':'degC',
    status:'available',spatial_coverage:1,temporal_coverage:1,
    provenance_sha256:source,provenance:{...original.provenance,checksum:source}}));
  const proofs:ForecastSupport[]=rows.map((r,i)=>({pra_id:r.pra_id,model:'ifs',run:r.model_run_at!,period:r.valid_date,
    variable:r.variable,grid_version:r.grid_version,weights_sha256:'d'.repeat(64),pra_weights_sha256:r.weights_sha256,
    reference_sha256:ref,source_sha256:source,support_id:String(i+1).repeat(64),fraction:1,status:'demonstrated',geometry_verified:true,valid_cells:['cell:a','cell:b']}));
  return {rows,spatial:{proofs,referenceSha:ref,collection:{type:'FeatureCollection' as const,features:[]}},date:rows[0].valid_date};
}
afterEach(()=>vi.unstubAllEnvs());
it('qualifies identical native memberships including a zero input and binds recipe/threshold',()=>{
  const {rows,spatial,date}=fixture();
  const qualify=(r=rule,threshold:number|null=null)=>qualifyForecastRecipe(rows,spatial,r,date,date,threshold).supports.get(rows[0].pra_id);
  expect(qualify()?.mask).toBe('native_valid_cells');
  expect(qualify()?.id).not.toBe(qualify(rule,72)?.id);
  expect(qualify()?.id).not.toBe(qualify({...rule,id:'another'})?.id);
  spatial.proofs[1].valid_cells!.reverse();expect(qualify()?.mask).toBe('native_valid_cells');
});
it('rejects equal fractions and weights with different cells',()=>{
  const {rows,spatial,date}=fixture();spatial.proofs[1].valid_cells=['cell:b','cell:c'];
  const result=qualifyForecastRecipe(rows,spatial,rule,date,date,null);
  expect(result.supports.size).toBe(0);expect(Object.values(result.rejected)).toEqual(['common_cells_require_native_numeric_recalculation']);
});
it('rejects missing/duplicate inputs, missing membership, source, cycle and temporal mismatches',()=>{
  for(const change of ['missing','duplicate','membership','source','cycle','historical','temporal']){
    const {rows,spatial,date}=fixture();
    if(change==='missing')rows.pop();if(change==='duplicate')rows[1]=rows[0];
    if(change==='membership')delete spatial.proofs[0].valid_cells;
    if(change==='source')rows[0].source_id='era5-land';
    if(change==='cycle')spatial.proofs[0].run='2000-01-01T00:00:00Z';
    if(change==='historical')rows[0].nature='reanalysis' as WeatherRow['nature'];
    if(change==='temporal')rows[0].temporal_coverage=.5;
    expect(qualifyForecastRecipe(rows,spatial,rule,date,date,null).supports.size,change).toBe(0);
  }
});
it('requires all days',()=>{
  const {rows,spatial,date}=fixture();const end=new Date(Date.parse(date)+86400000).toISOString().slice(0,10);
  expect(qualifyForecastRecipe(rows,spatial,rule,date,end,null).supports.size).toBe(0);
});
it('leaves inactive, historical and published paths untouched',async()=>{
  vi.stubEnv('COUV05_RENDER_ENABLED','false');const {rows,date}=fixture();
  expect(await forecastRecipeMasks(rows,'c'.repeat(64),rule,date,date,null)).toBeUndefined();
  vi.stubEnv('COUV05_RENDER_ENABLED','true');
  expect(await editionForecastRendering({nature:'reanalysis'} as EditionMap,'preview')).toBeUndefined();
  expect(await editionForecastRendering({nature:'forecast'} as EditionMap,'published')).toBeUndefined();
});
it('keeps a captured empty native support distinct from missing proof',()=>{
  const {rows,spatial,date}=fixture();rows[0]={...rows[0],value:null,status:'unavailable',spatial_coverage:0};
  spatial.proofs[0]={...spatial.proofs[0],status:'absent',fraction:0,valid_cells:[],valid_native_cells:0,geometry_verified:false};
  expect(qualifyForecastRecipe(rows,spatial,rule,date,date,null).rejected[rows[0].pra_id]).toBe('no_common_native_cells');
});
