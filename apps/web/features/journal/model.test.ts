import {describe,it,expect} from 'vitest';
import {assertEdition} from './validate';
import {buildEdition} from './model';
import {compare,type Snapshot} from './history';
import {createRegistry,type Contribution} from './registry';
import {type WatchSummary,PHENOMENA} from '../national-watch/model';
// Explicitly synthetic unit fixtures, never imported by production modules.
function fixture():WatchSummary{return {version:'test',identity:'synthetic',source_version:'fixture-only',run:'2026-07-01T00:00:00Z',published_at:null,acquired_at:'2026-07-01T06:00:00Z',period:['2026-07-02','2026-07-08'],source_nature:'forecast',metrics:[],evidence:{},places:[{id:'pra:a',name:'A',region:'Bretagne'},{id:'pra:b',name:'B',region:'Corse'}],productions:[{id:'wheat',label:'Blé tendre',pra_ids:['pra:a'],known_pra_ids:['pra:a'],source:'RPG fixture',year:2025,limitation:'Stade inconnu'}],coverage:PHENOMENA.map(p=>({phenomenon:p.id,evaluated:1,affected:1,insufficient:1,unavailable:0})),events:['heat','rain'].map((p,i)=>({id:`${p}:Bretagne:2026-07-02:2026-07-08`,phenomenon:i?'rain':'heat',region:'Bretagne',start:'2026-07-02',end:'2026-07-08',value:30,unit:i?'mm':'°C',pra_ids:['pra:a'],evaluated:1,duration:1,text:'Fait synthétique de test : 30 unités.',intensity:1,production_ids:['wheat'],provenance:['fixture-only'],quality_flags:[],rule_version:'test',data_freshness:['fresh']})),calculated_at:'2026-07-01',compute_ms:0};}
const now='2026-07-01T12:00:00Z';
const snapshot:Snapshot={nature:'reanalysis',source:'era-test',model:'native-test',version:'test-1',unit:'°C',period:['2026-07-08','2026-07-08'],date:'2026-07-08',complete:true,pra_ids:['a'],evaluated_ids:['a','b'],magnitude:3,episode_id:'documented-test-episode'};
const previous={...snapshot,date:'2026-07-01',period:['2026-07-01','2026-07-01'] as [string,string]};
describe('Task31: synthetic scientific and editorial acceptance',()=>{
 it('1 selects several available phenomena with references for every factual number',()=>{const e=buildEdition(fixture(),{now});expect(e.main_story).not.toBeNull();expect(e.secondary_stories).toHaveLength(1);expect(e.key_facts.every(f=>e.evidence.facts.some(x=>x.id===f.id&&x.provenance.length))).toBe(true);});
 it('2 supports an edition without exceptional events',()=>{const s=fixture();s.events=[];expect(buildEdition(s,{now}).headline).toContain('sans franchissement');});
 it('3 supports insufficient data',()=>{const s=fixture();s.events=[];s.coverage=[];expect(buildEdition(s,{now}).headline).toContain('insuffisantes');});
 it('4 and 15 marks archived forecasts expired',()=>{expect(buildEdition(fixture(),{now:'2026-09-01'}).data_freshness).toBe('expired');});
 it('5 accepts a homogeneous temporal comparison',()=>{expect(compare({...snapshot,magnitude:4},previous,7).status).toBe('intensification');});
 it('6 rejects incompatible sources and forecast validity periods',()=>{expect(compare(snapshot,{...previous,source:'other'},7).status).toBe('unknown');expect(compare({...snapshot,nature:'forecast'},{...previous,nature:'forecast'},7).status).toBe('unknown');});
 it('7 recognises maintained episodes rather than recalculation as appearance',()=>{expect(compare(snapshot,previous,7).status).toBe('maintained');});
 it('8 discovers a contributor without engine or UI changes',()=>{const section:Contribution={id:'new-production',label:'Nouvelle production',family:'Test',indicators:[],declared_pra_count:0,source:'fixture',year:null,event_ids:[],href:'/analyse',limits:'Test'};const registry=createRegistry([{id:section.id,version:'1',contribute:()=>section}]);expect(buildEdition(fixture(),{now,registry}).production_sections[0].id).toBe(section.id);});
 it('9 excludes nonqualified unavailable and nonpublishable indicators',()=>{const e=buildEdition(fixture(),{now});expect(e.production_sections.every(p=>p.indicators.length===0)).toBe(true);});
 it('10 focuses on a documented region',()=>expect(buildEdition(fixture(),{now}).regional_focus_ids).toEqual(['Bretagne']));
 it('11 keeps a region without remarkable events consultable',()=>expect(buildEdition(fixture(),{now}).regional_sections.find(r=>r.id==='Corse')?.summary).toContain('insuffisantes'));
 it('12 never interprets RPG presence as sensitivity',()=>{const e=buildEdition(fixture(),{now});expect(e.production_sections.find(p=>p.id==='wheat')?.declared_pra_count).toBe(1);expect(e.limitations.join()).toContain('stade et sensibilité inconnus');});
 it('13 rejects incomplete temporal indicators',()=>expect(compare({...snapshot,complete:false},previous,7).status).toBe('unknown'));
 it('14 retains partial coastal coverage as insufficient',()=>{const e=buildEdition(fixture(),{now});expect(e.regional_sections.find(r=>r.id==='Corse')?.coverage.every(c=>c.evaluated===0)).toBe(true);});
 it('reproduces IDs and content independent of event input order',()=>{const s=fixture(),a=buildEdition(s,{now});s.events.reverse();expect(buildEdition(s,{now})).toEqual(a);expect(buildEdition(s,{now:'2026-07-01T13:00:00Z'}).edition_id).toBe(a.edition_id);});
 it('does not merge spatially disjoint episodes',()=>expect(compare(snapshot,{...previous,pra_ids:['b']},7).status).toBe('unknown'));
 it('detects extension appearance disappearance and attenuation',()=>{expect(compare({...snapshot,pra_ids:['a','b']},previous,7).status).toBe('extension');expect(compare(snapshot,{...previous,pra_ids:[]},7).status).toBe('appearance');expect(compare({...snapshot,pra_ids:[]},previous,7).status).toBe('disappearance');expect(compare({...snapshot,magnitude:2},previous,7).status).toBe('attenuation');});
 it('rejects duplicate contributors and malformed contracts',()=>{expect(()=>createRegistry([{id:'x',version:'1',contribute:()=>({} as Contribution)},{id:'x',version:'1',contribute:()=>({} as Contribution)}])).toThrow();expect(()=>createRegistry([{id:'x',version:'1',contribute:()=>({} as Contribution)}]).read(fixture())).toThrow();});
});

