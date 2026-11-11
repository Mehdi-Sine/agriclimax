import type { HistoryQuality } from "./data-quality";
import { hash, shift } from "../editorial/temporal";
import { parisDate } from "../editorial/almanac";
import { assertBriefing } from "../editorial/validate";
import type { EditorialBriefingBundle } from "../editorial/briefing";
export type Quality = "fresh" | "fallback_valid" | "insufficient";
export interface Cycle {
  provider: string; model: string; emitted_at: string; acquired_at: string;
  valid_dates: string[]; variables: string[]; pra_count: number;
  quality: "qualified" | "quarantined"; continuity: boolean;
  archive: { path: string; sha256: string }; source_version: string;
  support_qualification: string[];
}
export function modelFamily(model: string): "arome" | "arpege" | "ifs" | null {
  return ({arome:"arome", "arome-0p025":"arome", arpege:"arpege", "arpege-0p1":"arpege", ifs:"ifs", "ifs-oper-0p25":"ifs"} as Record<string,"arome"|"arpege"|"ifs">)[model] ?? null;
}
export const POLICY = { version: "nightly-selection-1", max_age_hours: { arome: 36, arpege: 60, ifs: 72 } };
/** Calendar conversion uses IANA rules, including missing/repeated 02h slots. */
export function parisClock(now: Date) {
  return new Intl.DateTimeFormat("en-GB", {timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(now);
}
export function cutoffUTC(date: string) {
  // 05:40 exists exactly once on every Paris calendar day, including both DST transitions.
  const noon = new Date(`${date}T12:00:00Z`);
  const localHour = Number(parisClock(noon).slice(0,2));
  return new Date(Date.parse(`${date}T05:40:00Z`) - (localHour - 12)*3600000).toISOString();
}
export function selectCycles(cycles: Cycle[], date: string, cutoff: string, requiredDays = [date,shift(date,1)]) {
  const qualified=cycles.filter(c=>{
    const family=modelFamily(c.model);
    return family && c.quality === "qualified" && c.continuity && c.pra_count===713 &&
      /^[a-f0-9]{64}$/.test(c.archive.sha256) && c.source_version==="pra-national-weather-daily-1" &&
      c.support_qualification.includes("CORE-01") &&
      Number.isFinite(Date.parse(c.emitted_at)) && Number.isFinite(Date.parse(c.acquired_at)) &&
      Date.parse(c.acquired_at)<=Date.parse(cutoff) && Date.parse(c.emitted_at)<=Date.parse(cutoff) &&
      Date.parse(cutoff)-Date.parse(c.emitted_at)<=POLICY.max_age_hours[family]*3600000 &&
      ["temperature_min","temperature_max","precipitation"].every(v=>c.variables.includes(v));
  });
  const archives=[...new Set(qualified.map(c=>c.archive.sha256))].sort((a,b)=>
    Math.max(...qualified.filter(c=>c.archive.sha256===b).map(c=>Date.parse(c.emitted_at)))-
    Math.max(...qualified.filter(c=>c.archive.sha256===a).map(c=>Date.parse(c.emitted_at))));
  for(const archive of archives) {
    const sources=qualified.filter(c=>c.archive.sha256===archive);
    if(!requiredDays.every(d=>sources.some(c=>c.valid_dates.includes(d)))) continue;
    // Existing national daily selection explicitly moves from short to long horizon models.
    // Retain every actual model/run and its exact validity; no stitching between releases.
    const quality:Quality=sources.every(c=>parisDate(c.emitted_at)===date)?"fresh":"fallback_valid";
    return {sources,quality};
  }
  return {sources:[] as Cycle[],quality:"insufficient" as Quality};
}
export interface DailyEditorialSnapshot {
  version: "daily-editorial-snapshot-1"; id: string; edition_date: string;
  cutoff_at: string; frozen_at: string; quality: Quality; policy_version: string;
  input_archive: {path:string;sha256:string;bytes:number} | null;
  sources: Cycle[]; briefing: EditorialBriefingBundle | null;
  limitations: string[];
  data_quality?: HistoryQuality;
  input_cutoff_at?: string;
}
export function freezeSnapshot(date: string, cycles: Cycle[], briefing: EditorialBriefingBundle | null, now: string, historyQuality?: HistoryQuality, inputCutoff?:string): DailyEditorialSnapshot {
  const cutoff = cutoffUTC(date);
  if (parisDate(now)<date || Date.parse(now)<Date.parse(cutoff)) throw Error("FREEZE_BEFORE_CUTOFF");
  if (briefing) {
    assertBriefing(briefing);
    if(briefing.edition_date!==date || Date.parse(briefing.generated_at)>Date.parse(now)) throw Error("SNAPSHOT_BRIEFING_DATE");
  }
  if(inputCutoff&&(Date.parse(inputCutoff)<Date.parse(cutoff)||Date.parse(inputCutoff)>Date.parse(now))) throw Error("INPUT_CUTOFF_INVALID");
  const selection = selectCycles(cycles,date,inputCutoff??cutoff);
  const body: Omit<DailyEditorialSnapshot,"id"> = {
    version:"daily-editorial-snapshot-1",edition_date:date,cutoff_at:cutoff,frozen_at:now,
    quality:briefing && briefing.national.facts.length ? (selection.quality!=="insufficient"?selection.quality:historyQuality?.usable?"fallback_valid":"insufficient") : "insufficient",
    ...(historyQuality?{data_quality:historyQuality}:{}),
    ...(inputCutoff?{input_cutoff_at:inputCutoff}:{}),
    policy_version:POLICY.version,input_archive:null,sources:selection.sources,briefing,
    limitations:[...(briefing?.limitations??[]),...selection.sources.map(c=>`Prévisions issues du cycle ${c.model} du ${c.emitted_at}; validité ${c.valid_dates[0]}–${c.valid_dates.at(-1)}.`),
      ...(selection.quality==="fallback_valid"?["Cycle antérieur encore valide ; aucune évolution observée déduite d'une révision prévisionnelle."]:[])],
  };
  return {...body,id:hash(body)};
}
export function verifySnapshot(s: DailyEditorialSnapshot) {
  const { id, ...body } = s;
  if(hash(body)!==id || s.version!=="daily-editorial-snapshot-1" || s.cutoff_at!==cutoffUTC(s.edition_date)) throw Error("SNAPSHOT_INTEGRITY");
  if(s.input_cutoff_at&&(Date.parse(s.input_cutoff_at)<Date.parse(s.cutoff_at)||Date.parse(s.input_cutoff_at)>Date.parse(s.frozen_at))) throw Error("INPUT_CUTOFF_INVALID");
  if(s.briefing) assertBriefing(s.briefing);
}
