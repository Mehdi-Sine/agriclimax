// Local transport fixtures: PostgreSQL JSONB reorders keys; exact JSON text preserves T35 hashes.
import {afterEach,describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {previewEditions} from "../../lib/server/editorial-preview";
import {verifyArchive} from "../editorial-ai/archive";
import {editorialRPC,SupabaseEditorialStore,publishedEditions} from "../editorial-ai/supabase-store";
import {freezeSnapshot,verifySnapshot} from "./snapshot";
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
function transport(value:unknown) {
 vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://synthetic.supabase.co");
 vi.stubEnv("SUPABASE_SECRET_KEY","synthetic-test-only");
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json(value)));
}
describe("immutable JSON across JSONB",()=>{
 it("restores exact archive bytes rather than reordered JSONB",async()=>{
  const archive=previewEditions()[0];
  const reordered=Object.fromEntries(Object.entries(archive).sort(([a],[b])=>a.localeCompare(b)));
  expect(()=>verifyArchive(reordered)).toThrow("ARCHIVE_INTEGRITY");
  transport(JSON.stringify(archive));
  const restored=await new SupabaseEditorialStore("").read(archive.edition_id);
  expect(JSON.stringify(restored)).toBe(JSON.stringify(archive));
 });
 it("decodes a published catalogue of exact archive texts",async()=>{
  const archives=previewEditions();transport(archives.map(a=>JSON.stringify(a)));
  expect(await publishedEditions()).toEqual(archives);
 });
 it("preserves a frozen snapshot fingerprint after SQL transport",async()=>{
  const s=freezeSnapshot("2026-11-09",[],null,"2026-11-09T05:00:00Z");
  transport(JSON.stringify(s));
  const restored=await editorialRPC<typeof s>("snapshot_read");
  expect(()=>verifySnapshot(restored)).not.toThrow();
  expect(restored.id).toBe(s.id);
 });
});
