/** Offline only: no network, provider, storage mutation or publication entrypoint. */
import {mkdirSync,writeFileSync} from "node:fs";
import {resolve,join} from "node:path";
import {hash} from "../apps/web/features/editorial/temporal";
import {buildCatalogue} from "../apps/web/features/editorial-map-selection/catalogue";
import {rankCatalogue} from "../apps/web/features/editorial-map-selection/rank";
import {committeeRequest,deterministicCommittee,selectionView} from "../apps/web/features/editorial-map-selection/committee";
import type {CatalogueCard,RankedCard} from "../apps/web/features/editorial-map-selection/model";
import pricing from "../config/editorial/openai-pricing.v1.json";
import {DATES,readArchivedMaps} from "./edit03_archives";
function summary(rows:RankedCard[],initial:RankedCard[]) {
  const distinct=(v:string[])=>[...new Set(v)].sort();
  return {count:rows.length,indicators:distinct(rows.map(r=>r.card.indicator)),families:distinct(rows.map(r=>r.card.family)),natures:distinct(rows.map(r=>r.card.nature)),
    regions_evaluable:distinct(rows.flatMap(r=>r.card.regions.filter(g=>g.qualified>0).map(g=>g.region))),
    regions_with_documented_threshold:distinct(rows.flatMap(r=>r.card.regions.filter(g=>g.affected!==null&&g.affected>0).map(g=>g.region))),
    estimated_editorial_value:{kind:"Mean initial editorial proxy, not an expert evaluation",score:rows.length?Math.round(rows.reduce((s,r)=>s+initial.find(i=>i.card.id===r.card.id)!.weighted_score,0)/rows.length*100)/100:null}};
}
const out=resolve("work/edit-03/results");mkdirSync(out,{recursive:true});
let previous:ReturnType<typeof readArchivedMaps>|undefined;
const reports=[];
for(const date of DATES){
  const source=readArchivedMaps(date),before=hash(source),cards=buildCatalogue(source.archive,source.bundle,previous),s=rankCatalogue(cards),request=committeeRequest(s),control=deterministicCommittee(s);
  const initial=rankCatalogue(cards,{min_score:0,max_cards:0}).ranked;
  const strip=(c:CatalogueCard)=>{const {qualified_values:_values,...rest}=c;void _values;return rest;};
  const report={version:s.version,mode:"simulation",publication_enabled:false,date,edition_id:source.archive.edition_id,archive_checksum:source.archive.checksum,bundle_sha256:source.bundle.sha256,
    weights:s.weights,policy:s.policy,before:{order:source.bundle.maps.map(m=>m.id),hero_map_id:source.bundle.maps[0].id,...summary(source.bundle.maps.map(m=>s.ranked.find(r=>r.card.id===m.id)!),initial)},
    after:{order:s.selected_ids,hero_map_id:s.selected_ids[0]??null,...summary(s.ranked.filter(r=>r.selected),initial)},
    rows:s.ranked.map(r=>({map_id:r.card.id,indicator:r.card.indicator,nature:r.card.nature,period:r.card.period,previous_order:source.bundle.maps.findIndex(m=>m.id===r.card.id)+1,new_order:r.selected?s.selected_ids.indexOf(r.card.id)+1:null,axes:r.axes,weighted_score:r.weighted_score,redundancy_penalty:r.redundancy_penalty,redundancy_with:r.redundancy_with,score:r.score,reasons:r.reasons,card:strip(r.card)})),
    committee:{execution:"deterministic_control_not_ai",openai_calls:0,actual_additional_cost_eur:0,prompt_version:request.version,prompt_sha256:hash(request),prompt_bytes:Buffer.byteLength(JSON.stringify(request)),
      estimated_extra_input_byte_bound:Math.max(0,Buffer.byteLength(JSON.stringify(request.cards))-Buffer.byteLength(JSON.stringify(request.cards.map(c=>c.card.id)))),
      cost_scenarios:pricing.models.map(m=>({model:m.id,pricing_version:pricing.version,estimate_only:true,input_token_bound:Buffer.byteLength(JSON.stringify(request))+4096,output_token_budget:1500,
        upper_bound_eur:Math.ceil(((Buffer.byteLength(JSON.stringify(request))+4096)*m.input_usd_per_million+1500*m.output_usd_per_million)*pricing.eur_per_usd_ceiling*pricing.regional_multiplier_ceiling)/1e6})),
      limitation:"Bornes conservatrices octets/tokens, réserve de 4096 tokens pour enveloppe, sans cache. Tarifs du référentiel archivé, pas un devis fournisseur actuel. L'intégration future dans l'appel unique exige mesure et validation du budget existant."},
    preservation:{archive_and_maps_unchanged:hash(source)===before,remote_writes:0,acquisitions:0,provider_calls:0},recommendation:"NO-GO for daily activation: weights and AI choices require editorial validation on a broader sample."};
  writeFileSync(join(out,`${date}.json`),JSON.stringify(report,null,2)+"\n");
  writeFileSync(join(out,`${date}-committee-request.json`),JSON.stringify(request,null,2)+"\n");
  writeFileSync(join(out,`${date}-committee-control.json`),JSON.stringify(control,null,2)+"\n");
  writeFileSync(join(out,`${date}-ux.json`),JSON.stringify(selectionView(s,control),null,2)+"\n");
  reports.push(report);previous=source;
}
const lines=["# EDIT-03 — Comparaison hors ligne","","Sélection algorithmique ; contrôle de comité déterministe, sans appel IA. Valeur éditoriale = proxy à valider. Les données publiées sont inchangées.",""];
for(const r of reports){
  lines.push(`## ${r.date}`,"",`Avant : ${r.before.count} cartes, une = première carte technique. Après : ${r.after.count} cartes ; une proposée = ${r.rows.find(x=>x.new_order===1)?.indicator??"aucune"} ${r.rows.find(x=>x.new_order===1)?.nature??""}.`,"","| Carte | Nature | Avant | Après | Score marginal | Redondance | Motif |","|---|---|---:|---:|---:|---:|---|");
  for(const row of [...r.rows].sort((a,b)=>a.previous_order-b.previous_order))lines.push(`| [${row.indicator}](https://agriclimax.vercel.app${row.card.interactive_url}) | ${row.nature} | ${row.previous_order} | ${row.new_order??"écartée"} | ${row.score} | −${row.redundancy_penalty} | ${row.new_order?`importance ${row.axes.importance} ; agriculture ${row.axes.agriculture} ; qualité ${row.axes.quality}`:row.reasons.at(-1)!.text} |`);
  lines.push("",`Indicateurs : ${r.before.indicators.length} → ${r.after.indicators.length} (${r.after.indicators.join(", ")}). Familles : ${r.before.families.length} → ${r.after.families.length}. Natures : ${r.after.natures.join(", ")}.`,"",`Régions évaluables : ${r.before.regions_evaluable.length} → ${r.after.regions_evaluable.length} ; régions avec seuil documenté : ${r.before.regions_with_documented_threshold.length} → ${r.after.regions_with_documented_threshold.length}. Il s'agit de couverture et de seuils descriptifs, sans surface agricole ni impact déduit.`,"",`Valeur éditoriale estimée (moyenne des scores initiaux, diversité initiale identique) : ${r.before.estimated_editorial_value.score} → ${r.after.estimated_editorial_value.score}/100. Ce proxy favorise mécaniquement les cartes conservées ; il ne constitue pas une évaluation humaine.`,"",`Coût supplémentaire réel : 0 € ; aucun appel IA. Dossier : ${r.committee.prompt_bytes} octets ; supplément maximal d'entrée face à une liste d'IDs : ${r.committee.estimated_extra_input_byte_bound} tokens sous borne 1 octet/token.`,"",...r.committee.cost_scenarios.map(c=>`- Scénario autonome ${c.model} : borne ${c.upper_bound_eur} € avec ${c.input_token_bound} tokens d'entrée et ${c.output_token_budget} de sortie ; tarif ${c.pricing_version}, cache non supposé.`),"",`[Scores, métadonnées et motifs complets](${r.date}.json) · [Dossier du comité](${r.date}-committee-request.json) · [Contrôle déterministe](${r.date}-committee-control.json) · [Structure UX-03](${r.date}-ux.json).`,"");
}
lines.push("## Recommandation","","GO pour la revue en simulation isolée. NO-GO pour l'activation quotidienne : validation éditoriale des pondérations, évaluation qualitative réelle du comité IA, calibrage sur davantage d'éditions et contrôle du budget de l'appel unique requis. Aucun déploiement ni changement du cycle OPS-07.","");
writeFileSync(join(out,"COMPARISON.md"),lines.join("\n"));
console.log(JSON.stringify(reports.map(r=>({date:r.date,before:r.before.count,after:r.after.count,hero:r.after.hero_map_id,cost_eur:0,unchanged:r.preservation.archive_and_maps_unchanged}))));
