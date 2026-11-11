import {describe,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {capture,replayIndicators} from '../../../../scripts/manual_indicators';
import {hash} from '../editorial/temporal';
import geography from '../../data/operational/pra-watch-places.json';
describe('OPS-04 captured AGRO inputs',()=>{
 it('replays deterministically on all 713 PRA without a source request, leaving missing humidity absent',()=>{
  const inputs=capture((pra)=>[{pra,date:'2026-11-04',values:{temperature:10,temperature_min:5,temperature_max:15,precipitation:0,humidity:null},compatible:true,complete:true,source:'synthetic-reanalysis',run:null,nature:'reanalysis',freshness:'source 2026-11-04',provenance:['synthetic'],quality_flags:[],climate_support:{id:'synthetic-mask',fraction:1,temporal_complete:true,mask:'native_valid_cells',method:'synthetic'}}]);
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  try{
   const one=replayIndicators(['2026-11-04','2026-11-04'],inputs),two=replayIndicators(['2026-11-04','2026-11-04'],inputs);
   expect(one.metrics.pra_count).toBe(713);expect(new Set(one.measurements.map(m=>m.result.territoryId))).toEqual(new Set(geography.places.map(p=>p.id)));
   expect(hash(one)).toBe(hash(two));expect(fetcher).not.toHaveBeenCalled();
   expect(one.measurements.filter(m=>m.indicator==='thi').every(m=>m.result.value===null)).toBe(true);
   expect(one.measurements.every(m=>m.result.data_freshness.every(f=>f.includes('2026-11-04')))).toBe(true);
  }finally{vi.unstubAllGlobals();}
 },30000);
});
