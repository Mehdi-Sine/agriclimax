import {it,expect} from "vitest";
import {RULES} from "./catalogue";
import {calculate,type InputDay} from "./calculate";
// Hand-calculated contrasting cases, exclusively test inputs, never served in the UI.
const rows:InputDay[]=[-2,26,30].map((t,i)=>({pra:"pra:28341",date:`2026-11-0${i+1}`,values:{temperature:t,temperature_min:[-3,0,2][i],temperature_max:t,precipitation:[0,1,21][i],humidity:50},complete:true,compatible:true,source:"audit-test",run:null,nature:"reanalysis",freshness:"2026-11-03",provenance:["synthetic-unit-test-only"],quality_flags:[]}));
const expected:Record<string,number>={gdd:56,hot:2,hot_sequence:2,frost:1,frost_sequence:1,rain:22,heavy_rain:1,dry:1,dry_sequence:1,thi:78.3,thi_days:2,thi_sequence:2,cattle_heat:2,temperature_mean:18};
it.each(RULES)("audits $id against hand calculations, missing days and nature boundaries",rule=>{
 const run=(r:InputDay[])=>calculate("pra:28341",r,"2026-11-01","2026-11-03",rule,rule.threshold);
 expect(run(rows).value).toBeCloseTo(expected[rule.id],8);
 expect(run(rows.slice(0,2)).value).toBeNull();
 const mixed=structuredClone(rows);mixed[1].nature="forecast";
 expect(run(mixed)).toMatchObject({value:null,reason:"incompatible_sources_or_runs"});
});
