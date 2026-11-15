import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {createHash} from "node:crypto";
import manifest from "../fixtures/editorial/edit04b/manifest.json";
import {verifyArchive} from "../apps/web/features/editorial-ai/archive";
import {verifyBundle,verifyPublication,type EditionMapBundle,type MapPublication} from "../apps/web/features/edition-maps/model";
import type {Archive} from "../apps/web/features/editorial-ai/model";
import type {ProviderResult} from "../apps/web/features/editorial-ai/provider";
export function readNovember15(){
 const bytes=readFileSync(new URL(`../fixtures/editorial/edit04b/${manifest.file}`,import.meta.url));
 if(bytes.length!==manifest.bytes||createHash("sha256").update(bytes).digest("hex")!==manifest.sha256)throw Error("EDIT04B_FIXTURE_INTEGRITY");
 const source=JSON.parse(gunzipSync(bytes,{maxOutputLength:32*1024**2}).toString()) as {archive:Archive;bundle:EditionMapBundle;publication:MapPublication;rejected:Archive;response:ProviderResult};
 verifyArchive(source.archive,false);verifyArchive(source.rejected,false);verifyBundle(source.bundle,source.archive);verifyPublication(source.publication,source.archive);
 if(source.archive.checksum!==manifest.archive_checksum||source.rejected.checksum!==manifest.rejected_checksum||source.bundle.sha256!==manifest.bundle_sha256||source.rejected.date!=="2026-11-15"||source.archive.supersedes!==source.rejected.edition_id)throw Error("EDIT04B_FIXTURE_BINDING");
 return source;
}
