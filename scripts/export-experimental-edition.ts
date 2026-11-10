/** Local archive-only projection. Never imports a provider or writes to Supabase. */
import {readFileSync,writeFileSync} from "node:fs";
import {gzipSync} from "node:zlib";
import {createHash} from "node:crypto";
import {consultableEdition,unpackConsultable} from "../apps/web/features/editorial-ai/consultable";
import type {Archive} from "../apps/web/features/editorial-ai/model";
const path="apps/web/data/editorial/consultable-bootstrap.json";
const source=process.argv[2];
if(!source)throw Error("Pass an exact archived JSON file; no generation is performed");
const a=consultableEdition(JSON.parse(readFileSync(source,"utf8")) as Archive);
const previous=unpackConsultable(JSON.parse(readFileSync(path,"utf8")));
const editions=[a,...previous.filter(p=>p.edition_id!==a.edition_id)].sort((a,b)=>b.date.localeCompare(a.date));
const raw=Buffer.from(JSON.stringify(editions));
writeFileSync(path,JSON.stringify({version:"consultable-archive-pack-1",bytes:raw.length,sha256:createHash("sha256").update(raw).digest("hex"),content:gzipSync(raw,{level:9}).toString("base64")})+"\n");
console.log(JSON.stringify({edition_id:a.edition_id,checksum:a.checksum,date:a.date,scientifically_validated:a.scientifically_validated,paid_calls:0}));
