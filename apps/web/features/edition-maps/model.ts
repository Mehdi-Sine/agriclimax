import {hash} from "../editorial/temporal";
import {isCalendarDate} from "../national/daily-availability";
import {RECIPES} from "../multiproduction/registry";
import identities from "../../data/operational/pra-identities.json";
import type {AgroResult} from "../agroclimatic/calculate";

/** Application publication envelope. Scientific results and rules are unchanged. */
export interface EditionMap {
  id:string; indicator:string; title:string; nature:"reanalysis"|"forecast";
  period:[string,string]; unit:string; sources:string[]; cycles:string[]; input_sha256:string;
  rows:Pick<AgroResult,"territoryId"|"value"|"observed_value"|"status"|"reason"|"support_scope"|"support_id"|"spatial_coverage"|"temporal_coverage"|"data_freshness"|"rule_version"|"quality_flags"|"provenance"|"quality">[];
}
export type EditionMapInfo=Omit<EditionMap,"rows">&{coverage:{whole:number;partial:number;missing:number}};
export interface EditionMapBundle {
  version:"edition-maps-1"; edition_id:string; edition_checksum:string; edition_date:string;
  snapshot_id:string; input_archive_sha256:string; maps:EditionMap[]; sha256:string;
}
export interface MapApproval {
  bundle_sha256:string; reviewer:string; reviewed_at:string; scope:"descriptive_maps";
}
export interface MapPublication {
  version:"edition-map-publication-1"; edition_id:string; edition_checksum:string;
  bundle:{path:string;sha256:string;bytes:number;content_sha256:string}; approval:MapApproval;
}
export interface EditionMapsView {
  status:"published"|"preview"|"absent"|"error"; code:string;
  bundle_sha256?:string; maps:EditionMapInfo[];
}
export const mapInfo=({rows,...m}:EditionMap):EditionMapInfo=>({...m,coverage:{
  whole:rows.filter(r=>r.value!==null).length,
  partial:rows.filter(r=>r.support_scope==="observed_area"&&r.observed_value!=null).length,
  missing:rows.filter(r=>r.value===null&&!(r.support_scope==="observed_area"&&r.observed_value!=null)).length,
}});
const digest=(s:unknown):s is string=>typeof s==="string"&&/^[a-f0-9]{64}$/.test(s);
const strings=(a:unknown):a is string[]=>Array.isArray(a)&&a.every(s=>typeof s==="string");
export function sealMap(map:Omit<EditionMap,"id">):EditionMap{return {...map,id:hash(map)};}
export function sealBundle(bundle:Omit<EditionMapBundle,"sha256">):EditionMapBundle{return {...bundle,sha256:hash(bundle)};}
export function verifyBundle(value:unknown,edition:{edition_id:string;checksum:string;date:string}):EditionMapBundle {
  if(!value||typeof value!=="object")throw Error("MAP_BUNDLE_CONTRACT");
  const b=value as EditionMapBundle;
  const {sha256,...body}=b;
  if(b.version!=="edition-maps-1"||hash(body)!==sha256||!digest(b.edition_id)||!digest(b.edition_checksum)||
    b.edition_id!==edition.edition_id||b.edition_checksum!==edition.checksum||b.edition_date!==edition.date||
    !digest(b.snapshot_id)||!digest(b.input_archive_sha256)||!Array.isArray(b.maps)||b.maps.length<1||b.maps.length>40||new Set(b.maps.map(m=>m.id)).size!==b.maps.length)throw Error("MAP_BUNDLE_BINDING");
  for(const m of b.maps){
    const {id,...map}=m;
    const recipe=RECIPES.find(r=>r.id===m.indicator);
    if(hash(map)!==id||!recipe||m.unit!==recipe.kernel.unit||m.title!==recipe.kernel.label||!digest(m.input_sha256)||
      !["forecast","reanalysis"].includes(m.nature)||!Array.isArray(m.period)||m.period.length!==2||!m.period.every(isCalendarDate)||m.period[0]>m.period[1]||
      (Date.parse(m.period[1])-Date.parse(m.period[0]))/86400000>=30||
      (m.nature==="reanalysis"&&m.period[1]>=b.edition_date)||
      !strings(m.sources)||!m.sources.length||!strings(m.cycles)||m.cycles.some(c=>!Number.isFinite(Date.parse(c)))||
      (m.nature==="forecast"&&!m.cycles.length)||
      !Array.isArray(m.rows)||m.rows.length!==713||new Set(m.rows.map(r=>r.territoryId)).size!==713)throw Error("MAP_CONTRACT");
    for(const r of m.rows){
      const finite=(v:unknown)=>typeof v==="number"&&Number.isFinite(v);
      if(!identities.ids.includes(r.territoryId)||!(r.value===null||finite(r.value))||!(r.observed_value===null||finite(r.observed_value))||
        !["available","partial","unavailable"].includes(r.status)||!r.quality||
        !finite(r.spatial_coverage)||r.spatial_coverage!<0||r.spatial_coverage!>1||!finite(r.temporal_coverage)||r.temporal_coverage!<0||r.temporal_coverage!>1||
        !strings(r.provenance)||!strings(r.data_freshness)||!strings(r.quality_flags)||!r.rule_version||
        (r.value!==null&&(!r.quality.indicator_eligible||!["whole_pra","qualified_pra_estimate"].includes(r.support_scope??"")||!r.provenance.length||!r.data_freshness.length))||
        (r.support_scope==="observed_area"&&r.value!==null)||
        (r.observed_value!==null&&!["observed_area","qualified_pra_estimate"].includes(r.support_scope??"")))throw Error("MAP_ROW_QUALIFICATION");
    }
  }
  return b;
}
export function publicationPath(edition:{edition_id:string;checksum:string}){
  if(!digest(edition.edition_id)||!digest(edition.checksum))throw Error("MAP_EDITION_ID");
  return `edition-maps/${edition.edition_id}/${edition.checksum}/publication.json`;
}
export function verifyPublication(value:unknown,edition:{edition_id:string;checksum:string}):MapPublication {
  const p=value as MapPublication;
  if(!p||p.version!=="edition-map-publication-1"||p.edition_id!==edition.edition_id||p.edition_checksum!==edition.checksum||
    !p.bundle||!digest(p.bundle.sha256)||p.bundle.path!==`edition-maps/blobs/${p.bundle.sha256}.json.gz`||!digest(p.bundle.content_sha256)||
    !Number.isSafeInteger(p.bundle.bytes)||p.bundle.bytes<=0||p.bundle.bytes>8*1024**2||
    !p.approval||p.approval.bundle_sha256!==p.bundle.content_sha256||p.approval.scope!=="descriptive_maps"||
    typeof p.approval.reviewer!=="string"||!p.approval.reviewer.trim()||p.approval.reviewer.length>160||
    !Number.isFinite(Date.parse(p.approval.reviewed_at)))throw Error("MAP_PUBLICATION_CONTRACT");
  return p;
}
