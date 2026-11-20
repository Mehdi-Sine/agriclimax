import {createHash} from "node:crypto";
import {gunzipSync,gzipSync} from "node:zlib";
import {afterEach,expect,it,vi} from "vitest";
import {readFrozenMapInputs} from "../../../../scripts/edit04_frozen";
import {freezeSnapshot} from "./snapshot";
vi.mock("server-only",()=>({}));
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});

it("reads frozen inputs at the decoded size of the 20 November incident",async()=>{
 const minimal=Buffer.from(JSON.stringify({history:[],document:null}));
 const raw=Buffer.alloc(101_155_160,0x20);
 minimal.copy(raw);
 const bytes=gzipSync(raw);
 // The original reader failed during bounded inflation, before JSON.parse.
 expect(()=>gunzipSync(bytes,{maxOutputLength:96*1024**2})).toThrow(
  expect.objectContaining({name:"RangeError",code:"ERR_BUFFER_TOO_LARGE"}),
 );
 const sha256=createHash("sha256").update(bytes).digest("hex");
 const snapshot={...freezeSnapshot("2026-11-20",[],null,"2026-11-20T05:16:14.479Z"),
  input_archive:{path:`editorial-inputs/${sha256}.json.gz`,sha256,bytes:bytes.length}};
 vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://synthetic.supabase.co");
 vi.stubGlobal("fetch",vi.fn(async()=>new Response(bytes)));
 const restored=await readFrozenMapInputs(snapshot);
 expect(restored.bytes).toEqual(bytes);
 expect(restored.inputs).toEqual({history:[],document:null});
});
