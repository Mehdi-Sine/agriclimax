import {describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {providerSchema,openAIProvider,ProviderFailure,requestBody} from "../editorial-ai/provider";
import {auditSchema,rejectionReason} from "../editorial-ai/request-audit";
import {liveConfig} from "../editorial-ai/live-pricing";
import {readConfig,checkConfig} from "../editorial-ai/config";
describe("structured output wire boundary",()=>{
 it("normalizes untyped constants and enums without modifying the contract",()=>{
  const source={type:"object",properties:{version:{const:"v1"},kind:{enum:["fact","context"]}}};
  const wire=providerSchema(source);
  expect(wire).toEqual({type:"object",properties:{version:{type:"string",enum:["v1"]},kind:{type:"string",enum:["fact","context"]}}});
  expect(source.properties.version).toEqual({const:"v1"});
 });
 it("retains safe HTTP rejection metadata without the upstream message or a retry",async()=>{
  const fetcher=vi.fn().mockResolvedValue(Response.json({error:{type:"invalid_request_error",code:"invalid_json_schema",param:"text.format.schema",message:"synthetic-sensitive-value"}},{status:400,headers:{"x-request-id":"req_synthetic"}}));
  let error:unknown;try{await openAIProvider("synthetic-only",fetcher)("{}",readConfig());}catch(e){error=e;}
  expect(error).toBeInstanceOf(ProviderFailure);
  expect((error as ProviderFailure).diagnostic).toMatchObject({status:400,type:"invalid_request_error",code:"invalid_json_schema",param:"text.format.schema",request_id:"req_synthetic",reason:"UNCLASSIFIED_PROVIDER_REJECTION",schema_context:null});
  expect(JSON.stringify(error)).not.toContain("synthetic-sensitive-value");expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it("audits the whole actual strict contract and exact Terra envelope",()=>{
  const request=requestBody("PRIVATE_INPUT",liveConfig("gpt-6.1-terra",6000,new Date("2026-11-09T12:00:00Z")));
  expect(auditSchema(request.text.format.schema)).toMatchObject({objects:13,properties:62});
  expect(request).toMatchObject({model:"gpt-6.1-terra",store:false,max_output_tokens:6000,reasoning:{effort:"low"},service_tier:"default",prompt_cache_options:{mode:"explicit",ttl:"30m"},text:{format:{type:"json_schema",strict:true}}});
  expect(request).not.toHaveProperty("response_format");expect(request).not.toHaveProperty("temperature");expect(request).not.toHaveProperty("tools");
  const invalid=structuredClone(request.text.format.schema);invalid.required.pop();
  expect(()=>auditSchema(invalid)).toThrow("PROVIDER_SCHEMA_ALL_FIELDS_REQUIRED");
 });
 it("records correlation before sending and refuses transport if persistence fails",async()=>{
  const fetcher=vi.fn();const beforeRequest=vi.fn().mockRejectedValue(Error("PRIVATE_STORE_DOWN"));
  await expect(openAIProvider("synthetic-only",fetcher)("PRIVATE_INPUT",readConfig(),{beforeRequest})).rejects.toThrow("PRIVATE_STORE_DOWN");
  expect(fetcher).not.toHaveBeenCalled();expect(JSON.stringify(beforeRequest.mock.calls)).not.toContain("PRIVATE_INPUT");
 });
 it("rejects unsupported schemas and the documented minimum output-token violation before a trial",()=>{
  expect(()=>auditSchema({type:"object",properties:{value:{enum:["fact"]}},required:["value"],additionalProperties:false})).toThrow("PROVIDER_SCHEMA_TYPE_REQUIRED");
  expect(()=>auditSchema({type:"object",properties:{},required:[],additionalProperties:true})).toThrow("PROVIDER_SCHEMA_OBJECT_CONTRACT");
  const c=liveConfig("gpt-6.1-terra",16,new Date("2026-11-09T12:00:00Z"));
  expect(()=>checkConfig(c)).not.toThrow();expect(()=>checkConfig({...c,max_output_tokens:15})).toThrow("INVALID_AI_CONFIG");
 });
 it("correlates a known schema rejection and drops untrusted context and credentials",async()=>{
  const beforeRequest=vi.fn().mockResolvedValue(undefined);
  const fetcher=vi.fn().mockResolvedValue(Response.json({error:{message:"Invalid schema: In context=('properties', 'article', 'items'), 'type' is required. sk-synthetic",code:"invalid_json_schema",param:"text.format.schema"}},{status:400,headers:{"x-request-id":"req_synthetic"}}));
  let error:unknown;try{await openAIProvider("synthetic-only",fetcher)("PRIVATE_INPUT",readConfig(),{beforeRequest});}catch(e){error=e;}
  const diagnostic=(error as ProviderFailure).diagnostic!;
  expect(diagnostic.reason).toBe("SCHEMA_TYPE_REQUIRED");expect(diagnostic.schema_context).toEqual(["properties","article","items"]);
  expect(diagnostic.client_request_id).toBe(beforeRequest.mock.calls[0][0].client_request_id);
  expect(fetcher.mock.calls[0][1].headers["X-Client-Request-Id"]).toBe(diagnostic.client_request_id);
  expect(JSON.stringify(error)).not.toContain("sk-synthetic");
  expect(rejectionReason("In context=('properties', 'sk-private'), 'type' is required",requestBody("{}",readConfig()).text.format.schema).schema_context).toBeNull();
 });
});
