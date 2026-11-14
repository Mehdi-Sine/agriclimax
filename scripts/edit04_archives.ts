import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {createHash} from "node:crypto";
import {readArchivedMaps,type ArchivedMaps} from "./edit03_archives";
import manifest from "../fixtures/editorial/edit04/manifest.json";
import {verifyArchive} from "../apps/web/features/editorial-ai/archive";
import {verifyBundle,verifyPublication} from "../apps/web/features/edition-maps/model";
export const DATES=["2026-11-12","2026-11-13","2026-11-14"] as const;
export function readEdit04Archive(date:typeof DATES[number]):ArchivedMaps {
 if(date!=="2026-11-14")return readArchivedMaps(date);
 const raw=readFileSync(new URL(`../fixtures/editorial/edit04/${manifest.file}`,import.meta.url));
 if(raw.length!==manifest.bytes||createHash("sha256").update(raw).digest("hex")!==manifest.sha256)throw Error("EDIT04_FIXTURE_INTEGRITY");
 const source=JSON.parse(gunzipSync(raw,{maxOutputLength:32*1024**2}).toString()) as ArchivedMaps;
 verifyArchive(source.archive,false);verifyBundle(source.bundle,source.archive);verifyPublication(source.publication,source.archive);
 if(source.archive.date!==date||source.archive.edition_id!==manifest.edition_id||source.archive.checksum!==manifest.edition_checksum||source.bundle.sha256!==manifest.bundle_sha256||source.publication.bundle.content_sha256!==source.bundle.sha256)throw Error("EDIT04_FIXTURE_BINDING");
 return source;
}
