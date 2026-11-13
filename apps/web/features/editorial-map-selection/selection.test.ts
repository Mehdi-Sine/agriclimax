import {describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {readArchivedMaps} from "../../../../scripts/edit03_archives";
import {buildCatalogue} from "./catalogue";
import {rankCatalogue,redundancy} from "./rank";
import {committeeRequest,deterministicCommittee,validateCommittee,simulateCommittee,selectionView} from "./committee";
import {sealMap,sealBundle,type EditionMapBundle} from "../edition-maps/model";
import {sealArchive} from "../editorial-ai/archive";
import {hash} from "../editorial/temporal";
import type {CatalogueCard} from "./model";
const a12=readArchivedMaps("2026-11-12"),a13=readArchivedMaps("2026-11-13");
const cards12=buildCatalogue(a12.archive,a12.bundle),cards13=buildCatalogue(a13.archive,a13.bundle,a12);
const s12=rankCatalogue(cards12),s13=rankCatalogue(cards13);
function reseal(b:EditionMapBundle) {
  const {sha256:_sha,...body}=b;void _sha;
  return sealBundle({...body,maps:body.maps.map(m=>{const {id:_id,...rest}=m;void _id;return sealMap(rest);})});
}
function freeze<T>(v:T):T {if(v&&typeof v==="object"){Object.freeze(v);for(const child of Object.values(v))freeze(child);}return v;}
describe("EDIT-03 real archives and integrity before ranking",()=>{
  it.each([["12",a12,cards12],["13",a13,cards13]] as const)("audits ten archived cards on November %s and conserves exact map URLs",(_date,a,cards)=>{
    expect(cards).toHaveLength(10);
    for(const c of cards){
      expect(c.coverage.total).toBe(713);
      expect(c.coverage.qualified).toBe(c.nature==="forecast"?713:645);
      expect(c.coverage.proportion).toBe(c.coverage.qualified/c.coverage.total);
      expect(c.regions.reduce((s,r)=>s+r.total,0)).toBe(c.coverage.total);
      expect(c.distribution.counts.reduce((s,n)=>s+n,0)).toBe(c.coverage.qualified);
      const u=new URL(c.interactive_url,"https://agriclimax.vercel.app");expect(u.searchParams.get("id")).toBe(a.archive.edition_id);expect(u.searchParams.get("map")).toBe(c.id);
      expect(c.limitations.join(" ")).toContain("sans");
    }
  });
  it("rejects a tampered value, mismatched archive, and invented PRA before descriptors",()=>{
    const bad=structuredClone(a12.bundle);bad.maps[0].rows[0].value=999;
    expect(()=>buildCatalogue(a12.archive,bad)).toThrow("MAP_BUNDLE_BINDING");
    expect(()=>buildCatalogue(a13.archive,a12.bundle)).toThrow("MAP_BUNDLE_BINDING");
    const invented=structuredClone(a12.bundle);invented.maps[0].rows[0].territoryId="pra:invented";
    expect(()=>buildCatalogue(a12.archive,reseal(invented))).toThrow("MAP_ROW_QUALIFICATION");
    const archive=structuredClone(a12.archive);archive.draft.headline.text="altered";
    expect(()=>buildCatalogue(archive,a12.bundle)).toThrow("ARCHIVE_INTEGRITY");
  });
  it("excludes an unqualified territorial result even if numeric, and never promotes a partial value",()=>{
    const b=structuredClone(a12.bundle),map=b.maps[0],row=map.rows.find(r=>r.value!==null)!;
    row.quality!.journal_eligible=false;
    const cards=buildCatalogue(a12.archive,reseal(b)),c=cards[0];
    expect(c.coverage.qualified).toBe(644);expect(c.coverage.journal_excluded).toBe(1);expect(c.qualified_values.some(v=>v.pra===row.territoryId)).toBe(false);
    const partial=map.rows.find(r=>r.value===null)!;partial.observed_value=500;partial.support_scope="observed_area";
    const p=buildCatalogue(a12.archive,reseal(b))[0];expect(p.coverage.partial).toBe(1);expect(p.intensity.max).toBe(c.intensity.max);
  });
  it("keeps NULL distinct from zero; no rain-day threshold or crop damage inferred",()=>{
    const frost=cards12.find(c=>c.indicator==="frost")!,rain=cards12.find(c=>c.indicator==="rain")!;
    expect(frost.qualified_values.some(v=>v.value===0)).toBe(true);expect(frost.coverage.qualified).toBe(645);
    expect(frost.threshold!.count).toBe(frost.qualified_values.filter(v=>v.value>0).length);
    expect(rain.threshold).toBeNull();expect(rain.coverage.missing).toBe(68);
    for(const c of cards12)for(const w of c.agriculture.seasonal){expect(w.source_ids.length).toBeGreaterThan(0);expect(w.sources.map(s=>s.id).sort()).toEqual([...w.source_ids].sort());}
  });
  it("does not claim a change from overlapping historical or shifted forecast windows",()=>{
    expect(cards12.every(c=>c.comparison.status==="no_previous")).toBe(true);
    expect(cards13.every(c=>c.comparison.status==="not_comparable"&&c.comparison.median_delta===null)).toBe(true);
  });
  it("only computes a descriptive delta on identical qualified supports in adjacent equal windows",()=>{
    const b=structuredClone(a13.bundle);for(const m of b.maps.filter(m=>m.nature==="reanalysis"))m.period=["2026-11-06","2026-11-12"];
    // Synthetic period edit for branch coverage only; never exported as real evidence.
    const comparable=buildCatalogue(a13.archive,reseal(b),a12);
    const rain=comparable.find(c=>c.indicator==="rain"&&c.nature==="reanalysis")!;
    expect(rain.comparison.status).toBe("available");expect(rain.comparison.matched_pra).toBe(645);expect(Number.isFinite(rain.comparison.median_delta)).toBe(true);
    b.maps.find(m=>m.id===a13.bundle.maps[2].id)!.rows.find(r=>r.value!==null)!.support_id="different";
    expect(buildCatalogue(a13.archive,reseal(b),a12).find(c=>c.indicator==="rain"&&c.nature==="reanalysis")!.comparison.status).toBe("not_comparable");
  },15000);
  it("runs on recursively frozen archives, maps and catalogue without mutating them",()=>{
    const source=freeze(structuredClone(a13)),before=hash(source),catalogue=freeze(buildCatalogue(source.archive,source.bundle,a12));
    rankCatalogue(catalogue);expect(hash(source)).toBe(before);expect(hash(source.bundle)).toBe(hash(a13.bundle));
  });
});
describe("editorial ranking with explicit quality and coverage",()=>{
  it.each([[s12,"temperature_min"],[s13,"rain"]] as const)("retains six cards and exposes every component and rejection",(s,hero)=>{
    expect(s.publication_enabled).toBe(false);expect(s.selected_ids).toHaveLength(6);expect(s.ranked[0].card.indicator).toBe(hero);expect(s.ranked[0].card.nature).toBe("forecast");
    expect(new Set(s.ranked.filter(r=>r.selected).map(r=>r.card.indicator)).size).toBe(5);
    for(const r of s.ranked){expect(r.score).toBeCloseTo(r.weighted_score-r.redundancy_penalty,2);expect(r.reasons.length).toBeGreaterThanOrEqual(6);if(!r.selected)expect(r.reasons.at(-1)!.id).toContain(":excluded");}
  });
  it("is invariant to archive array order and uses deterministic tie breaks",()=>{
    expect(rankCatalogue([...cards13].reverse())).toEqual(s13);
  });
  it("rejects misleading coverage metadata and allows a calm edition with zero maps",()=>{
    const bad=structuredClone(cards12);bad[0].coverage.proportion=1;
    expect(()=>rankCatalogue(bad)).toThrow("EDIT03_CATALOGUE_INVALID");
    const quiet=rankCatalogue(cards12,{min_score:100,max_cards:10});expect(quiet.selected_ids).toEqual([]);
    expect(selectionView(quiet,deterministicCommittee(quiet))).toMatchObject({hero_map_id:null,cards:[]});
  });
  it("uses proportions over the archived universe, without a 645 ceiling",()=>{
    const c=cards12[2];
    const expanded=(factor:number):CatalogueCard=>({...c,coverage:{...c.coverage,total:c.coverage.total*factor,qualified:c.coverage.qualified*factor,partial:c.coverage.partial*factor,missing:c.coverage.missing*factor},distribution:{...c.distribution,counts:c.distribution.counts.map(n=>n*factor)},qualified_values:Array.from({length:factor},(_,i)=>c.qualified_values.map(v=>({pra:`${v.pra}-${i}`,value:v.value}))).flat()});
    expect(rankCatalogue([expanded(2)]).ranked[0].axes).toEqual(rankCatalogue([c]).ranked[0].axes);
    // Test-only extension of eligible rows, no scientific values calculated.
    const b=structuredClone(a12.bundle),m=b.maps[2],template=m.rows.find(r=>r.value!==null)!;
    for(const r of m.rows.filter(r=>r.value===null)){const id=r.territoryId;Object.assign(r,structuredClone(template),{territoryId:id});}
    const grown=buildCatalogue(a12.archive,reseal(b))[2];expect(grown.coverage.qualified).toBe(713);
    const axes=rankCatalogue([grown]).ranked[0].axes;expect(axes.quality).toBeGreaterThan(rankCatalogue([c]).ranked[0].axes.quality);expect(axes.extent).toBe(100);
  });
  it("penalizes thermal duplicates only within compatible nature and period",()=>{
    const mean=cards13.find(c=>c.indicator==="temperature_mean"&&c.nature==="forecast")!,gdd=cards13.find(c=>c.indicator==="gdd"&&c.nature==="forecast")!;
    expect(redundancy(mean,gdd)).toBeGreaterThan(.99);
    expect(redundancy({...mean,nature:"reanalysis"},gdd)).toBe(0);
    expect(redundancy({...mean,period:["2026-10-01","2026-10-02"]},gdd)).toBe(0);
    const flat={...mean,qualified_values:mean.qualified_values.map(v=>({...v,value:0}))};expect(redundancy(flat,flat)).toBe(1);
    expect(s13.ranked.find(r=>r.card.id===gdd.id)!.redundancy_penalty).toBeGreaterThan(19);
  });
  it("rejects selection even at a zero score floor when all journal supports are ineligible",()=>{
    const b=structuredClone(a12.bundle);for(const m of b.maps)for(const row of m.rows)if(row.quality)row.quality.journal_eligible=false;
    const s=rankCatalogue(buildCatalogue(a12.archive,reseal(b)),{min_score:0,max_cards:10});expect(s.selected_ids).toEqual([]);expect(committeeRequest(s).cards).toEqual([]);
  });
});
describe("isolated IA board and UX-03 contract",()=>{
  it("sends rich facts and computed scores, without raw PRA arrays, and validates a complete control",()=>{
    const request=committeeRequest(s13);expect(request.cards).toHaveLength(10);expect(JSON.stringify(request)).not.toContain("qualified_values");expect(request.cards[0].card.regions).toHaveLength(13);expect(request.cards[0].card.intensity.max).not.toBeNull();
    const response=deterministicCommittee(s13);expect(response.priority).toHaveLength(5);expect(response.complementary).toHaveLength(1);expect(response.excluded).toHaveLength(4);
    expect(validateCommittee(response,s13)).toEqual(response);
    const ux=selectionView(s13,response);expect(ux.cards.map(c=>c.map_id)).toEqual(s13.selected_ids);expect(ux.cards.map(c=>c.order)).toEqual([1,2,3,4,5,6]);expect(ux.cards[0].role).toBe("hero");expect(ux.cards.every(c=>c.caption.length<140&&c.interactive_url.includes(c.map_id))).toBe(true);
  });
  it("rejects invented scores, facts, references, duplicate selections and empty justifications",()=>{
    const control=deterministicCommittee(s13);
    expect(()=>validateCommittee({...control,score:100},s13)).toThrow("EDIT03_BOARD_CONTRACT");
    expect(()=>validateCommittee({...control,hero_map_id:"invented"},s13)).toThrow("EDIT03_BOARD_SELECTION");
    for(const field of ["reason_ids","seasonal_ids"] as const){const v=structuredClone(control);v.priority[0][field]=["invented"];expect(()=>validateCommittee(v,s13)).toThrow("EDIT03_BOARD_EVIDENCE");}
    const duplicate=structuredClone(control);duplicate.complementary.push(duplicate.priority[0]);expect(()=>validateCommittee(duplicate,s13)).toThrow("EDIT03_BOARD_REFERENCE");
    const empty=structuredClone(control);empty.priority[0].reason_ids=[];expect(()=>validateCommittee(empty,s13)).toThrow("EDIT03_BOARD_EVIDENCE");
    const fake=structuredClone(control);Object.assign(fake.priority[0],{title:"Récoltes détruites"});expect(()=>validateCommittee(fake,s13)).toThrow("EDIT03_BOARD_REFERENCE");
    const scoreRejected=structuredClone(control);const excluded=scoreRejected.excluded.pop()!;scoreRejected.complementary.push(excluded);expect(()=>validateCommittee(scoreRejected,s13)).toThrow("EDIT03_BOARD_INADMISSIBLE_SELECTION");
  });
  it("preserves the chosen hero and ordered priorities, rejects omitted alternatives and wrong evidence",()=>{
    const control=deterministicCommittee(s13),r=structuredClone(control);r.hero_map_id=r.priority[1].map_id;expect(selectionView(s13,r).hero_map_id).toBe(r.hero_map_id);
    const omitted=structuredClone(control);omitted.excluded.pop();expect(()=>validateCommittee(omitted,s13)).toThrow("EDIT03_BOARD_SELECTION");
    const wrong=structuredClone(control);wrong.priority[0].reason_ids=wrong.priority[1].reason_ids;expect(()=>validateCommittee(wrong,s13)).toThrow("EDIT03_BOARD_EVIDENCE");
  });
  it("calls an injected provider once, records evidence/model/prompt/time, and never publishes",async()=>{
    const provider={model:"test-provider-only",complete:vi.fn(async()=>deterministicCommittee(s13))};
    const r=await simulateCommittee(s13,provider,"2026-11-13T16:00:00Z");expect(provider.complete).toHaveBeenCalledTimes(1);expect(r.assistance_ia).toBe(true);expect(r.publication_enabled).toBe(false);expect(r.request_sha256).toBe(hash(r.request));expect(r.view.cards).toHaveLength(6);
  });
  it("fails closed on provider errors or invalid output, without retry or fallback publication",async()=>{
    const failed={model:"test",complete:vi.fn(async()=>{throw Error("PROVIDER_FAILED");})};await expect(simulateCommittee(s13,failed,"2026-11-13T16:00:00Z")).rejects.toThrow("PROVIDER_FAILED");expect(failed.complete).toHaveBeenCalledTimes(1);
    await expect(simulateCommittee(s13,{model:"test",complete:async()=>({})},"2026-11-13T16:00:00Z")).rejects.toThrow("EDIT03_BOARD_CONTRACT");
  });
  it("makes no model call when no card passes the editorial floor",async()=>{
    const provider={model:"test",complete:vi.fn(async()=>({}))};
    const result=await simulateCommittee(rankCatalogue(cards13,{min_score:100,max_cards:10}),provider,"2026-11-13T16:00:00Z");
    expect(provider.complete).not.toHaveBeenCalled();expect(result.assistance_ia).toBe(false);expect(result.model).toBeNull();expect(result.view.cards).toEqual([]);
  });
  it("rejects an oversized provider response before accepting any model choice",async()=>{
    await expect(simulateCommittee(s13,{model:"test",complete:async()=>({data:"x".repeat(65536)})},"2026-11-13T16:00:00Z")).rejects.toThrow("EDIT03_BOARD_RESPONSE_BUDGET");
  });
  it("refuses archived dates outside the authorized two-day simulation scope",()=>{
    const a=structuredClone(a12.archive);a.date="2026-11-11";a.briefing.edition_date=a.date;a.draft.edition_date=a.date;
    // Archive verification may reject its briefing first; no alternate date is admitted.
    const {checksum:_checksum,...body}=a;void _checksum;expect(()=>buildCatalogue(sealArchive(body),a12.bundle)).toThrow();
  });
});
