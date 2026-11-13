import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {createHash} from "node:crypto";
import {verifyArchive} from "../apps/web/features/editorial-ai/archive";
import type {Archive} from "../apps/web/features/editorial-ai/model";
import {verifyBundle,verifyPublication,type EditionMapBundle,type MapPublication} from "../apps/web/features/edition-maps/model";
import manifest from "../fixtures/editorial/edit03/manifest.json";
export const DATES=["2026-11-12","2026-11-13"] as const;
export type ArchivedMaps={archive:Archive;bundle:EditionMapBundle;publication:MapPublication};
export function readArchivedMaps(date:typeof DATES[number]):ArchivedMaps {
  const entry=manifest.dates[date],bytes=readFileSync(new URL(`../fixtures/editorial/edit03/${entry.file}`,import.meta.url));
  if(bytes.length!==entry.bytes||createHash("sha256").update(bytes).digest("hex")!==entry.sha256)throw Error("EDIT03_FIXTURE_INTEGRITY");
  const v=JSON.parse(gunzipSync(bytes,{maxOutputLength:32*1024**2}).toString()) as ArchivedMaps;
  verifyArchive(v.archive,false);verifyBundle(v.bundle,v.archive);verifyPublication(v.publication,v.archive);
  if(v.archive.date!==date||v.archive.edition_id!==entry.edition_id||v.archive.checksum!==entry.edition_checksum||v.bundle.sha256!==entry.bundle_sha256||v.bundle.snapshot_id!==entry.snapshot_id||v.publication.bundle.content_sha256!==v.bundle.sha256)throw Error("EDIT03_FIXTURE_BINDING");
  return v;
}
