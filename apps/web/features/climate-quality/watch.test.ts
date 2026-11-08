import {it,expect} from 'vitest';
import {forecastSupport} from './adapters';
import {detectQualifiedNational,packMetrics,qualityForEvidence,type WatchSummary} from '../national-watch/model';
import {journalMapData} from '../journal/ui/map-data';
import type {WeatherRow} from '../operational/model';
import geography from '../../data/operational/pra-watch-places.json';
const row=(date:string,coverage=.5):WeatherRow=>({pra_id:'pra:29102',valid_date:date,valid_from:date+'T00:00:00Z',valid_to:new Date(Date.parse(date)+86400000).toISOString(),variable:'temperature_min',unit:'degC',value:0,status:coverage===1?'available':'partial',spatial_coverage:coverage,temporal_coverage:1,source_id:'synthetic',nature:'forecast',model:'synthetic',model_run_at:'2026-11-07T00:00:00Z',grid_version:'synthetic',weights_sha256:'synthetic',rule_version:'synthetic',data_freshness:'synthetic',provenance:{checksum:'synthetic',reference_version:'synthetic'},provenance_sha256:'synthetic',quality_flags:[]} as unknown as WeatherRow);
it('retains a partial zero on the Journal map without publishing absence of frost as a territorial fact',()=>{
 const result=detectQualifiedNational([row('2026-11-08')],geography.places,'2026-11-08','2026-11-08');
 const m=result.metrics.find(m=>m.pra==='pra:29102'&&m.phenomenon==='frost')!;
 expect(m.value).toBeNull();expect(m.observed_value).toBe(0);expect(m.detected).toBeNull();expect(m.state).toBe('insufficient');expect(result.events).toHaveLength(0);
 const packed=packMetrics(result.metrics);
 const summary={...packed,places:geography.places,run:'2026-11-07T00:00:00Z',period:['2026-11-08','2026-11-08'],identity:'synthetic',source_version:'synthetic',version:'national-watch-1.1.0'} as WatchSummary;
 const map=journalMapData(summary,'frost');expect(map.rows).toHaveLength(713);
 expect(map.rows.find(r=>r.id==='pra:29102')).toMatchObject({value:0,status:'partial',quality:{state:'observed_partial',journal_eligible:false}});
 expect(Object.keys(packed.quality).length).toBeLessThan(10);
});
it('rejects a grid break within one forecast segment',()=>{
 const a=row('2026-11-08',1),b={...row('2026-11-09',1),grid_version:'different'};
 const m=detectQualifiedNational([a,b],geography.places,'2026-11-08','2026-11-09').metrics.find(m=>m.pra===a.pra_id&&m.phenomenon==='frost')!;
 expect(m.value).toBeNull();expect(m.observed_value).toBeNull();expect(m.detected).toBeNull();
 const t={...a,variable:'temperature' as const},h={...a,variable:'humidity' as const,unit:'%' as const};
 expect(forecastSupport([t,h])).toBeDefined();
 for(const incompatible of [{...h,rule_version:'other'},{...h,nature:'analysis' as const},{...h,provenance:{...h.provenance,reference_version:'other'}}]) expect(forecastSupport([t,incompatible])).toBeUndefined();
});

it('preserves exact fractions when native-complete quality templates are deduplicated',()=>{
 const r={...row('2026-11-08',.9999997),status:'available' as const};
 const metrics=detectQualifiedNational([r],geography.places,'2026-11-08','2026-11-08').metrics;
 const packed=packMetrics(metrics),m=packed.metrics.find(m=>m.pra===r.pra_id&&m.phenomenon==='frost')!;
 const evidence=packed.evidence[m.evidence_id];
 expect(qualityForEvidence(evidence,packed.quality,0)?.evidence.fraction).toBe(.9999997);
 expect(packed.quality[evidence.quality_ids![0]].evidence).not.toHaveProperty("fraction");
 expect(qualityForEvidence(evidence,packed.quality,0)?.evidence.support_id).toBe("synthetic");
});
