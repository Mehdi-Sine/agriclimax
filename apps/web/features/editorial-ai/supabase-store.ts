import "server-only";
import { verifyArchive, type GenerationStore, type Run } from "./archive";
import type { Archive } from "./model";
import { hash } from "../editorial/temporal";
/** Server-only, bounded RPC. Modern secret keys belong in apikey, never in a bearer JWT. */
export async function editorialRPC<T>(action: string, payload: unknown = {}): Promise<T> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!base || !key) throw Error("EDITORIAL_STORE_NOT_CONFIGURED");
  const url = new URL(base);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash)
    throw Error("EDITORIAL_STORE_ORIGIN");
  url.pathname = "/rest/v1/rpc/"+(["attempt_claim","attempt_write"].includes(action)?"agriclimax_editorial_attempt":"agriclimax_editorial");
  const response = await fetch(url, { method: "POST", redirect: "error", cache: "no-store",
    signal: AbortSignal.timeout(12000), headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ p_action: action, p_payload: payload }) });
  if (!response.ok) throw Error("EDITORIAL_RPC_FAILED");
  const raw = await response.text();
  if (Buffer.byteLength(raw) > 16 * 1024 ** 2) throw Error("EDITORIAL_RESPONSE_BUDGET");
  const value:unknown=JSON.parse(raw);
  // JSONB changes object key order. Immutable documents are transported as exact JSON text.
  if(["snapshot_read","freeze","archive_read","archive_save"].includes(action))
    return (typeof value==="string"?JSON.parse(value):value) as T;
  if(["published","private_editions"].includes(action) && Array.isArray(value))
    return value.map(v=>typeof v==="string"?JSON.parse(v):v) as T;
  return value as T;
}
export class SupabaseEditorialStore implements GenerationStore {
  constructor(readonly snapshotId: string) {}
  // The reservation RPC is the lock authority. No SQL transaction survives its response.
  lock() { return () => {}; }
  async readRun(id: string) { return editorialRPC<Run | null>("run_read", { id }); }
  async runs() { return editorialRPC<Run[]>("runs"); }
  async claimAttempt(run:Run,manualRetry:boolean) {return editorialRPC<Run>("attempt_claim",{edition_date:run.edition_date,snapshot_id:this.snapshotId,run,manual_retry:manualRetry});}
  async finishAttempt(run:Run) {await editorialRPC("attempt_write",{run});}
  async reserveAtomic(run: Run) {
    await editorialRPC("reserve", { id: run.id, edition_date: run.edition_date, snapshot_id: this.snapshotId, run });
  }
  async writeRun(run: Run) { await editorialRPC("run_write", { id: run.id, run }); }
  async diagnostic(id: string, value: unknown) {
    await editorialRPC("diagnostic", { id: hash([id, value]), body: value });
  }
  async save(archive: Archive) {
    verifyArchive(archive);
    await editorialRPC("archive_save", { id: archive.edition_id, archive, archive_json:JSON.stringify(archive) });
    const restored = await this.read(archive.edition_id);
    if (!restored || restored.checksum !== archive.checksum) throw Error("ARCHIVE_READBACK_FAILED");
  }
  async read(id: string) {
    const a = await editorialRPC<Archive | null>("archive_read", { id });
    if (a) verifyArchive(a);
    return a;
  }
}
export async function publishedEditions(): Promise<Archive[]> {
  const editions = await editorialRPC<Archive[]>("published");
  editions.forEach(verifyArchive);
  return editions;
}
export async function promoteEdition(id: string) {
  const a = await new SupabaseEditorialStore("").read(id);
  if (!a || a.mode !== "live" || !["validated_automatically","needs_editorial_review"].includes(a.status)) throw Error("PUBLICATION_REJECTED");
  if (a.illustrations.some(i => !a.briefing.national.facts.some(f => i.evidence_ids.includes(f.id)) ||
    !a.briefing.national.facts.filter(f => i.evidence_ids.includes(f.id)).every(f => f.period[0] >= i.period[0] && f.period[1] <= i.period[1])))
    throw Error("PUBLICATION_MAP_BINDING");
  return editorialRPC("promote", { id, checksum: a.checksum });
}
