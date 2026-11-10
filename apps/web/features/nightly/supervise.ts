import "server-only";
import { editorialRPC } from "../editorial-ai/supabase-store";
import { parisDate } from "../editorial/almanac";
import { hash } from "../editorial/temporal";
import {operationalEditions} from "../../lib/server/editorial-published";
import type { Run } from "../editorial-ai/archive";
import type { DailyEditorialSnapshot } from "./snapshot";
export interface OperationalReport {
  acquisitions: {edition_date:string;source:string;state:string;attempts:number;updated_at:string;checkpoint:unknown}[];
  snapshots: DailyEditorialSnapshot[];
  runs: Run[];
  publications: {edition_date:string;archive_id:string;published_at:string}[];
  diagnostics: unknown[];
}
export async function supervise(editionDate?:string) {
  const now=new Date().toISOString(), date=editionDate??parisDate(now);
  const report=await editorialRPC<OperationalReport>("report",{edition_date:date});
  const today=report.snapshots.find(s=>s.edition_date===date);
  const publication=report.publications.find(p=>p.edition_date===date);
  const editions=await operationalEditions();
  const edition=editions.find(a=>a.date===date)??editions[0];
  const alerts:string[]=[],notices:string[]=[];
  if(!today) alerts.push("SNAPSHOT_MISSING");
  if(today?.quality==="insufficient") alerts.push("INSUFFICIENT_DATA");
  if(!edition) alerts.push("CONSULTABLE_EDITION_MISSING");
  else if(edition.date!==date) alerts.push("EDITION_DELAYED");
  if(edition&&(edition.validation.status!=="validated_automatically"||edition.assessment.status!=="validated_automatically")) notices.push("EXPERIMENTAL_SCIENTIFIC_RESERVATIONS");
  let pageStatus:"verified"|"unavailable"|"not_configured"="not_configured";
  const base=process.env.AGRICLIMAX_JOURNAL_HEALTH_URL||"https://agriclimax.vercel.app";
  if(base) {
    const url=new URL(base);
    if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash) throw Error("HEALTH_URL_ORIGIN");
    try {
      const headers:Record<string,string>={};
      const secret=process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
      if(secret) {
        headers["x-vercel-protection-bypass"]=secret;
      }
      const response=await fetch(new URL("/api/journal/availability",url),{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(10000),headers});
      const data:unknown=await response.json();
      if(data&&typeof data==="object"&&"storage" in data&&data.storage!=="shared_archive") notices.push("RETAINED_COPY_SHARED_ARCHIVE_NOT_REACHED");
      const page=await fetch(new URL("/journal",url),{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(10000),headers});
      const expected=edition;
      pageStatus=response.ok&&page.ok&&!!expected&&typeof data==="object"&&data!==null&&"checksum" in data&&data.checksum===expected.checksum?"verified":"unavailable";
    } catch {pageStatus="unavailable";}
  }
  if(pageStatus!=="verified") alerts.push("PAGE_"+pageStatus.toUpperCase());
  if(!edition&&report.runs.some(r=>r.state==="outcome_unknown")) alerts.push("OPENAI_ATTEMPT_FAILED");
  const result={observed_at:now,date,quality:today?.quality??"insufficient",sources:today?.sources??[],
    acquisitions:report.acquisitions.filter(a=>a.edition_date===date),
    generated:report.runs.filter(r=>r.edition_date===date),publication:publication??null,page_status:pageStatus,
    alerts,
    consultable_edition:edition?{id:edition.edition_id,date:edition.date,checksum:edition.checksum,scientific_status:edition.assessment.status,certified:false}:null,
    notices,previous_retained:edition?.date!==date,paid_calls:0};
  await editorialRPC("diagnostic",{edition_date:date,id:hash([date,now.slice(0,16),"service-verdict"]),body:result});
  return result;
}
