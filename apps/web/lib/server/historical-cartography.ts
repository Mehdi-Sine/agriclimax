import 'server-only';
import {calendarDays} from '../../features/national/daily-availability';
import type {QualifiedDay} from '../../features/climate-quality/calculate';
import type {PraCollection} from '../../features/national/map';
import type {ArchivedDaily} from './weather-archives';
import {RECIPES} from '../../features/multiproduction/registry';
import {historicalWheatInputs} from './wheat';
import {enrichHistoricalInputs} from './climate-quality';
import {periodSupportDocument} from './spatial-restitution';

export const HISTORICAL_RENDERING_VERSION = 'couv06-history-1';
export interface FrozenHistoricalCartography {
  version: typeof HISTORICAL_RENDERING_VERSION;
  period: [string,string];
  variables: Record<string,{inputs:Record<string,{
    support:NonNullable<QualifiedDay['climate_support']>;
    days:[string,number,string[],string[]][];
  }>}>;
  geometries: Record<string,PraCollection["features"][number]>;
}
/** Freeze before editorial selection/publication. No later source read can change a bundle.
 * The existing scientific adapter/calculator supplies every value and support identity.
 */
export async function freezeHistoricalCartography(history:ArchivedDaily[],period:[string,string]):Promise<FrozenHistoricalCartography> {
  const rows=history.filter(r=>r.valid_date>=period[0]&&r.valid_date<=period[1]);
  const variables:FrozenHistoricalCartography['variables']={};
  const geometries:FrozenHistoricalCartography['geometries']={};
  for(const id of ['temperature_mean','temperature_min','hot','rain']){
    const rule=RECIPES.find(r=>r.id===id)!.kernel;
    const variable=rule.variables[0];
    const native=historicalWheatInputs(rows,rule);
    const [inputs,document]=await Promise.all([
      enrichHistoricalInputs(native,rule),
      periodSupportDocument(...period,variable),
    ]);
    const supports=new Map(document.collection.features.map(f=>[String(f.id),f.properties.support_id]));
    // A multi-day value may reuse aggregates only when every daily support is identical.
    const qualified=Object.fromEntries(Object.entries(inputs).filter(([pra,days])=>
      supports.has(pra)&&days.map(r=>r.date).sort().join()===calendarDays(...period).join()&&days.every(r=>r.climate_support?.id===supports.get(pra))));
    variables[variable]={inputs:Object.fromEntries(Object.entries(qualified).map(([pra,days])=>[pra,{
      support:days[0].climate_support!,
      days:days.map(r=>{
        const original=native[pra].find(d=>d.date===r.date)!;
        return [r.date,r.values[variable as keyof typeof r.values]!,r.provenance.filter(p=>!original.provenance.includes(p)),r.quality_flags.filter(f=>!original.quality_flags.includes(f))];
      }),
    }]))};
    for(const f of document.collection.features)if(String(f.id) in qualified&&f.properties.support_id)geometries[f.properties.support_id]=f;
  }
  return {version:HISTORICAL_RENDERING_VERSION,period,variables,geometries};
}
