import {shift} from "../editorial/temporal";
import type {WeatherRow} from "../operational/model";

type Timeline={rows:readonly Pick<WeatherRow,"valid_date"|"source_id"|"model"|"model_run_at">[];selected_indices:readonly number[]};
/** Pick actual contiguous dates with one selected source/run. This does not qualify
 * values or relax any AGRO coverage rule; the existing engine still checks them.
 */
export function homogeneousForecastPeriod(document:Timeline,date:string):[string,string]|null{
 const origins=new Map<string,Set<string>>();
 for(const i of document.selected_indices){
  const row=document.rows[i];if(row.valid_date<date||!row.model_run_at)continue;
  const group=origins.get(row.valid_date)??new Set<string>();
  group.add(JSON.stringify([row.source_id,row.model,row.model_run_at]));origins.set(row.valid_date,group);
 }
 for(const start of [...origins.keys()].sort()){
  const end=shift(start,1),first=origins.get(start)!,second=origins.get(end);
  if(first.size===1&&second?.size===1&&[...first][0]===[...second][0])return [start,end];
 }
 return null;
}
