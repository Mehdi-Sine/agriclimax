import type {WeatherCycle} from '../operational/model';
export type TemporalMode='history'|'recent'|'forecast';
export function temporalMode(params:URLSearchParams):TemporalMode{
 const mode=params.get('temporal');return mode==='recent'||mode==='forecast'?mode:params.get('experimental')==='weather'?'forecast':'history';
}
export function modeDates(catalogue:WeatherCycle|null,mode:TemporalMode):string[]{
 if(!catalogue?.run)return[];const run=catalogue.run.slice(0,10),dates=catalogue.available_dates??[];
 return dates.filter(d=>mode==='recent'?d<=run:d>run);
}
export function modeDate(params:URLSearchParams,dates:string[],mode:TemporalMode):string{
 return params.get(mode==='history'?'date':`${mode}_date`)??(mode==='history'?null:params.get('weather_date'))??(mode==='recent'?dates.at(-1):dates[0])??'';
}
export function switchMode(params:URLSearchParams,mode:TemporalMode):URLSearchParams{
 const p=new URLSearchParams(params);p.set('temporal',mode);p.delete('experimental');p.delete('weather_date');return p;
}
export function temporalGap(historyLatest:string,weatherDates:string[]):{start:string;end:string;days:number}|null{
 const first=[...weatherDates].sort().find(d=>d>historyLatest);if(!first)return null;const distance=(Date.parse(first)-Date.parse(historyLatest))/86400000;if(!Number.isInteger(distance)||distance<=1)return null;return{start:new Date(Date.parse(historyLatest)+86400000).toISOString().slice(0,10),end:new Date(Date.parse(first)-86400000).toISOString().slice(0,10),days:distance-1};
}
