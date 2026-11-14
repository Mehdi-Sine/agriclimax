/** Offline comparison only. Never modifies source archives or calls a provider. */
import {mkdirSync,writeFileSync} from "node:fs";
import {hash} from "../apps/web/features/editorial/temporal";
import {buildCatalogue} from "../apps/web/features/editorial-map-selection/catalogue";
import {rankCatalogue} from "../apps/web/features/editorial-map-selection/rank";
import {chooseDaily,dailyRequest,mapsDigest,selectedMapIds} from "../apps/web/features/editorial-map-selection/daily";
import {journalMapCards} from "../apps/web/features/edition-maps/carousel-model";
import {mapInfo} from "../apps/web/features/edition-maps/model";
import {editorialPayload,budgetReport} from "../apps/web/features/editorial-ai/budget";
import {operationalConfig} from "../apps/web/features/editorial-ai/generate-operational";
import {DATES,readEdit04Archive} from "./edit04_archives";
const out="work/edit-04/results";mkdirSync(out,{recursive:true});
const lines=["# EDIT-04 — Comparaison avant / après","","Contrôle déterministe hors ligne, pas une évaluation qualitative de choix IA. Aucun appel OpenAI, aucune publication ni acquisition. Les archives sources restent inchangées.",""];
let previous:ReturnType<typeof readEdit04Archive>|undefined;
for(const date of DATES){
 const source=readEdit04Archive(date),before=hash(source),{archive,bundle}=source;
 const ranking=rankCatalogue(buildCatalogue(archive,bundle,previous),{min_score:45,max_cards:6});
 const selection=chooseDaily(ranking,mapsDigest(bundle)),ids=selectedMapIds(selection,bundle),request=dailyRequest(ranking);
 const cards=journalMapCards({status:"published",code:"MAP_PUBLISHED",maps:bundle.maps.map(mapInfo)},archive.edition_id,date,{hero_map_id:selection.response.hero_map_id,map_ids:ids});
 const costs=["gpt-6.1-terra","gpt-6-luna"].map(model=>{
  const config=operationalConfig(model),old=budgetReport(editorialPayload(archive.briefing),config,[],`${date}T12:00:00Z`),enriched=budgetReport(editorialPayload(archive.briefing,[],request),config,[],`${date}T12:00:00Z`);
  return {model,old,enriched,incremental_input_token_bound:enriched.input_token_upper_bound-old.input_token_upper_bound,incremental_cost_bound_eur:enriched.reserved_eur-old.reserved_eur,estimate_only:true,output_cap_unchanged:config.max_output_tokens};
 });
 const report={date,edition_id:archive.edition_id,archive_checksum:archive.checksum,bundle_sha256:bundle.sha256,before:{hero:bundle.maps[0].id,order:bundle.maps.map(m=>m.id)},after:{hero:selection.response.hero_map_id,order:ids},
  rows:ranking.ranked.map(r=>({map_id:r.card.id,indicator:r.card.indicator,nature:r.card.nature,period:r.card.period,before_order:bundle.maps.findIndex(m=>m.id===r.card.id)+1,after_order:ids.includes(r.card.id)?ids.indexOf(r.card.id)+1:null,score:r.score,axes:r.axes,penalty:r.redundancy_penalty,reasons:r.reasons,coverage:r.card.coverage,threshold:r.card.threshold,comparison:r.card.comparison})),cards,costs,preservation:{source_unchanged:hash(source)===before,remote_writes:0,openai_calls:0,actual_cost_eur:0}};
 writeFileSync(`${out}/${date}.json`,JSON.stringify(report,null,2)+"\n");
 writeFileSync(`${out}/${date}-request.json`,JSON.stringify(request,null,2)+"\n");
 lines.push(`## ${date}`,"",`Avant : 10 cartes, principale = temperature_min reanalysis. Après : ${ids.length} cartes, principale = ${ranking.ranked.find(r=>r.card.id===ids[0])?.card.indicator} ${ranking.ranked.find(r=>r.card.id===ids[0])?.card.nature}.`,"","| Carte | Nature | Période | Avant | Après | Score | Pénalité |","|---|---|---|---:|---:|---:|---:|",...report.rows.sort((a,b)=>a.before_order-b.before_order).map(r=>`| ${r.indicator} | ${r.nature} | ${r.period.join(" → ")} | ${r.before_order} | ${r.after_order??"écartée"} | ${r.score} | ${r.penalty} |`),"",`Le classement combine contraste spatial, seuil démontrable, contexte saisonnier sourcé, couverture, fraîcheur et diversité ; les motifs par carte et les six axes sont dans [le rapport](${date}.json). Les cartes thermiques proches subissent la pénalité de redondance. Un score reste un proxy éditorial, jamais une intensité de risque ou un dommage. Les fenêtres historiques se chevauchent : aucune évolution observée n’est inférée.`,"",...costs.map(c=>`${c.model} : ${c.old.input_token_upper_bound} → ${c.enriched.input_token_upper_bound} tokens d’entrée sous borne conservatrice (1 token/octet + enveloppe), surcoût maximal estimé ${c.incremental_cost_bound_eur.toFixed(6)} €, plafond de sortie inchangé : ${c.output_cap_unchanged}. Cache non supposé. Coût réel du test : 0 €.`),"");
 previous=source;
 console.log(JSON.stringify({date,selected:ids.length,hero:report.rows.find(r=>r.map_id===ids[0])?.indicator,unchanged:report.preservation.source_unchanged,costs:costs.map(c=>({model:c.model,extra:c.incremental_cost_bound_eur}))}));
}
writeFileSync(`${out}/COMPARISON.md`,lines.join("\n"));
