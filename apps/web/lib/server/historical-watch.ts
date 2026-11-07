import 'server-only';
import {nationalAvailability} from './national-availability';
import {nationalData} from './national';
import {currentManifest} from './weather-archives';
import {NATIONAL,type ClimateContextRow} from '../../features/national/model';
import type {HistoricalWatch} from '../../features/national-watch/historical';
let cache:{identity:string;promise:Promise<HistoricalWatch>}|undefined;
export async function historicalWatch():Promise<HistoricalWatch>{
 const availability=await nationalAvailability(),manifest=await currentManifest();
 const identity=`${availability.latest}/${manifest?.era5[0]?.sha256??availability.updated_at}/${NATIONAL.climatology}/historical-watch-1`;
 if(cache?.identity===identity)return cache.promise;
 const promise=(async()=>{
  const data=await Promise.all((['temperature','precipitation'] as const).map(variable=>nationalData(new URLSearchParams({action:'context-day',date:availability.latest,variable}))));
  return {date:availability.latest,acquired_at:availability.acquired_at,updated_at:availability.updated_at,freshness:availability.freshness,identity,
   rows:data.flatMap((d,i)=>(d.data as ClimateContextRow[]).map(r=>({...r,variable:i===0?'temperature' as const:'precipitation' as const}))),
   source:`${NATIONAL.dataset}/${NATIONAL.climatology}`,rule_version:'historical-watch-1'};
 })();cache={identity,promise};void promise.catch(()=>{if(cache?.promise===promise)cache=undefined;});return promise;
}
