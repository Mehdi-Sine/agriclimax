import 'server-only';
import {createHash} from 'node:crypto';
import type {Rule} from '../../features/agroclimatic/catalogue';
import type {QualifiedDay} from '../../features/climate-quality/calculate';
import type {WeatherRow} from '../../features/operational/model';
import type {PraCollection} from '../../features/national/map';
import {calendarDays} from '../../features/national/daily-availability';
import {matchesForecastSupport, type ForecastSupport} from '../../features/cartography/forecast-support';
import {forecastMasks} from './forecast-masks';

export interface ForecastRecipeSupport {
  supports: Map<string, NonNullable<QualifiedDay['climate_support']>>;
  collection: PraCollection;
  rejected: Record<string,string>;
}
type Spatial = {proofs: ForecastSupport[];referenceSha:string;collection:PraCollection};
const hash = (value:unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Existing PRA formulae may reuse aggregates only when ALL native memberships
 * coincide exactly. A common fraction, weights digest or model is insufficient.
 * Changing supports requires native numeric fields, which this adapter never fetches.
 */
export function qualifyForecastRecipe(rows:WeatherRow[], spatial:Spatial, rule:Rule,
  start:string, end:string, threshold:number|null):ForecastRecipeSupport {
  const out:ForecastRecipeSupport={supports:new Map(),collection:{type:'FeatureCollection',features:[]},rejected:{}};
  const days=calendarDays(start,end), required=new Set(days.flatMap(d=>rule.variables.map(v=>`${d}/${v}`)));
  const proofs=new Map<string,ForecastSupport[]>();
  for(const p of spatial.proofs){const key=`${p.pra_id}/${p.period}/${p.variable}`;proofs.set(key,[...(proofs.get(key)??[]),p]);}
  const groups=new Map<string,WeatherRow[]>();
  for(const r of rows){const list=groups.get(r.pra_id)??[];list.push(r);groups.set(r.pra_id,list);}
  for(const [pra,inputs] of groups){
    const fail=(reason:string)=>{out.rejected[pra]=reason;};
    const keys=inputs.map(r=>`${r.valid_date}/${r.variable}`);
    if(!days.length||!required.size||keys.length!==required.size||new Set(keys).size!==keys.length||keys.some(k=>!required.has(k))){fail('missing_or_duplicate_recipe_input');continue;}
    const matched=inputs.map(r=>{const ps=proofs.get(`${pra}/${r.valid_date}/${r.variable}`);return ps?.length===1&&matchesForecastSupport(r,ps[0],spatial.referenceSha)?ps[0]:undefined;});
    if(matched.some(p=>p?.status==='absent'&&p.fraction===0&&p.valid_cells?.length===0)){fail('no_common_native_cells');continue;}
    if(matched.some(p=>!p||!p.valid_cells?.length||p.valid_cells.some(c=>typeof c!=='string')||new Set(p.valid_cells).size!==p.valid_cells.length)){fail('native_membership_unproven');continue;}
    const ps=matched as ForecastSupport[];
    const memberships=ps.map(p=>JSON.stringify([...p.valid_cells!].sort()));
    const identity=(p:ForecastSupport)=>JSON.stringify([p.pra_id,p.model,Date.parse(p.run),p.grid_version,p.reference_sha256,p.weights_sha256,p.pra_weights_sha256]);
    if(ps.some(p=>identity(p)!==identity(ps[0]))||memberships.some(m=>m!==memberships[0])||ps.some(p=>Math.abs(p.fraction!-ps[0].fraction!)>1e-7)){
      fail('common_cells_require_native_numeric_recalculation');continue;
    }
    if(inputs.some(r=>r.value===null||!Number.isFinite(r.value)||r.temporal_coverage!==1||r.status==='unavailable')){fail('numeric_or_temporal_input_unavailable');continue;}
    const supportId=hash(['couv05c-identical-native-support-1',rule,threshold,start,end,pra,
      ps.map(p=>[p.period,p.variable,p.support_id,p.source_sha256]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
    const feature=spatial.collection.features.find(f=>f.id===pra&&ps.some(p=>p.support_id===f.properties.support_id));
    if(ps[0].fraction!<.9&&!feature){fail('common_geometry_unavailable');continue;}
    out.supports.set(pra,{id:supportId,identity:supportId,fraction:ps[0].fraction!,
      temporal_complete:true,mask:'native_valid_cells',method:'couv05c-identical-native-support-1'});
    if(feature)out.collection.features.push({...feature,properties:{...feature.properties,support_id:supportId}});
  }
  return out;
}
export async function forecastRecipeMasks(rows:WeatherRow[],archiveSha:string,rule:Rule,start:string,end:string,threshold:number|null){
  const spatial=await forecastMasks(rows,archiveSha,{identicalMemberships:true});
  if(!spatial)return undefined;
  const result=qualifyForecastRecipe(rows,spatial,rule,start,end,threshold);
  if('membershipRejections' in spatial)for(const pra of Object.keys(result.rejected)){
    const reason=spatial.membershipRejections?.[pra];if(reason)result.rejected[pra]=reason;
  }
  if('reason' in spatial&&spatial.reason)for(const pra of Object.keys(result.rejected))result.rejected[pra]=spatial.reason;
  return result;
}
