import {afterEach,describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("../../lib/server/editorial-personal",()=>({personalEditions:vi.fn()}));
import {personalAccess} from "../../lib/personal-access";
import {GET} from "../../app/api/journal/personnel/route";
import {personalEditions} from "../../lib/server/editorial-personal";
import {previewEditions} from "../../lib/server/editorial-preview";
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
describe("personal draft access",()=>{
 it("fails closed without a configured or supplied credential",()=>{
  expect(personalAccess(new Headers(),"")).toBe(false);
  expect(personalAccess(new Headers(),"synthetic-only")).toBe(false);
 });
 it("accepts owner Basic auth or the existing automation header",()=>{
  expect(personalAccess(new Headers({authorization:"Basic "+Buffer.from("owner:synthetic-only").toString("base64")}),"synthetic-only")).toBe(true);
  expect(personalAccess(new Headers({"x-vercel-protection-bypass":"synthetic-only"}),"synthetic-only")).toBe(true);
  expect(personalAccess(new Headers({authorization:"Basic "+Buffer.from("other:synthetic-only").toString("base64")}),"synthetic-only")).toBe(false);
 });
 it("denies anonymous draft reads before consulting the private catalogue",async()=>{
  vi.stubEnv("VERCEL_AUTOMATION_BYPASS_SECRET","synthetic-only");
  expect((await GET(new Request("https://local/api/journal/personnel"))).status).toBe(401);
  expect(personalEditions).not.toHaveBeenCalled();
 });
 it("serves only an authenticated private response without public caching",async()=>{
  vi.stubEnv("VERCEL_AUTOMATION_BYPASS_SECRET","synthetic-only");
  vi.mocked(personalEditions).mockResolvedValue(previewEditions());
  const r=await GET(new Request("https://local/api/journal/personnel",{headers:{"x-vercel-protection-bypass":"synthetic-only"}}));
  expect(r.status).toBe(200);expect(r.headers.get("cache-control")).toBe("private, no-store");
  expect((await r.json()).edition_id).toBe(previewEditions()[0].edition_id);
 });
});
