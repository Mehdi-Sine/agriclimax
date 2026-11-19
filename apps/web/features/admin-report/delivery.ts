import "server-only";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { editorialRPC } from "../editorial-ai/supabase-store";
import { parisDate } from "../editorial/almanac";
import { parisClock } from "../nightly/snapshot";
import { checkJournal, journalOrigin } from "../nightly/journal-health";
import { THUMBNAIL_VERSION } from "../edition-maps/carousel-model";
import { buildReport, type Diagnostics, type Edition } from "./report";
import { renderReport } from "./render";
import { adminSmtp } from "./smtp";

type Outbox = {status:"new"|"sent"|"uncertain"};
const digest = /^[a-f0-9]{64}$/;
const imageLimit = 192*1024;
export function authorizedReport(authorization: string | null, secret = process.env.AGRICLIMAX_ADMIN_REPORT_TOKEN) {
  if (!secret || secret.length < 32 || !authorization) return false;
  const actual = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length===expected.length && timingSafeEqual(actual,expected);
}

async function cachedThumbnail(origin: URL, id: string, hero: string | null) {
  if(!hero || !digest.test(hero)) return null;
  const url = new URL("/api/journal/thumbnail",origin);
  url.search = new URLSearchParams({id,map:hero,v:THUMBNAIL_VERSION,cached:"1"}).toString();
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  try {
    const r = await fetch(url,{redirect:"error",signal:AbortSignal.timeout(2000),
      headers:bypass ? {"x-vercel-protection-bypass":bypass} : {}});
    if(!r.ok || r.headers.get("content-type")!=="image/webp") return null;
    const bytes = Buffer.from(await r.arrayBuffer());
    if(!bytes.length || bytes.length>imageLimit) return null;
    return {filename:"carte.webp",cid:"climacta-carte",content:bytes,contentType:"image/webp"};
  } catch { return null; }
}

export async function deliverReport(now = new Date()) {
  const { transport, sender, recipient } = adminSmtp();
  const date = parisDate(now.toISOString());
  const rpc = <T>(action: string, payload = {}) => editorialRPC<T>(`admin_report:${action}`,{edition_date:date,...payload});
  const outbox = await rpc<Outbox>("outbox");
  if (outbox.status === "sent") return "sent";
  if (outbox.status !== "new") throw Error("ADMIN_REPORT_RECONCILIATION_REQUIRED");

  const diagnostics = await rpc<Diagnostics>("diagnostics");
  const origin = journalOrigin();
  const deadline = parisClock(now) >= "07:30";
  const verified = !deadline && diagnostics.verified ? diagnostics.verified : await checkJournal(date);
  const identity = verified && digest.test(verified.id) && digest.test(verified.checksum) ? verified : null;
  const edition = identity ? await rpc<Edition|null>("edition",{id:identity.id,checksum:identity.checksum}) : null;
  if (!edition && !deadline) return "waiting";
  const thumbnail = edition && identity ? await cachedThumbnail(origin,identity.id,edition.hero) : null;
  const report = renderReport(buildReport(date,diagnostics,edition,origin.href,!!thumbnail));

  const claimId = randomUUID();
  const messageId = `<climacta-${date}-${claimId}@agriclimax.vercel.app>`;
  const claim = await rpc<{status:"claimed"|"sent"|"uncertain"}>("smtp_claim",{ claim_id: claimId });
  if (claim.status === "sent") return "sent";
  if (claim.status !== "claimed") throw Error("ADMIN_REPORT_RECONCILIATION_REQUIRED");

  // Once claimed, a crash or a missing final reply leaves the day blocked.
  try {
    const receipt = await transport.sendMail({
      from: { name: "Climacta", address: sender },
      to: recipient,
      messageId,
      ...report,
      ...(thumbnail ? { attachments: [thumbnail] } : {}),
    });
    if (receipt.accepted.length !== 1 || receipt.rejected.length !== 0) {
      throw Error("Unexpected SMTP recipient receipt");
    }
    await rpc("smtp_accept",{ claim_id: claimId });
  } catch {
    throw Error("ADMIN_REPORT_RECONCILIATION_REQUIRED");
  }
  return "sent";
}
