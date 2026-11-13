import {VERSION, WEIGHTS, type CatalogueCard, type RankedCard, type Simulation} from "./model";
const clamp=(n:number)=>Math.max(0,Math.min(100,n));
const round=(n:number)=>Math.round(n*100)/100;
const group=(c:CatalogueCard)=>c.family;
function overlap(a:CatalogueCard,b:CatalogueCard) {
  const lo=Math.max(Date.parse(a.period[0]),Date.parse(b.period[0])),hi=Math.min(Date.parse(a.period[1]),Date.parse(b.period[1]));
  return Math.max(0,hi-lo+86400000)/Math.max(Date.parse(a.period[1])-Date.parse(a.period[0])+86400000,Date.parse(b.period[1])-Date.parse(b.period[0])+86400000);
}
/** Absolute Pearson correlation is used only inside a documented editorial family:
 * frost counts may be inversely correlated with Tmin. It is not an impact model. */
export function redundancy(a:CatalogueCard,b:CatalogueCard): number {
  if(a.nature!==b.nature||group(a)!==group(b))return 0;
  const byId=new Map(b.qualified_values.map(r=>[r.pra,r.value]));
  const pairs=a.qualified_values.filter(r=>byId.has(r.pra)).map(r=>[r.value,byId.get(r.pra)!]);
  if(pairs.length<3)return 0;
  const n=pairs.length,x=pairs.reduce((s,p)=>s+p[0],0)/n,y=pairs.reduce((s,p)=>s+p[1],0)/n;
  const xx=pairs.reduce((s,p)=>s+(p[0]-x)**2,0),yy=pairs.reduce((s,p)=>s+(p[1]-y)**2,0);
  // Identical flat maps are redundant too. Two different flat maps need review.
  const correlation=xx===0||yy===0?Number(xx===0&&yy===0&&pairs.every(p=>p[0]===p[1])):Math.abs(pairs.reduce((s,p)=>s+(p[0]-x)*(p[1]-y),0)/Math.sqrt(xx*yy));
  return Math.min(1,correlation)*overlap(a,b)*n/Math.max(a.coverage.qualified,b.coverage.qualified);
}
function assess(c:CatalogueCard,selected:RankedCard[]):RankedCard {
  const n=c.coverage.qualified,counts=c.distribution.counts;
  const contrast=n?1-Math.max(...counts)/n:0;
  // Threshold incidence is documented only for count/min maps; otherwise the
  // proxy measures spatial contrast alone, not anomaly or agronomic severity.
  const importance=clamp(100*(c.threshold?.proportion??contrast)*.5+50*contrast);
  const agriculture=c.agriculture.productions.length?25+(c.agriculture.seasonal.length?50:0):0;
  const extent=100*(c.threshold?c.threshold.count/c.coverage.total:c.coverage.proportion);
  const actuality=(c.nature==="forecast"&&c.period[1]>=c.edition_date?80:c.data_freshness.age_days<=1?80:c.data_freshness.age_days<=7?40:20)+(c.comparison.status==="available"?20:0);
  const quality=100*c.coverage.proportion*(c.quality_flags.includes("publication_time_unknown")?.9:1);
  const diversity=selected.length===0?100:!selected.some(s=>group(s.card)===group(c))?100:!selected.some(s=>s.card.nature===c.nature&&group(s.card)===group(c))?50:0;
  const axes={importance:round(importance),agriculture,extent:round(extent),actuality,quality:round(quality),diversity};
  const weighted_score=round(Object.entries(WEIGHTS).reduce((s,[k,w])=>s+axes[k as keyof typeof axes]*w,0));
  const most=selected.map(s=>({id:s.card.id,amount:redundancy(c,s.card)})).sort((a,b)=>b.amount-a.amount||a.id.localeCompare(b.id))[0];
  const penalty=round(20*(most?.amount??0));
  return {card:c,axes,weighted_score,redundancy_penalty:penalty,redundancy_with:penalty?most.id:null,score:round(weighted_score-penalty),selected:false,reasons:[
    {id:`${c.id}:importance`,text:`Importance éditoriale ${axes.importance}/100 : moitié incidence du seuil documenté (ou contraste si absent), moitié contraste des classes. Aucun indice de dommage.`},
    {id:`${c.id}:agriculture`,text:`Pertinence ${agriculture}/100 : applicabilité de référentiel ${c.agriculture.productions.length?25:0}, contexte saisonnier sourcé ${c.agriculture.seasonal.length&&c.agriculture.productions.length?50:0}. Aucun stade réel documenté.`},
    {id:`${c.id}:coverage`,text:`${c.coverage.qualified}/${c.coverage.total} PRA qualifiées ; ${c.coverage.partial} partielles exclues, ${c.coverage.missing} absentes ; étendue ${axes.extent}/100 (${c.threshold?"incidence du seuil / univers archivé":"couverture descriptive, sans phénomène touchant toutes les PRA affirmé"}).`},
    {id:`${c.id}:actuality`,text:`Actualité ${actuality}/100 ; référence ${c.data_freshness.reference_date}. ${c.comparison.reason}`},
    {id:`${c.id}:quality`,text:`Qualité ${axes.quality}/100 : proportion de PRA admises au Journal, décote de 10 % si heure de publication source inconnue. Réserves scientifiques conservées.`},
    {id:`${c.id}:diversity`,text:`Diversité marginale ${diversity}/100 ; pénalité de redondance ${penalty}/20${penalty?` avec ${most.id}`:""}.`},
  ]};
}
/** Greedy marginal ranking, deterministic ties by indicator/nature/id. No quota,
 * no mandatory ten maps, no magnitude-normalization against the candidate pool. */
