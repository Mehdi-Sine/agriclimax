import {createHash} from 'node:crypto';
import {PHENOMENA,WATCH_VERSION,watchFreshness,type WatchSummary} from '../national-watch/model';
import {compare,type Change} from './history';
import {defaultRegistry,type Contribution} from './registry';
export const JOURNAL_VERSION='journal-1.0.0';
export interface EditorialEvent {
 id:string;version:string;phenomenon:string;nature:'forecast';region:string;pra_ids:string[];period:[string,string];
 evolution:Change[];facts:string[];evidence_ids:string[];production_ids:string[];limitations:string[];href:string;
}
export interface EditorialFact {id:string;text:string;value:number;unit:string;period:[string,string];source:string;rule_version:string;provenance:string[];quality_flags:string[];data_freshness:string[];href:string}
export interface RegionalSection {id:string;label:string;total_pra:number;events:EditorialEvent[];coverage:{phenomenon:string;evaluated:number;affected:number}[];productions:string[];summary:string;href:string}
export interface JournalEdition {
 edition_id:string;edition_date:string;edition_version:string;generated_at:string;source_cycles:string[];data_cutoff:string;data_freshness:'fresh'|'stale'|'expired';publication_status:'preview';
 headline:string;lead:string;key_facts:EditorialFact[];main_story:EditorialEvent|null;secondary_stories:EditorialEvent[];production_sections:Contribution[];regional_sections:RegionalSection[];regional_focus_ids:string[];
 visualizations:{id:string;kind:'map';href:string;fact_ids:string[]}[];
 evidence:{version:string;facts:EditorialFact[];limitations:string[];fallback:{headline:string;lead:string};visualization_ids:string[]};limitations:string[];provenance:string[];
}
export function buildEdition(s:WatchSummary,options:{now:string;registry?:typeof defaultRegistry}):JournalEdition {
 const registry=options.registry??defaultRegistry,now=Date.parse(options.now);
 if(!Number.isFinite(now)||!Number.isFinite(Date.parse(s.run)))throw new Error('INVALID_JOURNAL_DATE');
 const limitations=['Prévisions uniquement : aucune évolution observée déduite des cycles.','Séquence sans pluie significative ≠ sécheresse agricole.','Présence RPG déclarée : culture en place, stade et sensibilité inconnus. Aucun dommage ni rendement évalué.','Extrêmes territoriaux et dénombrements de PRA ; aucune moyenne régionale, aucun hectare affecté.','Les règles du catalogue agroclimatique sont exploratoires ; aucun indicateur de production qualifié publié automatiquement.','Histoire 3, 7, 14 et 30 jours : insuffisante ou fenêtres prévisionnelles non homologues ; aucun épisode continu affirmé.'];
 const facts:EditorialFact[]=[],events:EditorialEvent[]=[];
 // No cross-phenomenon intensity score: breadth first, then stable phenomenon/region IDs.
 const ordered=[...s.events].filter(e=>e.pra_ids.length>0&&e.evaluated>=e.pra_ids.length&&Number.isFinite(e.value)&&e.provenance.length>0).sort((a,b)=>b.pra_ids.length-a.pra_ids.length||a.phenomenon.localeCompare(b.phenomenon)||a.region.localeCompare(b.region));
 for(const event of ordered){
  const key=createHash('sha256').update(JSON.stringify([s.source_version,event.id,event.rule_version])).digest('hex').slice(0,24),href=`/veille?cycle=${encodeURIComponent(s.run)}&phenomene=${event.phenomenon}&region=${encodeURIComponent(event.region)}`;
  const fact:EditorialFact={id:`fact-${key}`,text:event.text,value:event.value,unit:event.unit,period:[event.start,event.end],source:s.source_version,rule_version:event.rule_version,provenance:event.provenance,quality_flags:event.quality_flags,data_freshness:event.data_freshness,href};facts.push(fact);
  events.push({id:`event-${key}`,version:JOURNAL_VERSION,phenomenon:event.phenomenon,nature:s.source_nature,region:event.region,pra_ids:event.pra_ids,period:[event.start,event.end],evolution:([3,7,14,30] as const).map(h=>compare({nature:'forecast',source:s.source_version,model:s.version,version:event.rule_version,unit:event.unit,period:s.period,date:s.run,complete:false,pra_ids:event.pra_ids,evaluated_ids:[],magnitude:event.value,episode_id:event.id},undefined,h)),facts:[fact.id],evidence_ids:[fact.id],production_ids:event.production_ids,limitations:[...limitations,...event.quality_flags],href});
 }
 const production_sections=registry.read(s);
 for(const section of production_sections){section.event_ids=events.filter(e=>e.production_ids.includes(section.id)).map(e=>e.id);for(const indicator of section.indicators)facts.push(...indicator.facts!);}
 const regions=[...new Set(s.places.map(p=>p.region))].sort().map(region=>{
  const ids=new Set(s.places.filter(p=>p.region===region).map(p=>p.id)),regional=events.filter(e=>e.region===region);
  const coverage=PHENOMENA.map(p=>{const m=s.metrics.filter(m=>ids.has(m.pra)&&m.phenomenon===p.id);return {phenomenon:p.id,evaluated:m.filter(m=>m.detected!==null).length,affected:m.filter(m=>m.detected===true).length};});
  return {id:region,label:region,total_pra:ids.size,events:regional,coverage,productions:s.productions.filter(p=>p.pra_ids.some(id=>ids.has(id))).map(p=>p.label),summary:regional.length?'Franchissements de critères descriptifs dans les prévisions.':coverage.some(c=>c.evaluated>0)?'Aucun critère descriptif franchi sur les PRA évaluables ; couverture à consulter.':'Données insuffisantes pour cette région.',href:`/veille?cycle=${encodeURIComponent(s.run)}&region=${encodeURIComponent(region)}`};
 });
 const diverse=events.filter((e,i)=>events.findIndex(other=>other.phenomenon===e.phenomenon)===i);
 const selected=[...diverse,...events.filter(e=>!diverse.includes(e))];
 const top=events[0],hasData=s.coverage.some(c=>c.evaluated>0),freshness=watchFreshness(s,now);
 const headline=top?`${PHENOMENA.find(p=>p.id===top.phenomenon)!.label} : le point en ${top.region}`:hasData?'Une édition sans franchissement des critères descriptifs':'Données insuffisantes pour une synthèse nationale';
 const lead=`Cette prévisualisation décrit les prévisions du ${s.period[0]} au ${s.period[1]}, initialisées le ${s.run}. ${top?'Les faits ci-dessous reprennent les critères et preuves de la veille nationale.':'La couverture disponible limite la lecture éditoriale.'} Les productions sont un contexte déclaré. Aucun dommage agricole ni tendance observée n’est déduit.`;
 const visualizations=events.slice(0,4).map(e=>({id:`map-${e.id}`,kind:'map' as const,href:e.href,fact_ids:e.facts}));
 const edition_id=createHash('sha256').update(JSON.stringify([s.identity,WATCH_VERSION,JOURNAL_VERSION,registry.version,s.run.slice(0,10)])).digest('hex');
 return {edition_id,edition_date:s.run.slice(0,10),edition_version:JOURNAL_VERSION,generated_at:options.now,source_cycles:[s.run],data_cutoff:s.acquired_at,data_freshness:freshness.expired?'expired':freshness.stale?'stale':'fresh',publication_status:'preview',headline,lead,key_facts:selected.slice(0,3).map(e=>facts.find(f=>f.id===e.facts[0])!),main_story:top??null,secondary_stories:selected.filter(e=>e!==top).slice(0,3),production_sections,regional_sections:regions,regional_focus_ids:[...new Set(selected.map(e=>e.region))].slice(0,3),visualizations,evidence:{version:'editorial-evidence-1',facts,limitations,fallback:{headline,lead},visualization_ids:visualizations.map(v=>v.id)},limitations,provenance:[s.source_version,s.identity,registry.version]};
}
