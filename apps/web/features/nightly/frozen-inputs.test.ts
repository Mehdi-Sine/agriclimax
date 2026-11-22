import {createCipheriv,createHash} from "node:crypto";
import {gunzipSync,gzipSync} from "node:zlib";
import {afterEach,expect,it,vi} from "vitest";
import {readFrozenMapInputs} from "../../../../scripts/edit04_frozen";
import {freezeSnapshot} from "./snapshot";
import {encodeFrozenInputs,FROZEN_INPUT_COMPRESSED_LIMIT,validateFrozenInputBudget} from "./immutable-inputs";
import {FROZEN_SOURCE_VERSION,frozenSourcePins,pinEra5Day} from "./frozen-source-pins";
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

it("reports a compressed input overflow and keeps the same source in a bounded manifest",()=>{
 const cipher=createCipheriv("aes-128-ctr",Buffer.alloc(16),Buffer.alloc(16));
 const payload=cipher.update(Buffer.alloc(9*1024**2)).toString("base64");
 const oversized=encodeFrozenInputs({history:[{provenance:payload}],document:null});
 expect(oversized.metrics).toMatchObject({exceeded:"compressed",compressed_limit:FROZEN_INPUT_COMPRESSED_LIMIT});
 expect(oversized.metrics.compressed_bytes).toBeGreaterThan(FROZEN_INPUT_COMPRESSED_LIMIT);
 const error=vi.spyOn(console,"error").mockImplementation(()=>{});
 try{
  expect(()=>validateFrozenInputBudget(oversized)).toThrow("INPUT_ARCHIVE_BUDGET");
  expect(JSON.parse(error.mock.calls[0][0])).toEqual({error:"INPUT_ARCHIVE_BUDGET",...oversized.metrics});
 }finally{error.mockRestore();}
 const sha256=createHash("sha256").update(payload).digest("hex");
 const archive={path:`era5/${sha256}.json.gz`,sha256,bytes:2*1024**2,dates:["2026-11-14","2026-11-15"]};
 const pins=new Map();
 for(const date of archive.dates)pinEra5Day(pins,date,archive);
 const sources={era5:[...pins.values()],weather:null};
 const manifest={version:FROZEN_SOURCE_VERSION,sources};
 const compact=encodeFrozenInputs(manifest);
 expect(validateFrozenInputBudget(compact).length).toBeLessThan(300);
 expect(encodeFrozenInputs(manifest).bytes).toEqual(compact.bytes);
 expect(frozenSourcePins(sources,"2026-11-15")).toEqual(sources);
 expect(()=>frozenSourcePins(sources,"2026-11-14")).toThrow("MAP_ERA5_DATES");
 expect(()=>frozenSourcePins({...sources,era5:[sources.era5[0],sources.era5[0]]},"2026-11-15")).toThrow("MAP_ERA5_PINS");
});
