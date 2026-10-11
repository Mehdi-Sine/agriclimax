import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { mkdir, copyFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const packageRoot = dirname(require.resolve("maplibre-gl/package.json"));
const destination = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../public/maps/maplibre",
);
await mkdir(destination, { recursive: true });
// v6 module workers import a sibling shared module. Keep their version in sync
// with the locked package, with no CDN or runtime external dependency.
for (const filename of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  await copyFile(
    resolve(packageRoot, "dist", filename),
    resolve(destination, filename),
  );
}

await copyFile(resolve(packageRoot, "LICENSE.txt"), resolve(destination, "LICENSE.txt"));
