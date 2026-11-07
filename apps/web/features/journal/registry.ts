import {RULES} from '../agroclimatic/catalogue';
import {PRODUCTIONS} from '../national-watch/productions';
import type {WatchSummary} from '../national-watch/model';
export interface IndicatorFact {id:string;text:string;value:number;unit:string;period:[string,string];source:string;rule_version:string;provenance:string[];quality_flags:string[];data_freshness:string[];href:string}
export interface Indicator {id:string;version:string;facts?:IndicatorFact[];period:[string,string];scale:'pra';quality:string;status:'available'|'insufficient'|'unavailable';qualified:boolean;publishable:boolean;provenance:string[];limits:string}
export interface Contribution {id:string;label:string;family:string;indicators:Indicator[];indicator_inventory?:Indicator[];declared_pra_count:number|null;source:string;year:number|null;event_ids:string[];href:string;limits:string}
export interface Contributor {id:string;version:string;contribute:(summary:WatchSummary)=>Contribution}
export function validateContribution(value:Contribution){
 if(!value.id||!value.label||!value.family||!value.limits||!value.source||!value.href.startsWith('/')||value.href.startsWith('//')||value.declared_pra_count!==null&&(!Number.isInteger(value.declared_pra_count)||value.declared_pra_count<0)||!Array.isArray(value.event_ids)||value.indicators.some(i=>!i.id||!i.version||i.scale!=='pra'||!i.limits||!i.quality||!['available','insufficient','unavailable'].includes(i.status)||i.period.length!==2||i.period.some(d=>!Number.isFinite(Date.parse(d)))||i.period[0]>i.period[1]||!Array.isArray(i.provenance)||typeof i.qualified!=='boolean'||typeof i.publishable!=='boolean'))throw new Error('INVALID_EDITORIAL_CONTRIBUTION');
 return value;
}
export function createRegistry(contributors:Contributor[]){
 if(new Set(contributors.map(c=>c.id)).size!==contributors.length||contributors.some(c=>!c.id||!c.version))throw new Error('INVALID_EDITORIAL_REGISTRY');
 return {version:contributors.map(c=>`${c.id}/${c.version}`).sort().join('|'),read:(s:WatchSummary)=>contributors.map(c=>{const section=validateContribution(c.contribute(s));if(section.id!==c.id)throw new Error('CONTRIBUTOR_ID_MISMATCH');return {...section,indicator_inventory:section.indicators,indicators:section.indicators.filter(i=>i.qualified&&i.publishable&&i.status==='available'&&!!i.facts?.length&&i.facts.every(f=>Number.isFinite(f.value)&&f.id&&f.text&&f.unit&&f.source&&f.rule_version&&f.provenance.length>0&&JSON.stringify(f.period)===JSON.stringify(i.period)&&f.href.startsWith('/')&&!f.href.startsWith('//')))};}).sort((a,b)=>a.id.localeCompare(b.id))};
}
// Discovery from the existing scientific catalogue and declared-production adapter.
export const defaultContributors:Contributor[]=[...new Set([...PRODUCTIONS.map(p=>p.id),...RULES.map(r=>r.production)])].map(id=>({id,version:'catalogue-adapter-1.1/'+RULES.filter(r=>r.production===id).map(r=>r.id+'@'+r.version).join(','),contribute:(s:WatchSummary):Contribution=>{
 const p=s.productions.find(p=>p.id===id),rules=RULES.filter(r=>r.production===id);
 return {id,label:p?.label??(id==='cattle'?'Bovins':id),family:PRODUCTIONS.find(item=>item.id===id)?.family??'Élevage bovin',declared_pra_count:p?.pra_ids.length??null,source:p?.source??'catalogue scientifique',year:p?.year??null,event_ids:s.events.filter(e=>e.production_ids.includes(id)).map(e=>e.id).sort(),href:p?'/veille?production='+encodeURIComponent(id)+'&cycle='+encodeURIComponent(s.run):'/analyse?production='+encodeURIComponent(id),limits:p?.limitation??'Présence animale et stade inconnus. Aucun dommage évalué.',indicators:rules.map(r=>({id:r.id,version:r.version,period:s.period,scale:r.spatial_scale,quality:r.quality,status:'unavailable',qualified:false,publishable:false,provenance:[r.source],limits:r.limits}))};
}}));
export const defaultRegistry=createRegistry(defaultContributors);
