import {historicalProvider,forecastProvider} from "../apps/web/features/multiproduction/archives";
import {computeBatch,type InputProvider,type ProductionDay} from "../apps/web/features/multiproduction/engine";
import {createContributors} from "../apps/web/features/multiproduction/editorial";
import {RECIPES} from "../apps/web/features/multiproduction/registry";
import type {ArchivedDaily,NationalWeatherDocument} from "../apps/web/lib/server/weather-archives";
import geography from "../apps/web/data/operational/pra-watch-places.json";
import {hash,shift} from "../apps/web/features/editorial/temporal";
export type CapturedInputs=Record<string,Record<string,ProductionDay[]>>;
export function capture(provider:InputProvider):CapturedInputs {
 return Object.fromEntries([...new Set(RECIPES.map(r=>r.kernel.variables.join()))].map(key=>[key,Object.fromEntries(geography.places.map(p=>[p.id,provider(p.id,key.split(",") as Parameters<InputProvider>[1])]))]));
}
export function replayIndicators(period:[string,string],inputs:CapturedInputs) {
 return computeBatch(geography.places.map(p=>p.id),period,(pra,variables)=>inputs[variables.join()]?.[pra]??[]);
}
export async function recomputeIndicators(rows:ArchivedDaily[],document:NationalWeatherDocument|null,date:string) {
 const end=rows.map(r=>r.valid_date).filter(d=>d<date).sort().at(-1);
 const groups=[];
 if(end){const period:[string,string]=[shift(end,-6),end];const inputs=capture(await historicalProvider(rows.filter(r=>r.valid_date>=period[0]&&r.valid_date<=period[1])));groups.push({nature:"reanalysis",period,inputs,input_sha256:hash(inputs),batch:replayIndicators(period,inputs)});}
 if(document){const period:[string,string]=[date,shift(date,1)];const inputs=capture(forecastProvider(document,[date,shift(date,1)]));groups.push({nature:"forecast",period,inputs,input_sha256:hash(inputs),batch:replayIndicators(period,inputs)});}
 const historical=groups.find(g=>g.nature==="reanalysis");
 const contributions=historical?createContributors(historical.batch.measurements,geography.places).map(c=>c.contribute({} as Parameters<typeof c.contribute>[0])).map(c=>({...c,indicators:c.indicators.map(i=>({...i,facts:i.facts?.slice(0,1).map(({id,text,value,unit,period,source,rule_version,provenance,quality_flags,data_freshness,href})=>({id,text,value,unit,period,source,rule_version,provenance,quality_flags,data_freshness,href}))}))})):[];
 return {version:"manual-indicators-1",groups,contributions,measurements:groups.reduce((n,g)=>n+g.batch.measurements.length,0),errors:groups.length?[]:["NO_ARCHIVED_WEATHER_SUPPORT"]};
}
