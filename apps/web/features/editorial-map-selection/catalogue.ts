import type {Archive} from "../editorial-ai/model";
import {verifyArchive} from "../editorial-ai/archive";
import {verifyBundle, type EditionMap, type EditionMapBundle} from "../edition-maps/model";
import {semanticPalette, classIndex, PALETTE_VERSION} from "../cartography/registry";
import {PRODUCTIONS, RECIPES, VERSION as REGISTRY_VERSION} from "../multiproduction/registry";
import places from "../../data/operational/pra-watch-places.json";
import bridge from "../../../../config/almanach/editorial-signal-bridge.v1.json";
import type {CatalogueCard} from "./model";
const unique = (a: string[]) => [...new Set(a)].sort();
const days = (a: string,b: string) => (Date.parse(b)-Date.parse(a))/86400000;
const regionById = new Map(places.places.map(p=>[p.id,p.region]));
export const median = (a: number[]): number|null => {
  if (!a.length) return null;
  const s=[...a].sort((x,y)=>x-y),i=Math.floor(s.length/2);
  return s.length%2?s[i]:(s[i-1]+s[i])/2;
};
const qualified = (r: EditionMap["rows"][number]) => r.value!==null && r.quality?.journal_eligible===true && r.quality.indicator_eligible===true && ["whole_pra","qualified_pra_estimate"].includes(r.support_scope??"");
function threshold(m: EditionMap) {
  const recipe=RECIPES.find(r=>r.id===(m.indicator==="temperature_min"?"frost":m.indicator))!;
  // Only operators whose stored result proves the criterion. No daily rain event
  // inferred from a multi-day cumulative map; GDD's base is not an alert threshold.
  if(m.indicator==="temperature_min") return {criterion:`Tmin < ${recipe.kernel.threshold} °C au moins un jour`,test:(v:number)=>v<recipe.kernel.threshold!,source:`${recipe.id}@${recipe.kernel.version}: ${recipe.kernel.formula}`};
  if(["below","above","longestBelow","longestAbove","thiAbove","thiLongest"].includes(recipe.kernel.operator))return {criterion:`${recipe.kernel.formula} ; résultat > 0`,test:(v:number)=>v>0,source:`${recipe.id}@${recipe.kernel.version}`};
  return null;
}
function comparison(m: EditionMap, prior?: EditionMapBundle): CatalogueCard["comparison"] {
  const p=prior?.maps.find(p=>p.indicator===m.indicator&&p.nature===m.nature);
  const absent={previous_map_id:p?.id??null,matched_pra:0,median_delta:null};
  if(!p)return {status:"no_previous",reason:"Aucune carte précédente fournie dans les deux archives autorisées.",...absent};
  // Forecast windows shift between these editions: neither an observed change
  // nor a revision of the same valid period can be claimed.
  if(m.nature==="forecast")return {status:"not_comparable",reason:"Prévisions : périodes et/ou cycles distincts ; aucune évolution observée déduite.",...absent};
  if(days(...m.period)!==days(...p.period)||days(p.period[1],m.period[0])!==1)return {status:"not_comparable",reason:"Fenêtres historiques chevauchantes, non adjacentes ou de durées différentes.",...absent};
  const a=m.rows.filter(qualified),b=p.rows.filter(qualified),byId=new Map(b.map(r=>[r.territoryId,r]));
  if(JSON.stringify(m.sources)!==JSON.stringify(p.sources)||a.length!==b.length||a.some(r=>{const q=byId.get(r.territoryId);return !q||q.rule_version!==r.rule_version||q.support_scope!==r.support_scope||q.support_id!==r.support_id;})||m.unit!==p.unit)return {status:"not_comparable",reason:"Source, règle, unité, support ou couverture territoriale non homologues.",...absent};
  return {status:"available",reason:"Différence descriptive entre fenêtres adjacentes de même durée et mêmes PRA qualifiées ; aucune causalité déduite.",previous_map_id:p.id,matched_pra:a.length,median_delta:median(a.map(r=>r.value!-byId.get(r.territoryId)!.value!))};
}
/** Read existing archives only. Verification precedes every descriptor and score. */
export function buildCatalogue(archive: Archive, bundle: EditionMapBundle, previous?: {archive: Archive; bundle: EditionMapBundle}): CatalogueCard[] {
  verifyArchive(archive,false); verifyBundle(bundle,archive);
  if(previous){verifyArchive(previous.archive,false);verifyBundle(previous.bundle,previous.archive);if(previous.archive.date>=archive.date)throw Error("EDIT03_PREVIOUS_DATE");}
  return bundle.maps.map(m=>{
    const recipe=RECIPES.find(r=>r.id===m.indicator)!,valid=m.rows.filter(qualified),values=valid.map(r=>r.value!);
    const palette=semanticPalette(m.indicator,m.unit,days(...m.period)+1),counts=palette.bounds.map(()=>0);
    const family=["temperature_min","frost","frost_sequence"].includes(m.indicator)?"cold":["temperature_mean","gdd","gdd_base6","gdd_base10"].includes(m.indicator)?"thermal":palette.family;
    values.forEach(v=>counts[classIndex(v,palette)]++);
    const t=threshold(m),fresh=unique(m.rows.flatMap(r=>r.data_freshness));
    const phenomenon=m.indicator==="temperature_min"?"frost":m.indicator;
    const signals=(bridge.mapping as Record<string,string[]>)[phenomenon]??[];
    const seasonal=archive.briefing.seasonal.windows.filter(w=>w.signal_ids.some(s=>signals.includes(s))&&w.source_ids.length>0&&w.source_ids.every(id=>archive.briefing.seasonal.sources.some(s=>s.id===id)));
    const qualified_values=valid.map(r=>({pra:r.territoryId,value:r.value!})).sort((a,b)=>a.pra.localeCompare(b.pra));
    const regions=unique(m.rows.map(r=>regionById.get(r.territoryId)??"Territoire sans région documentée")).map(region=>{
      const rows=m.rows.filter(r=>(regionById.get(r.territoryId)??"Territoire sans région documentée")===region),q=rows.filter(qualified),v=q.map(r=>r.value!);
      return {region,total:rows.length,qualified:q.length,affected:t?q.filter(r=>t.test(r.value!)).length:null,min:v.length?Math.min(...v):null,max:v.length?Math.max(...v):null};
    });
    const partial=m.rows.filter(r=>r.support_scope==="observed_area"&&r.observed_value!==null).length;
    const reasons=valid.length?[]:["Aucune PRA admissible aux chiffres du Journal."];
    const ref=m.nature==="reanalysis"?m.period[1]:[...m.cycles].sort().at(-1)!.slice(0,10);
    const limits=[recipe.kernel.limits,bridge.limitation,"Classes cartographiques : conventions éditoriales, jamais seuils de dommage ou anomalie climatique.","Dénombrements de PRA, pas de surfaces agricoles. Extrêmes locaux, pas de moyennes régionales.","Contexte saisonnier théorique ; présence des productions, stades et conséquences non établis.","Fraîcheur de référence distincte du délai de publication source, non évalué.",...(partial?["Valeurs sur portion observée exclues des scores et chiffres territoriaux."]:[])];
    return {id:m.id,edition_id:archive.edition_id,edition_date:archive.date,indicator:m.indicator,title:m.title,nature:m.nature,family,period:m.period,unit:m.unit,sources:m.sources,cycles:m.cycles,input_sha256:m.input_sha256,
      interactive_url:`/cartes-du-jour?id=${archive.edition_id}&map=${m.id}`,data_url:`/api/journal/maps?id=${archive.edition_id}&map=${m.id}`,
      rule_versions:unique(m.rows.map(r=>r.rule_version)),data_freshness:{reference_date:ref,age_days:Math.max(0,days(ref,archive.date)),metadata_count:fresh.length,examples:unique([fresh[0],fresh.at(-1)!].filter(Boolean))},
      coverage:{total:m.rows.length,qualified:valid.length,proportion:valid.length/m.rows.length,partial,missing:m.rows.filter(r=>r.value===null&&!(r.support_scope==="observed_area"&&r.observed_value!==null)).length,journal_excluded:m.rows.filter(r=>r.value!==null&&!qualified(r)).length},
      intensity:{min:values.length?Math.min(...values):null,max:values.length?Math.max(...values):null,median:median(values),amplitude:values.length?Math.max(...values)-Math.min(...values):null},
      distribution:{bounds:palette.bounds.map(b=>Number.isFinite(b)?b:null),counts,reference:`${PALETTE_VERSION}/${palette.id}`,meaning:palette.meaning},
      threshold:t?{criterion:t.criterion,count:values.filter(t.test).length,proportion:values.length?values.filter(t.test).length/values.length:0,source:t.source}:null,
      regions,agriculture:{productions:PRODUCTIONS.filter(p=>p.indicators.includes(m.indicator)).map(({id,label,limits})=>({id,label,limits})),applicability_reference:REGISTRY_VERSION,seasonal:seasonal.map(w=>({id:w.id,question:w.question,productions:w.productions,source_ids:w.source_ids,sources:archive.briefing.seasonal.sources.filter(s=>w.source_ids.includes(s.id)).map(({id,url})=>({id,url})),reserve:w.reserve}))},
      comparison:comparison(m,previous?.bundle),quality_flags:unique(m.rows.flatMap(r=>r.quality_flags)),limitations:limits,admission:{eligible:reasons.length===0,reasons},qualified_values};
  });
}