export function rankCatalogue(cards:CatalogueCard[],policy={min_score:45,max_cards:10}):Simulation {
  if(!cards.length||new Set(cards.map(c=>c.id)).size!==cards.length||cards.some(c=>c.edition_id!==cards[0].edition_id||c.edition_date!==cards[0].edition_date||!Number.isSafeInteger(c.coverage.total)||c.coverage.total<=0||c.coverage.qualified!==c.qualified_values.length||c.distribution.counts.reduce((a,b)=>a+b,0)!==c.coverage.qualified||!Number.isFinite(c.coverage.proportion)||Math.abs(c.coverage.proportion-c.coverage.qualified/c.coverage.total)>1e-12||c.qualified_values.some(v=>!Number.isFinite(v.value))))throw Error("EDIT03_CATALOGUE_INVALID");
  if(!Number.isFinite(policy.min_score)||policy.min_score<0||policy.min_score>100||!Number.isInteger(policy.max_cards)||policy.max_cards<0||policy.max_cards>10)throw Error("EDIT03_POLICY_INVALID");
  const selected:RankedCard[]=[],pending=cards.filter(c=>c.admission.eligible);
  const compare=(a:RankedCard,b:RankedCard)=>b.score-a.score||a.card.indicator.localeCompare(b.card.indicator)||a.card.nature.localeCompare(b.card.nature)||a.card.id.localeCompare(b.card.id);
  while(pending.length&&selected.length<policy.max_cards){
    const best=pending.map(c=>assess(c,selected)).sort(compare)[0];
    if(best.score<policy.min_score)break;
    best.selected=true;selected.push(best);pending.splice(pending.findIndex(c=>c.id===best.card.id),1);
  }
  const excluded=cards.filter(c=>!selected.some(s=>s.card.id===c.id)).map(c=>{
    const r=assess(c,selected);r.reasons.push({id:`${c.id}:excluded`,text:!c.admission.eligible?c.admission.reasons.join(" "):selected.length>=policy.max_cards?"Capacité éditoriale atteinte.":`Score marginal ${r.score} inférieur au plancher ${policy.min_score}.`});return r;
  }).sort(compare);
  return {version:VERSION,mode:"simulation",publication_enabled:false,edition_id:cards[0].edition_id,edition_date:cards[0].edition_date,weights:WEIGHTS,policy:{...policy,max_redundancy_penalty:20},selected_ids:selected.map(s=>s.card.id),ranked:[...selected,...excluded]};
}
