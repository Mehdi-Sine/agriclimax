import {describe,it,expect} from "vitest";
import {spawnSync} from "node:child_process";
import Ajv2020 from "ajv/dist/2020";
import agroSchema from "../../../../contracts/jsonschema/agroclimatic-1.schema.json";
import schema from "../../../../contracts/jsonschema/climate-coverage-1.schema.json";
import {qualifyCoverage, type CoverageEvidence, type Family} from "./policy";
import {calculateQualified} from "./calculate";
import {RULES} from "../agroclimatic/catalogue";
const evidence:CoverageEvidence={fraction:1,support_id:"synthetic",mask:"native_valid_cells",represented_area_m2:null,expected_days:1,available_days:1,continuous:true,homogeneous:true,method:"synthetic-1",estimate_certificate:null,reference_compatible:false};
describe("CORE-01 scientific boundaries and cross-language contract",()=>{
 it("keeps the additive embedded schema aligned with its canonical shared contract",()=>{const {$id,$schema,...canonical}=schema;void $id;void $schema;expect(agroSchema.properties.data.items.properties.quality).toEqual(canonical);});
 it("requires a certificate in addition to 90%, and never extends events or sequences",()=>{
  for(const family of ["mean_sum","extreme_event","sequence"] as Family[]){
   expect(qualifyCoverage(0,family,{...evidence,fraction:.95}).state).toBe("observed_partial");
   expect(qualifyCoverage(0,family,{...evidence,fraction:.95}).journal_eligible).toBe(false);
  }
  expect(qualifyCoverage(0,"mean_sum",{...evidence,fraction:.95,estimate_certificate:"synthetic-only"},{"synthetic-only":{method:"synthetic-1",support_ids:["synthetic"],evidence_ids:["synthetic-test-only"]}}).state).toBe("qualified_estimate");
  expect(qualifyCoverage(0,"extreme_event",{...evidence,fraction:.95,estimate_certificate:"synthetic-only"}).state).toBe("observed_partial");
  expect(qualifyCoverage(0,"normal_anomaly",evidence).indicator_eligible).toBe(false);
 });
 it("matches Python and validates all decision states with the JSON schema",()=>{
  const validate=new Ajv2020().compile(schema);
  const cases=[];
  for(const value of [null,0,20])for(const family of ["mean_sum","extreme_event","sequence","normal_anomaly","specific"] as Family[])for(const patch of [{},{fraction:0},{fraction:.89},{fraction:.9},{fraction:.95,estimate_certificate:"synthetic"},{fraction:.95,mask:"geometric_proxy" as const,estimate_certificate:"synthetic"},{support_id:null},{available_days:0},{homogeneous:false}]){
   const e={...evidence,...patch},actual=qualifyCoverage(value,family,e);
   expect(validate(actual),JSON.stringify(validate.errors)).toBe(true);
   cases.push({value,family,e,actual});
  }
  const py=spawnSync("python",["-c","import json,sys; from agriclimax.coverage import qualify_coverage; print(json.dumps([qualify_coverage(c['value'], c['family'], c['e']) for c in json.load(sys.stdin)]))"],{input:JSON.stringify(cases),encoding:"utf8",env:{...process.env,PYTHONPATH:"../../engine/src"}});
  expect(py.status,py.stderr).toBe(0);expect(JSON.parse(py.stdout)).toEqual(cases.map(c=>c.actual));
 });
 it("rejects support breaks, temporal gaps and missing THI humidity without inventing zero",()=>{
  const row={pra:"synthetic",date:"2026-01-01",values:{temperature:0},complete:true,compatible:true,source:"synthetic",run:null,nature:"reanalysis",freshness:"synthetic",provenance:["synthetic"],quality_flags:[],climate_support:{id:"synthetic",fraction:.95,temporal_complete:true,mask:"native_valid_cells" as const,method:"synthetic"}};
  const rule=RULES.find(r=>r.id==='temperature_mean')!;
  const zero=calculateQualified(row.pra,[row],row.date,row.date,rule,null);
  expect(zero.observed_value).toBe(0);expect(zero.series[0].support_id).toBe("synthetic");
  expect(calculateQualified(row.pra,[{...row,nature:"analysis"}],row.date,row.date,rule,null).observed_value).toBe(0);
  const gap=calculateQualified(row.pra,[row],row.date,"2026-01-02",rule,null);expect(gap.value).toBeNull();expect(gap.observed_value).toBeNull();
  expect(calculateQualified(row.pra,[row,{...row,date:"2026-01-02",climate_support:{...row.climate_support,id:"other"}}],row.date,"2026-01-02",rule,null).observed_value).toBeNull();
  expect(calculateQualified(row.pra,[row],row.date,row.date,RULES.find(r=>r.id==='thi')!,null).value).toBeNull();
 });
});
