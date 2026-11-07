import Ajv from 'ajv';
import type {JournalEdition} from './model';
const string={type:'string',minLength:1},strings={type:'array',items:string};
const object=(properties:Record<string,unknown>,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const array=(items:unknown)=>({type:'array',items});
const period={type:'array',items:string,minItems:2,maxItems:2};
const number={type:'number'},integer={type:'integer',minimum:0};
const fact=object({id:string,text:string,value:number,unit:string,period,source:string,rule_version:string,provenance:{...strings,minItems:1},quality_flags:strings,data_freshness:strings,href:string});
const change=object({horizon:{enum:[3,7,14,30]},status:{enum:['appearance','maintained','intensification','extension','attenuation','disappearance','unknown','insufficient_history']},reason:string,nature:{enum:['forecast','reanalysis','observation']},previous_date:{type:['string','null']}});
const event=object({id:string,version:string,phenomenon:string,nature:{const:'forecast'},region:string,pra_ids:strings,period,evolution:array(change),facts:strings,evidence_ids:strings,production_ids:strings,limitations:strings,href:string});
const indicatorProperties={facts:array(fact),id:string,version:string,period,scale:{const:'pra'},quality:string,status:{enum:['available','insufficient','unavailable']},qualified:{type:'boolean'},publishable:{type:'boolean'},provenance:strings,limits:string};
const indicator=object(indicatorProperties,Object.keys(indicatorProperties).filter(k=>k!=='facts'));
const contributionProperties={id:string,label:string,family:string,indicators:array(indicator),indicator_inventory:array(indicator),declared_pra_count:{type:['integer','null'],minimum:0},source:string,year:{type:['integer','null']},event_ids:strings,href:string,limits:string};
export const editionSchema=object({
 edition_id:{type:'string',pattern:'^[a-f0-9]{64}$'},edition_date:string,edition_version:string,generated_at:string,source_cycles:strings,data_cutoff:string,data_freshness:{enum:['fresh','stale','expired']},publication_status:{const:'preview'},headline:string,lead:string,key_facts:array(fact),main_story:{anyOf:[event,{type:'null'}]},secondary_stories:array(event),
 production_sections:array(object(contributionProperties,Object.keys(contributionProperties).filter(k=>k!=='indicator_inventory'))),
 regional_sections:array(object({id:string,label:string,total_pra:integer,events:array(event),coverage:array(object({phenomenon:string,evaluated:integer,affected:integer})),productions:strings,summary:string,href:string})),regional_focus_ids:strings,
 visualizations:array(object({id:string,kind:{const:'map'},href:string,fact_ids:strings})),
 evidence:object({version:string,facts:array(fact),limitations:strings,fallback:object({headline:string,lead:string}),visualization_ids:strings}),limitations:strings,provenance:strings,
});
const validate=new Ajv({strict:true,allowUnionTypes:true}).compile<JournalEdition>(editionSchema);
export function assertEdition(value:unknown):asserts value is JournalEdition{
 if(!validate(value))throw new Error('INVALID_JOURNAL_EDITION');
 const facts=new Set(value.evidence.facts.map(f=>f.id)),regions=new Set(value.regional_sections.map(r=>r.id));
 const events=[...(value.main_story?[value.main_story]:[]),...value.secondary_stories,...value.regional_sections.flatMap(r=>r.events)];
 if(facts.size!==value.evidence.facts.length||value.key_facts.some(f=>!facts.has(f.id))||events.some(e=>e.facts.some(id=>!facts.has(id))||e.evidence_ids.some(id=>!facts.has(id)))||value.regional_focus_ids.some(id=>!regions.has(id))||value.visualizations.some(v=>v.fact_ids.some(id=>!facts.has(id)))||value.production_sections.some(s=>s.indicators.some(i=>!i.qualified||!i.publishable||i.status!=='available'||!i.provenance.length)))throw new Error('INVALID_JOURNAL_REFERENCES');
}
