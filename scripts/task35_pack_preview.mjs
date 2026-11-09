// Preserve exact JSON bytes: bundler JSON number rewriting must never alter scientific archives.
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
const files = ["forecast-edition.json", "simulated-edition.json"];
const manifest = {
  version: "editorial-preview-pack-1",
  archives: files.map((file) => {
    const raw = readFileSync(`docs/codex/task35/evidence/${file}`);
    return {
      file,
      sha256: createHash("sha256").update(raw).digest("hex"),
      bytes: raw.length,
      content: gzipSync(raw, { level: 9, mtime: 0 }).toString("base64"),
    };
  }),
};
writeFileSync(
  "apps/web/data/editorial/preview-archives.json",
  JSON.stringify(manifest) + "\n",
);