it('validates the complete schema and rejects dangling factual references',()=>{const e=buildEdition(fixture(),{now});expect(()=>assertEdition(e)).not.toThrow();e.main_story!.facts=['missing'];expect(()=>assertEdition(e)).toThrow('REFERENCES');});
it('publishes a new qualified contributor with its proof bundle',()=>{
 const fact={id:'qualified-test-fact',text:'Valeur synthétique de test 4 °C.',value:4,unit:'°C',period:['2026-07-02','2026-07-08'] as [string,string],source:'fixture',rule_version:'test-1',provenance:['fixture-only'],quality_flags:[],data_freshness:['fresh'],href:'/analyse'};
 const section:Contribution={id:'new',label:'Nouvelle production',family:'Test',indicators:[{id:'new-index',version:'test-1',period:fact.period,scale:'pra',quality:'complete fixture',status:'available',qualified:true,publishable:true,provenance:['fixture-only'],limits:'Fixture only',facts:[fact]}],declared_pra_count:0,source:'fixture',year:null,event_ids:[],href:'/analyse',limits:'Fixture only'};
 const registry=createRegistry([{id:'new',version:'1',contribute:()=>section}]),e=buildEdition(fixture(),{now,registry});
 expect(e.production_sections[0].indicators).toHaveLength(1);expect(e.evidence.facts).toContainEqual(fact);expect(()=>assertEdition(e)).not.toThrow();
 section.indicators[0].status='insufficient';expect(buildEdition(fixture(),{now,registry}).production_sections[0].indicators).toHaveLength(0);
});
it('keeps a stable region with evaluated data accessible',()=>{const s=fixture();s.metrics=[{pra:'pra:b',phenomenon:'heat',value:20,days:0,detected:false,state:'no_threshold_crossing',evidence_id:'synthetic'}];expect(buildEdition(s,{now}).regional_sections.find(r=>r.id==='Corse')?.summary).toContain('Aucun critère');});
it('requires exact 3 7 14 30-day histories and preserves forecast revisions as forecasts',()=>{
 for(const horizon of [3,7,14,30] as const){expect(compare(snapshot,undefined,horizon).status).toBe('insufficient_history');expect(compare(snapshot,{...previous,version:'other'},horizon).status).toBe('unknown');}
 const current={...snapshot,nature:'forecast' as const};const prior={...previous,nature:'forecast' as const,period:current.period};expect(compare(current,prior,7).reason).toContain('Révision des prévisions');
});
