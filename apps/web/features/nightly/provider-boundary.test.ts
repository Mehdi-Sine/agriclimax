import {describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {providerSchema,openAIProvider,ProviderFailure} from "../editorial-ai/provider";
import {readConfig} from "../editorial-ai/config";
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
  expect((error as ProviderFailure).diagnostic).toEqual({status:400,type:"invalid_request_error",code:"invalid_json_schema",param:"text.format.schema",request_id:"req_synthetic"});
  expect(JSON.stringify(error)).not.toContain("synthetic-sensitive-value");expect(fetcher).toHaveBeenCalledTimes(1);
 });
});
