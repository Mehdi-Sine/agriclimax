/** Shared preparation: nightly and isolated manual tests use identical selection/validation. */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { archiveInputs } from "../apps/web/features/nightly/immutable-inputs";
import { archiveCatalogue, nationalWeatherDocument, archivedEra5Day, type ArchivedDaily, type ArchiveEntry, type NationalWeatherDocument } from "../apps/web/lib/server/weather-archives";
import { nationalWatch } from "../apps/web/lib/server/national-watch";
import { buildEdition } from "../apps/web/features/journal/model";
import { adaptHistory, compareHistory, reconstructEpisodes, hash } from "../apps/web/features/editorial/temporal";
import { buildBriefing, briefingEvents, type BriefingInput, type NewsContext } from "../apps/web/features/editorial/briefing";
import { parisDate } from "../apps/web/features/editorial/almanac";
import { freezeSnapshot, verifySnapshot, cutoffUTC, selectCycles, modelFamily, POLICY, type Cycle } from "../apps/web/features/nightly/snapshot";
import { editorialRPC, publishedEditions } from "../apps/web/features/editorial-ai/supabase-store";
import { assessHistory, qualityLimitations } from "../apps/web/features/nightly/data-quality";
import geography from "../apps/web/data/operational/pra-watch-places.json";
import type { Archive } from "../apps/web/features/editorial-ai/model";
import type { Contribution } from "../apps/web/features/journal/registry";
export interface PreparationOptions {
 date:string; out:string; readOnly:boolean; testOnly?:boolean; persistInputs?:boolean; recover?:boolean; now?:string; newsPath?:string;
 extraWeather?:{entry:ArchiveEntry;document:NationalWeatherDocument}; extraHistory?:ArchivedDaily[]; contributions?:Contribution[]; calculate?:(rows:ArchivedDaily[],document:NationalWeatherDocument|null)=>Promise<Contribution[]>; phase?:(value:string)=>void;
}
export async function prepareDossier(options:PreparationOptions) {
 const {date,out}=options;
 const phase=(value:string)=>options.phase?.(value);
  const began=performance.now();
  const now = options.now??new Date().toISOString();
  const cutoff = options.recover&&parisDate(now)===date?now:cutoffUTC(date);
  phase("previous_editions");
  const previous:Archive[]=options.readOnly?[]:await publishedEditions();
  const prior=previous.filter(a=>a.date<date).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const previousTopicKeys=prior?.briefing.candidates.filter(c=>[prior.draft.main_candidate_id,...prior.draft.secondary_candidate_ids].includes(c.id)).map(c=>c.topic_key)??[];
  phase("catalogue");
  const catalogue = await archiveCatalogue();
  if(!catalogue) throw Error("NO_REAL_CATALOGUE");
  phase("history");
  const historyEntries = catalogue.era5.filter(e=>e.dates.some(d=>d<date));
  const dates = [...new Set(historyEntries.flatMap(e=>e.dates))].filter(d=>d<date).sort().slice(-60);
  const rows = [];
  for(const d of dates) {
    const e=historyEntries.find(e=>e.dates.includes(d));
    const daily=e?await archivedEra5Day(d,e):null;
    if(daily?.every(r=>Date.parse(r.computed_at)<=Date.parse(cutoff))) rows.push(...daily);
  }
  if(options.extraHistory) {
    const extra=options.extraHistory.filter(r=>r.valid_date<date&&Date.parse(r.computed_at)<=Date.parse(cutoff));
    const replaced=new Set(extra.map(r=>r.valid_date));
    for(let i=rows.length-1;i>=0;i--) if(replaced.has(rows[i].valid_date)) rows.splice(i,1);
    rows.push(...extra);
  }
  const historyCutoff = rows.map(r=>r.valid_date).sort().at(-1) ?? date;
  const history = adaptHistory(rows,geography.places,"nightly-era5-archive-1");
  const historyQuality = assessHistory(history,date);
  const comparisons = compareHistory(history,historyCutoff,geography.places);
  const episodes = reconstructEpisodes(history,historyCutoff);
  phase("acquisition_report");
  const report=options.readOnly ? {acquisitions:[]} : await editorialRPC<{acquisitions:{source:string;state:string;edition_date:string;checkpoint:{report?:NewsContext}}[]}>("report",{edition_date:date});
  phase("forecast");
  const candidates = [...(options.extraWeather?[options.extraWeather.entry]:[]),...catalogue.weather].sort((a,b)=>(b.run_at??b.run_date!).localeCompare(a.run_at??a.run_date!));
  let forecast: {doc: NonNullable<Awaited<ReturnType<typeof nationalWeatherDocument>>>; entry: typeof candidates[number]; cycles: Cycle[]} | undefined;
  // Bounded fallback search; every candidate is fully decoded by the existing scientific validator.
  for(const entry of candidates.slice(0,8)) {
    let doc;
    try { doc=options.extraWeather?.entry.sha256===entry.sha256?options.extraWeather.document:await nationalWeatherDocument(entry.run_at??entry.run_date,entry.sha256); }
    catch {
      writeFileSync(join(out,`quarantine-${entry.sha256}.json`),JSON.stringify({archive:entry,status:"quarantined",reason:"ARCHIVE_VALIDATION_FAILED"}));
      continue;
    }
    if(!doc || Date.parse(doc.acquired_at)>Date.parse(cutoff)) continue;
    const groups = new Map<string,Cycle>();
    for(const row of doc.selected_indices.map(i=>doc.rows[i]).filter(r=>r.nature==="forecast" && r.model_run_at && r.valid_date>=date)) {
      const key = row.model+row.model_run_at;
      let c = groups.get(key);
      if(!c) {
        c = {provider:row.source_id,model:row.model,emitted_at:row.model_run_at!,acquired_at:doc.acquired_at,
          valid_dates:[],variables:[],pra_count:713,quality:"qualified",continuity:true,
          archive:{path:entry.path,sha256:entry.sha256},source_version:entry.method_version!,
          support_qualification:["CORE-01","partial_and_unavailable_preserved"]};
        groups.set(key,c);
      }
      if(!c.valid_dates.includes(row.valid_date)) c.valid_dates.push(row.valid_date);
      if(!c.variables.includes(row.variable)) c.variables.push(row.variable);
    }
    const cycles = [...groups.values()].map(c=>({...c,valid_dates:c.valid_dates.sort(),variables:c.variables.sort()}));
    const selected = selectCycles(cycles,date,cutoff);
    if(selected.quality==="insufficient") continue;
    // Every selected forecast row used by existing detectors must remain within source-specific age limits.
    const usedRows=doc.selected_indices.map(i=>doc.rows[i]).filter(r=>r.valid_date>=date);
    if(usedRows.some(r=>{const family=modelFamily(r.model); return !family || !r.model_run_at ||
      Date.parse(cutoff)-Date.parse(r.model_run_at)>POLICY.max_age_hours[family]*3600000;})) continue;
    forecast={doc,entry,cycles};
    break;
  }
  const cycles=forecast?.cycles??[];
  const selected=selectCycles(cycles,date,cutoff);
  const edition=forecast?buildEdition(await nationalWatch(forecast.doc.run,forecast.doc),{now}):undefined;
    const archivedNews=report.acquisitions.find(a=>a.source==="news"&&a.edition_date===date)?.checkpoint.report;
    let news = options.newsPath ? JSON.parse(readFileSync(options.newsPath,"utf8")) as NewsContext : archivedNews;
    if(news && Date.parse(news.generated_at)>Date.parse(cutoff)) news=undefined;
    const base:BriefingInput={date,generated_at:now,history_cutoff:historyCutoff,
      source_fingerprint:options.extraHistory?hash([forecast?.entry??null,historyEntries,options.extraHistory.map(r=>[r.pra_id,r.valid_date,r.batch_key])]):hash([forecast?.entry??null,historyEntries]),history,comparisons,episodes,episode_archive_sha256:hash(episodes),edition,contributions:options.calculate?await options.calculate(rows,forecast?.doc??null):options.contributions,previous_topic_keys:previousTopicKeys};
    if(news) {
      const events=briefingEvents(base);
      const matched=spawnSync(process.env.PYTHON??"python",["scripts/task33_news_links.py"],{
        input:JSON.stringify({news,events:[...events.historical.map(({episodes,...e})=>{void episodes;return e;}),
          ...events.forecast.map(e=>({id:e.id,phenomenon:e.phenomenon,region:e.region,period:e.period,production_ids:e.production_ids,provenance:e.evidence_ids}))]}),
        encoding:"utf8",timeout:30000,maxBuffer:8*1024**2});
      if(matched.status===0) base.news={...news,links:JSON.parse(matched.stdout)};
      // Documentary failure is explicit, never a reason to invent a scientific confirmation.
    }
    phase("briefing");
    const briefing=buildBriefing(base);
    if(!base.news) briefing.limitations.push("Lot documentaire T34 indisponible ou non qualifié avant cutoff ; aucune confirmation documentaire ajoutée.");
    briefing.limitations.push(...cycles.map(c=>`Prévisions ${c.model} émises le ${c.emitted_at}, acquises le ${c.acquired_at}; validité ${c.valid_dates[0]}–${c.valid_dates.at(-1)}.`));
    if(selected.quality==="fallback_valid") briefing.limitations.push("Cycle antérieur encore valide : ne pas affirmer une évolution observée sans nouvelle observation comparable.");
    briefing.limitations.push(...qualityLimitations(historyQuality,!!forecast,report.acquisitions));
    briefing.bundle_id=hash({...briefing,bundle_id:undefined});
    // Immutable inputs retained alongside snapshot. Existing methods are reused without changing science.
    const inputs = {catalogue,document:forecast?.doc??null,quality:historyQuality,acquisitions:report.acquisitions,history:rows,episodes,comparisons,news:news??null,previous_edition:prior?{id:prior.edition_id,date:prior.date,checksum:prior.checksum}:null};
    if(options.persistInputs!==false)writeFileSync(join(out,"frozen-inputs.json"),JSON.stringify(inputs));
    phase("snapshot");
    const snapshot = freezeSnapshot(date,cycles,briefing,now,historyQuality,cutoff,options.testOnly);
    phase("input_archive");
    snapshot.input_archive = options.readOnly ? null : await archiveInputs(inputs);
    const {id: unused,...body}=snapshot; void unused;
    snapshot.id=hash(body);
    writeFileSync(join(out,"preparation-metrics.json"),JSON.stringify({date,snapshot_id:snapshot.id,
      quality:snapshot.quality,forecast_archive:forecast?.entry.sha256??null,history_rows:rows.length,
      facts:briefing.national.facts.length,elapsed_seconds:(performance.now()-began)/1000,
      rss_mib:process.memoryUsage().rss/1024**2,read_only:options.readOnly,openai_calls:0}));
    return {snapshot,inputs};
}
