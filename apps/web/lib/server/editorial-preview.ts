import "server-only";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import manifest from "../../data/editorial/preview-archives.json";
import {
  readArchives,
  verifyArchive,
} from "../../features/editorial-ai/archive";
import type { Archive } from "../../features/editorial-ai/model";
let cache: Archive[] | undefined;
// Explicit frozen manifest, exact byte decoding. No provider/generator in any read path.
export function previewEditions(): Archive[] {
  const local = process.env.AGRICLIMAX_AI_PREVIEW_ARCHIVE_DIR;
  if (local) return readArchives(local).filter((a) => a.status !== "rejected");
  if (!cache) {
    if (manifest.version !== "editorial-preview-pack-1")
      throw Error("PREVIEW_PACK_VERSION");
    cache = manifest.archives.map((entry) => {
      const raw = gunzipSync(Buffer.from(entry.content, "base64"), {
        maxOutputLength: 2 * 1024 ** 2,
      });
      if (
        raw.length !== entry.bytes ||
        createHash("sha256").update(raw).digest("hex") !== entry.sha256
      )
        throw Error("PREVIEW_PACK_INTEGRITY");
      const archive: unknown = JSON.parse(raw.toString());
      verifyArchive(archive);
      return archive;
    });
  }
  return cache;
}
export function previewEdition(date?: string, id?: string) {
  return previewEditions().find(
    (a) => (!date || a.date === date) && (!id || a.edition_id === id),
  );
}
