import {it,expect} from 'vitest';
import {validatedAnomaly} from './historical';
import type {ClimateContextRow} from '../national/model';
const complete:ClimateContextRow={current_value:20,normal_1991_2020:16,anomaly:4,sample_years:30,expected_years:30,reference_coverage:1,current_coverage:1,status:'available',current_status:'available',normal_status:'available'};
it('requires a complete homologous reference and native support before presenting an anomaly',()=>{
 expect(validatedAnomaly(complete)).toBe(4);
 for(const patch of [{current_status:'partial'},{current_coverage:.95},{sample_years:29},{reference_coverage:.9},{normal_1991_2020:null},{current_value:null},{anomaly:null}])expect(validatedAnomaly({...complete,...patch})).toBeNull();
 expect(validatedAnomaly({...complete,current_value:16,anomaly:0})).toBe(0);
});
