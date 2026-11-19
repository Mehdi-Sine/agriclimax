import "server-only";
import { timingSafeEqual } from "node:crypto";
import { editorialRPC } from "../editorial-ai/supabase-store";
import { parisDate } from "../editorial/almanac";
import { parisClock } from "../nightly/snapshot";
import { checkJournal, journalOrigin } from "../nightly/journal-health";
import { THUMBNAIL_VERSION } from "../edition-maps/carousel-model";
import { buildReport, type Diagnostics, type Edition } from "./report";
import { renderReport } from "./render";

type Outbox = {status:"new"|"sent"|"expired"} | {status:"reserved";message:string};
const digest = /^[a-f0-9]{64}$/;
const address = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
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
    return {filename:"carte.webp",content_id:"climacta-carte",content:bytes.toString("base64"),content_type:"image/webp"};
  } catch { return null; }
}

export async function deliverReport(now = new Date()) {
  const key = process.env.RESEND_API_KEY;
  const recipient = process.env.AGRICLIMAX_ADMIN_EMAIL?.trim();
  const sender = process.env.AGRICLIMAX_ADMIN_FROM?.trim();
  if(!key || !recipient || !sender || !address.test(recipient) || !address.test(sender))
    throw Error("ADMIN_REPORT_CONFIGURATION");
  const date = parisDate(now.toISOString());
  const rpc = <T>(action: string, payload = {}) => editorialRPC<T>(`admin_report:${action}`,{edition_date:date,...payload});
  let outbox = await rpc<Outbox>("outbox");
  if(outbox.status==="new") {
    const diagnostics = await rpc<Diagnostics>("diagnostics");
    const origin = journalOrigin();
    const deadline = parisClock(now)>="07:30";
    const verified = !deadline && diagnostics.verified ? diagnostics.verified : await checkJournal(date);
    const identity = verified && digest.test(verified.id) && digest.test(verified.checksum) ? verified : null;
    const edition = identity ? await rpc<Edition|null>("edition",{id:identity.id,checksum:identity.checksum}) : null;
    if(!edition && !deadline) return "waiting";
    const thumbnail = edition && identity ? await cachedThumbnail(origin,identity.id,edition.hero) : null;
    const report = renderReport(buildReport(date,diagnostics,edition,origin.href,!!thumbnail));
    const message = JSON.stringify({
      from:`Climacta <${sender}>`,to:[recipient],...report,
      ...(thumbnail ? {attachments:[thumbnail]} : {}),
    });
    outbox = await rpc<Outbox>("reserve",{message});
  }
  if(outbox.status==="sent") return "sent";
  if(outbox.status!=="reserved") throw Error("ADMIN_REPORT_RECONCILIATION_REQUIRED");
  const response = await fetch("https://api.resend.com/emails",{
    method:"POST",redirect:"error",signal:AbortSignal.timeout(8000),
    headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json","Idempotency-Key":`climacta/admin-report/${date}`},
    body:outbox.message,
  });
  if(response.status===409) {
    const error: {name?:string} | null = await response.json().catch(()=>null);
    // Another invocation owns the same provider request. The watchdog will
    // retry the frozen message if that invocation never stores its receipt.
    if(error?.name==="concurrent_idempotent_requests") return "waiting";
  }
  if(!response.ok) throw Error("ADMIN_REPORT_PROVIDER_FAILED");
  const result: {id?: unknown} = await response.json();
  if(typeof result.id!=="string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(result.id)) throw Error("ADMIN_REPORT_PROVIDER_RECEIPT");
  await rpc("accept",{provider_id:result.id});
  return "sent";
}
