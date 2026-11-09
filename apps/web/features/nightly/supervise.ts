import "server-only";
import { editorialRPC, SupabaseEditorialStore } from "../editorial-ai/supabase-store";
import { parisDate } from "../editorial/almanac";
import { hash } from "../editorial/temporal";
import type { Run } from "../editorial-ai/archive";
import type { DailyEditorialSnapshot } from "./snapshot";
export interface OperationalReport {
  acquisitions: {edition_date:string;source:string;state:string;attempts:number;updated_at:string;checkpoint:unknown}[];
  snapshots: DailyEditorialSnapshot[];
  runs: Run[];
  publications: {edition_date:string;archive_id:string;published_at:string}[];
  diagnostics: unknown[];
}
export async function supervise() {
  const now=new Date().toISOString(), date=parisDate(now);
  const report=await editorialRPC<OperationalReport>("report",{edition_date:date});
  const allRuns=await editorialRPC<Run[]>("runs");
  const today=report.snapshots.find(s=>s.edition_date===date);
  const publication=report.publications.find(p=>p.edition_date===date);
  const alerts:string[]=[];
  if(!today) alerts.push("SNAPSHOT_MISSING");
  if(today?.quality==="insufficient") alerts.push("INSUFFICIENT_DATA");
  if(!publication) alerts.push("EDITION_MISSING");
  const archive=publication?await new SupabaseEditorialStore(today?.id??"").read(publication.archive_id):null;
  if(publication&&!archive) alerts.push("ARCHIVE_MISSING");
  let pageStatus:"verified"|"unavailable"|"not_configured"="not_configured";
  const base=process.env.AGRICLIMAX_JOURNAL_HEALTH_URL;
  if(base) {
    const url=new URL(base);
    if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash) throw Error("HEALTH_URL_ORIGIN");
    try {
      const headers:Record<string,string>={};
      if(process.env.VERCEL_AUTOMATION_BYPASS_SECRET) headers["x-vercel-protection-bypass"]=process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
      const response=await fetch(new URL("/api/journal/availability",url),{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(10000),headers});
      const data:unknown=await response.json();
      const page=await fetch(new URL("/journal",url),{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(10000),headers});
      pageStatus=response.ok&&page.ok&&!!archive&&typeof data==="object"&&data!==null&&"checksum" in data&&data.checksum===archive.checksum?"verified":"unavailable";
    } catch {pageStatus="unavailable";}
  }
  if(pageStatus!=="verified") alerts.push("PAGE_"+pageStatus.toUpperCase());
  if(report.runs.some(r=>r.state==="outcome_unknown")) alerts.push("OPENAI_RECONCILIATION_REQUIRED");
  const result={observed_at:now,date,quality:today?.quality??"insufficient",sources:today?.sources??[],
    acquisitions:report.acquisitions.filter(a=>a.edition_date===date),
    generated:report.runs.filter(r=>r.edition_date===date),publication:publication??null,page_status:pageStatus,
    accounted_month_eur:allRuns.filter(r=>r.month===now.slice(0,7)).reduce((s,r)=>s+(r.actual_eur??r.reserved_eur),0),alerts,
    previous_retained:!publication,paid_calls:0};
  await editorialRPC("diagnostic",{edition_date:date,id:hash([date,now.slice(0,16),"service-verdict"]),body:result});
  return result;
}
