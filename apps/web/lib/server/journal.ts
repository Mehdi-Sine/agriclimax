import 'server-only';
import {nationalWatch} from './national-watch';
import {buildEdition,JOURNAL_VERSION,type JournalEdition} from '../../features/journal/model';
import {assertEdition} from '../../features/journal/validate';
const cache=new Map<string,JournalEdition>();
export async function journal(run?:string){
 const summary=await nationalWatch(run),key=`${summary.identity}/${JOURNAL_VERSION}`;
 let edition=cache.get(key);
 if(!edition){edition=buildEdition(summary,{now:new Date().toISOString()});assertEdition(edition);if(cache.size>=3)cache.delete(cache.keys().next().value!);cache.set(key,edition);}
 // Freshness depends on consultation time, never on the cached generation time.
 const age=Date.now()-Date.parse(summary.run),expired=summary.period[1]<new Date().toISOString().slice(0,10);
 return {...edition,data_freshness:expired?'expired' as const:age>36*3600000?'stale' as const:'fresh' as const};
}
