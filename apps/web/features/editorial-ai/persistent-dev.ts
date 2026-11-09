import "server-only";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  realpathSync,
  statfsSync,
  openSync,
  fsyncSync,
  closeSync,
  readdirSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { EditorialStore } from "./archive";
export const DEV_ROOT = "/var/lib/agriclimax-ai/store";
export const DEV_ANCHOR = "/var/lib/agriclimax-ai/anchor.json";
export interface HostFacts {
  platform: string;
  ci: boolean;
  fs_type: number;
  anchor_fs_type?: number;
  root_real: string;
  anchor_parent_real: string;
}
export function assertPersistentHost(f: HostFacts) {
  if (f.ci) throw Error("EPHEMERAL_CI_GENERATION_DISABLED");
  if (
    f.platform !== "linux" ||
    ![0xef53, 0x58465342, 0x9123683e].includes(f.fs_type >>> 0) ||
    ![0xef53, 0x58465342, 0x9123683e].includes(
      (f.anchor_fs_type ?? f.fs_type) >>> 0,
    )
  )
    throw Error("UNQUALIFIED_FILESYSTEM");
  if (f.root_real !== DEV_ROOT || f.anchor_parent_real !== dirname(DEV_ANCHOR))
    throw Error("PERSISTENT_PATH_OR_SYMLINK_MISMATCH");
}
function observe(): HostFacts {
  const parent = dirname(DEV_ANCHOR);
  if (!existsSync(parent))
    throw Error("PERSISTENT_DEV_DIRECTORY_NOT_PROVISIONED");
  return {
    platform: process.platform,
    ci: process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true",
    fs_type: Number(statfsSync(existsSync(DEV_ROOT) ? DEV_ROOT : parent).type),
    anchor_fs_type: Number(statfsSync(parent).type),
    root_real: existsSync(DEV_ROOT)
      ? realpathSync(DEV_ROOT)
      : resolve(DEV_ROOT),
    anchor_parent_real: realpathSync(parent),
  };
}
function immutable(path: string, value: unknown) {
  writeFileSync(path, JSON.stringify(value), { flag: "wx", mode: 0o600 });
  for (const p of [path, dirname(path)]) {
    const fd = openSync(p, "r");
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  }
}
export function initializePersistentDev() {
  if (process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true")
    throw Error("EPHEMERAL_CI_GENERATION_DISABLED");
  // The owner provisions /var/lib/agriclimax-ai on a persistent disk first.
  assertPersistentHost(observe());
  if (
    existsSync(DEV_ANCHOR) ||
    existsSync(join(DEV_ROOT, "store-identity.json"))
  )
    throw Error("PERSISTENT_STORE_ALREADY_INITIALIZED");
  if (existsSync(DEV_ROOT) && readdirSync(DEV_ROOT).length)
    throw Error("PERSISTENT_STORE_NOT_EMPTY");
  mkdirSync(DEV_ROOT, { recursive: true, mode: 0o700 });
  const identity = {
    version: "editorial-persistent-dev-1",
    store_id: randomUUID(),
    root: DEV_ROOT,
    created_at: new Date().toISOString(),
  };
  // Anchor first: interruption must fail closed, never recreate an apparently empty ledger.
  immutable(DEV_ANCHOR, identity);
  new EditorialStore(DEV_ROOT);
  immutable(join(DEV_ROOT, "store-identity.json"), identity);
  return identity;
}
export function openPersistentDev() {
  if (process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true")
    throw Error("EPHEMERAL_CI_GENERATION_DISABLED");
  assertPersistentHost(observe());
  if (
    !existsSync(DEV_ANCHOR) ||
    !existsSync(join(DEV_ROOT, "store-identity.json"))
  )
    throw Error("PERSISTENT_STORE_NOT_INITIALIZED");
  if (realpathSync(DEV_ANCHOR) !== DEV_ANCHOR)
    throw Error("PERSISTENT_PATH_OR_SYMLINK_MISMATCH");
  const a: unknown = JSON.parse(readFileSync(DEV_ANCHOR, "utf8")),
    b: unknown = JSON.parse(
      readFileSync(join(DEV_ROOT, "store-identity.json"), "utf8"),
    );
  if (
    !a ||
    typeof a !== "object" ||
    !("version" in a) ||
    a.version !== "editorial-persistent-dev-1" ||
    JSON.stringify(a) !== JSON.stringify(b) ||
    !("root" in a) ||
    a.root !== DEV_ROOT ||
    !("store_id" in a) ||
    typeof a.store_id !== "string" ||
    !/^[a-f0-9-]{36}$/.test(a.store_id)
  )
    throw Error("PERSISTENT_ANCHOR_MISMATCH");
  for (const dir of ["runs", "editions", "diagnostics"]) {
    if (
      !existsSync(join(DEV_ROOT, dir)) ||
      realpathSync(join(DEV_ROOT, dir)) !== join(DEV_ROOT, dir)
    )
      throw Error("PERSISTENT_LEDGER_INCOMPLETE");
  }
  return new EditorialStore(DEV_ROOT);
}
