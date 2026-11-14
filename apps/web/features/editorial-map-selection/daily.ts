import {rankCatalogue} from "./rank";
import {hash} from "../editorial/temporal";
import {committeeRequest, deterministicCommittee, validateCommittee, type CommitteeResponse} from "./committee";
import type {Simulation} from "./model";
import type {EditionMapBundle} from "../edition-maps/model";
export interface DailySelection {
  version: "edit04-1";
  maps_sha256: string;
  ranking: Simulation;
  response: CommitteeResponse;
  mode: "ai" | "deterministic";
}
// Identity excludes the publication envelope, whose checksum includes this dossier.
export const mapsDigest=(b:EditionMapBundle)=>hash([b.snapshot_id,b.input_archive_sha256,b.maps]);
export function dailyRequest(s:Simulation) {
  const request=committeeRequest(s);
  // Share identical reference text without dropping sources, scientific reserves or seasonal hypotheses.
  const limitations=[...new Set(request.cards.flatMap(r=>r.card.limitations))];
  const productions=Object.fromEntries(request.cards.flatMap(r=>r.card.agriculture.productions.map(p=>[p.id,p])));
  const seasonal=Object.fromEntries(request.cards.flatMap(r=>r.card.agriculture.seasonal.map(w=>[w.id,w])));
  const cards=request.cards.map(({card,...ranking})=>({...ranking,card:{...card,
    limitation_ids:card.limitations.map(t=>`L${limitations.indexOf(t)+1}`),limitations:undefined,
    agriculture:{applicability_reference:card.agriculture.applicability_reference,production_ids:card.agriculture.productions.map(p=>p.id),seasonal_ids:card.agriculture.seasonal.map(w=>w.id)},
  }}));
  const shared={limitations:Object.fromEntries(limitations.map((t,i)=>[`L${i+1}`,t])),productions,seasonal};
  const choice={...request.response_schema.properties.priority.items,properties:{...request.response_schema.properties.priority.items.properties,reason_ids:{type:"array",maxItems:1,items:{type:"string"}},seasonal_ids:{type:"array",maxItems:1,items:{type:"string"}}}};
  return {...request,cards,shared,version:"edit04-board-fr-1",mode:"daily_selection",publication_enabled:true,instructions:"Les limitation_ids, production_ids et seasonal_ids de chaque carte renvoient au dictionnaire shared, dont toutes les réserves et sources s’appliquent. Une principale et jusqu’à cinq complémentaires ; aucune obligation de remplissage. Cartes admissibles dont le score total atteint le plancher ; recommended est une suggestion. Un seul reason_id par choix ou rejet ; zéro ou un seasonal_id. Références fournies uniquement.",
    response_schema:{...request.response_schema,properties:{...request.response_schema.properties,hero_map_id:{type:["string","null"],enum:[null,...request.cards.map(c=>c.card.id)]},priority:{type:"array",maxItems:1,items:choice},complementary:{type:"array",maxItems:5,items:choice},excluded:{type:"array",maxItems:40,items:choice}}}};
}
export function chooseDaily(ranking:Simulation,maps_sha256:string,raw?:unknown):DailySelection {
  let response:CommitteeResponse,mode:DailySelection["mode"]="deterministic";
  try {
    response=validateCommittee(raw,ranking,true);
    if(response.priority.length>1||response.priority[0]?.map_id!==response.hero_map_id&&response.hero_map_id!==null||response.complementary.length>5||(!response.hero_map_id&&ranking.selected_ids.length))throw Error("EDIT04_HERO_REQUIRED");
    mode="ai";
  } catch {
    const control=deterministicCommittee(ranking),all=[...control.priority,...control.complementary];
    response={...control,priority:all.slice(0,1),complementary:all.slice(1,6)};
  }
  return {version:"edit04-1",maps_sha256,ranking,response,mode};
}
export function selectedMapIds(s:DailySelection,bundle:EditionMapBundle) {
  if(s.version!=="edit04-1"||s.maps_sha256!==mapsDigest(bundle))throw Error("EDIT04_MAP_BINDING");
  verifyDailySelection(s);
  const ids=[...s.response.priority,...s.response.complementary].map(c=>c.map_id);
  if(ids.length>6||s.response.priority.length>1||ids.some(id=>!bundle.maps.some(m=>m.id===id)))throw Error("EDIT04_SELECTION_BINDING");
  return ids;
}

export function verifyDailySelection(s:DailySelection) {
 if(!s||s.version!=="edit04-1"||!/^[a-f0-9]{64}$/.test(s.maps_sha256)||!["ai","deterministic"].includes(s.mode)||s.ranking.policy.max_cards!==6||s.ranking.policy.min_score!==45)throw Error("EDIT04_ARCHIVE_SELECTION");
 const recomputed=rankCatalogue(s.ranking.ranked.map(r=>r.card),{min_score:s.ranking.policy.min_score,max_cards:6});
 if(hash(recomputed)!==hash(s.ranking))throw Error("EDIT04_RANKING_INTEGRITY");
 validateCommittee(s.response,s.ranking,true);
 if(s.response.priority.length>1||s.response.complementary.length>5||s.response.priority[0]?.map_id!==s.response.hero_map_id&&s.response.hero_map_id!==null)throw Error("EDIT04_SELECTION_BINDING");
 if(s.mode==="deterministic"&&hash(chooseDaily(s.ranking,s.maps_sha256).response)!==hash(s.response))throw Error("EDIT04_FALLBACK_INTEGRITY");
}
