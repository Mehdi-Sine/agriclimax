import "server-only";
import {verifyDailySelection} from "../editorial-map-selection/daily";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import archiveSchema from "../../../../contracts/jsonschema/editorial-archive-1.schema.json";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  readdirSync,
  existsSync,
  rmSync,
  linkSync,
  openSync,
  fsyncSync,
  closeSync,
} from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { hash } from "../editorial/temporal";
import { assertBriefing } from "../editorial/validate";
import { assertDraft, validateDraft } from "./validate";
import type { Archive } from "./model";
export type RunState =
  | "not_started"
  | "reserved"
  | "running"
  | "completed"
  | "validation_failed"
  | "provider_error"
  | "outcome_unknown"
  | "budget_exceeded";
export interface Run {
  edition_date?: string;
  scope?: string;
  id: string;
  month: string;
  state: RunState;
  reserved_eur: number;
  actual_eur: number | null;
  error: string | null;
  archive_id: string | null;
}
type MaybePromise<T> = T | Promise<T>;
/** Shared generation boundary; network calls never hold a SQL transaction. */
export interface GenerationStore {
  lock(): MaybePromise<() => MaybePromise<void>>;
  readRun(id: string): MaybePromise<Run | null>;
  read(id: string): MaybePromise<Archive | null>;
  runs(): MaybePromise<Run[]>;
  writeRun(run: Run): MaybePromise<void>;
  diagnostic(id: string, value: unknown): MaybePromise<void>;
  save(archive: Archive): MaybePromise<void>;
  reserveAtomic?(run: Run): Promise<void>;
}
const ajv = new Ajv({ strict: true });
addFormats(ajv);
const archiveCheck = ajv.compile<Archive>(archiveSchema);
const validId = (s: string) => /^[a-f0-9]{64}$/.test(s);
/** Local/DEV filesystem store. One shared durable volume per batch; never serverless ephemeral storage for paid runs. */
function sync(path: string) {
  const fd = openSync(path, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
export class EditorialStore {
  constructor(readonly root: string) {
    mkdirSync(root, { recursive: true });
    for (const d of ["runs", "editions", "diagnostics"])
      mkdirSync(join(root, d), { recursive: true });
  }
  lock() {
    const p = join(this.root, "budget.lock");
    try {
      mkdirSync(p);
    } catch {
      throw Error("GENERATION_CONCURRENT_OR_UNRECONCILED");
    }
    return () => rmSync(p, { recursive: true });
  }
  diagnostic(id: string, value: unknown) {
    if (!validId(id)) throw Error("INVALID_ID");
    writeFileSync(
      join(this.root, "diagnostics", id + ".json"),
      JSON.stringify(value),
      { flag: "wx", mode: 0o600 },
    );
  }
  readRun(id: string): Run | null {
    if (!validId(id)) throw Error("INVALID_ID");
    const p = join(this.root, "runs", id + ".json");
    if (!existsSync(p)) return null;
    const r = JSON.parse(readFileSync(p, "utf8")) as Run;
    if (
      r.id !== id ||
      !/^\d{4}-\d{2}$/.test(r.month) ||
      !Number.isFinite(r.reserved_eur) ||
      r.reserved_eur < 0 ||
      (r.actual_eur !== null &&
        (!Number.isFinite(r.actual_eur) || r.actual_eur < 0)) ||
      ![
        "not_started",
        "reserved",
        "running",
        "completed",
        "validation_failed",
        "provider_error",
        "outcome_unknown",
        "budget_exceeded",
      ].includes(r.state)
    )
      throw Error("CORRUPT_FINANCIAL_LEDGER");
    return r;
  }
  writeRun(run: Run) {
    if (!validId(run.id)) throw Error("INVALID_ID");
    const p = join(this.root, "runs", run.id + ".json"),
      tmp = p + "." + randomUUID();
    writeFileSync(tmp, JSON.stringify(run), { mode: 0o600 });
    sync(tmp);
    renameSync(tmp, p);
    sync(join(this.root, "runs"));
  }
  runs(): Run[] {
    return readdirSync(join(this.root, "runs"))
      .filter((n) => /^[a-f0-9]{64}\.json$/.test(n))
      .map((n) => this.readRun(n.slice(0, 64))!);
  }
  save(archive: Archive) {
    verifyArchive(archive);
    const p = join(this.root, "editions", archive.edition_id + ".json");
    const bytes = JSON.stringify(archive);
    if (existsSync(p)) {
      if (readFileSync(p, "utf8") !== bytes)
        throw Error("IMMUTABLE_ARCHIVE_CONFLICT");
      return;
    }
    const tmp = p + "." + randomUUID();
    writeFileSync(tmp, bytes, { flag: "wx" });
    sync(tmp);
    try {
      linkSync(tmp, p);
      sync(join(this.root, "editions"));
    } finally {
      rmSync(tmp, { force: true });
    }
  }
  read(id: string): Archive | null {
    if (!validId(id)) throw Error("INVALID_ID");
    const p = join(this.root, "editions", id + ".json");
    if (!existsSync(p)) return null;
    const a = JSON.parse(readFileSync(p, "utf8")) as Archive;
    verifyArchive(a);
    return a;
  }
  list(): Archive[] {
    return readdirSync(join(this.root, "editions"))
      .filter((n) => /^[a-f0-9]{64}\.json$/.test(n))
      .map((n) => this.read(n.slice(0, 64))!)
      .sort((a, b) => b.date.localeCompare(a.date) || b.revision - a.revision);
  }
}
export function sealArchive(a: Omit<Archive, "checksum">): Archive {
  return { ...a, checksum: hash(a) };
}
export function verifyArchive(value: unknown,revalidate=true): asserts value is Archive {
  if (!archiveCheck(value)) throw Error("ARCHIVE_CONTRACT");
  const a = value;
  const { checksum, ...body } = a;
  if (
    a.version !== "editorial-archive-1" ||
    !validId(a.edition_id) ||
    hash(body) !== checksum ||
    a.date !== a.draft.edition_date ||
    a.date !== a.briefing.edition_date ||
    !Number.isInteger(a.revision) ||
    a.revision < 1
  )
    throw Error("ARCHIVE_INTEGRITY");
  if (
    a.mode === "live" &&
    (!a.receipt || a.receipt.model !== a.parameters.model)
  )
    throw Error("LIVE_ARCHIVE_MISSING_PROVIDER_RECEIPT");
  if(a.map_selection){
    const s=a.map_selection;
    if(s.version!=="edit04-1"||!validId(s.maps_sha256)||s.ranking.edition_date!==a.date||s.ranking.edition_id!==a.edition_id&&a.mode!=="fallback"||!["ai","deterministic"].includes(s.mode)||s.response.priority.length>1||s.response.complementary.length>5)throw Error("EDIT04_ARCHIVE_SELECTION");
    verifyDailySelection(s);
  }
  assertBriefing(a.briefing);
  assertDraft(a.draft);
  if (a.status === "published" || a.status === "approved")
    throw Error("T35_PUBLICATION_DISABLED");
  if (a.status !== a.validation.status && a.status !== "draft")
    throw Error("ARCHIVE_STATUS");
  const v = validateDraft(a.draft, a.briefing, a.illustrations);
  if (revalidate && (
    a.validation.status !== v.status ||
    JSON.stringify(a.validation.errors) !== JSON.stringify(v.errors)
  ))
    throw Error("ARCHIVE_VALIDATION");
  if (a.illustrations.some((i) => hash(i.data) !== i.sha256))
    throw Error("ARCHIVE_MAP_INTEGRITY");
}

/** Read-only archive catalogue: never creates directories or starts generation. */
export function readArchives(root: string): Archive[] {
  const dir = join(root, "editions");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => /^[a-f0-9]{64}\.json$/.test(n))
    .map((n) => {
      const value: unknown = JSON.parse(readFileSync(join(dir, n), "utf8"));
      verifyArchive(value);
      return value;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.revision - a.revision);
}
