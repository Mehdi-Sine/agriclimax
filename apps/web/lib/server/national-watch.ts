import 'server-only';
import geography from '../../data/operational/pra-watch-places.json';
import {nationalWeatherDocument} from './weather-archives';
import {datasets,sources} from './agriculture-index';
import {detectQualifiedNational,packMetrics,PHENOMENA,WATCH_VERSION,type Place,type WatchSummary,type ProductionPresence} from '../../features/national-watch/model';
import {PRODUCTIONS} from '../../features/national-watch/productions';
import {PALETTE_VERSION} from '../../features/cartography/registry';
const cache=new Map<string,Promise<WatchSummary>>();
export async function nationalWatch(requestedRun?:string):Promise<WatchSummary>{
 const document=await nationalWeatherDocument(requestedRun);
 if(!document)throw new Error('NO_VERIFIED_NATIONAL_CYCLE');
 const source=document.archive_sha256;
 const identity=`${source}/${WATCH_VERSION}/${PALETTE_VERSION}/${sources.find(s=>s.source_id.includes('rpg'))?.sha256??'rpg-2025'}`;
 const hit=cache.get(identity);if(hit)return hit;
 const promise=(async():Promise<WatchSummary>=>{
  const started=performance.now();
  const places:Place[]=geography.places;
  if(places.length!==713||new Set(places.map(p=>p.id)).size!==713||places.some(p=>!p.region))throw new Error('INVALID_WATCH_GEOGRAPHY');
  const start=new Date(Date.parse(document.run)+86400000).toISOString().slice(0,10),end=new Date(Date.parse(document.run)+7*86400000).toISOString().slice(0,10);
  const {metrics,events}=detectQualifiedNational(document.selected_indices.map(i=>document.rows[i]),places,start,end);
  const productions:ProductionPresence[]=await Promise.all(PRODUCTIONS.map(async production=>{
   const data=await Promise.all(production.groups.map(g=>datasets[`rpg-group-${g}-surf-pra`]()));
   const known=places.filter(p=>data.every(d=>{const r=d.rows.find(r=>r.code===p.id.slice(4));return r?.statuses[0]==='available'&&r.values[0]!=null;})).map(p=>p.id);
   const present=known.filter(id=>data.some(d=>(d.rows.find(r=>r.code===id.slice(4))?.values[0]??0)>0));
   return {id:production.id,label:production.label,pra_ids:present,known_pra_ids:known,source:data[0].indicator.source_id,year:data[0].indicator.years[0],limitation:production.limitation};
  }));
  for(const event of events)event.production_ids=productions.filter(p=>event.phenomenon!=='thi'&&event.pra_ids.some(id=>p.pra_ids.includes(id))).map(p=>p.id);
  return {version:WATCH_VERSION,identity,source_version:source,run:document.run,acquired_at:document.acquired_at,
   published_at:document.rows.map(r=>r.published_at).filter((v):v is string=>!!v).sort().at(-1)??null,
   source_nature:'forecast',period:[start,end],places,productions,...packMetrics(metrics),events,
   coverage:PHENOMENA.map(p=>{const m=metrics.filter(m=>m.phenomenon===p.id);return {phenomenon:p.id,evaluated:m.filter(m=>m.detected!==null).length,affected:m.filter(m=>m.detected===true).length,insufficient:m.filter(m=>m.state==='insufficient').length,unavailable:m.filter(m=>m.state==='unavailable').length};}),
   calculated_at:new Date().toISOString(),compute_ms:Math.round(performance.now()-started)};
 })();
 if(cache.size>=3)cache.delete(cache.keys().next().value!);cache.set(identity,promise);
 void promise.catch(()=>{if(cache.get(identity)===promise)cache.delete(identity);});return promise;
}
