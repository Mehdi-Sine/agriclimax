import {afterEach,describe,it,expect,vi} from "vitest";
import {renderToReadableStream} from "react-dom/server";
vi.mock("server-only",()=>({}));
vi.mock("next/headers",()=>({headers:async()=>new Headers({"x-vercel-protection-bypass":"synthetic-only"})}));
vi.mock("../../lib/server/editorial-personal",()=>({personalEditions:async()=>[],personalReviews:async()=>[],personalAttempts:async()=>[{id:"a".repeat(64),edition_date:"2026-11-09",month:"2026-11",state:"outcome_unknown",reserved_eur:.094549,actual_eur:null,error:"PROVIDER_HTTP_400",archive_id:"a".repeat(64)}]}));
import Page from "../../app/journal/personnel/page";
afterEach(()=>vi.unstubAllEnvs());
describe("personal failed attempt",()=>{
 it("shows the real failure state and project-managed spending without presenting fallback prose as AI",async()=>{
  vi.stubEnv("VERCEL_AUTOMATION_BYPASS_SECRET","synthetic-only");
  const stream=await renderToReadableStream(await Page({searchParams:Promise.resolve({date:"2026-11-09"})}));await stream.allReady;
  const html=await new Response(stream).text();
  expect(html).toContain("PROVIDER_HTTP_400");expect(html).toContain("gérées dans le projet OpenAI");
  expect(html).toContain("Aucune relance payante automatique");expect(html).not.toContain("Édition validée et archivée");
 });
});
