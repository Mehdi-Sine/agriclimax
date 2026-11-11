import type { DailyEvidence } from "../editorial/temporal";
import { shift } from "../editorial/temporal";
/** National fallback policy, separate from the native per-variable scientific rules. */
export const DATA_POLICY = {version:"journal-data-quality-1",max_reanalysis_age_days:10,min_complete_pra:571,total_pra:713} as const;
export interface HistoryQuality {
  policy_version:string; nature:"reanalysis"; reference_date:string|null; age_days:number|null;
  complete_pra:number; total_pra:713; usable:boolean; freshness:"fresh"|"historical"|"absent";
}
export function assessHistory(history:DailyEvidence[],editionDate:string):HistoryQuality {
  const reference=history.map(r=>r.date).filter(d=>d<editionDate).sort().at(-1)??null;
  const complete=new Map<string,Set<string>>();
  for(const r of history.filter(r=>r.date===reference&&r.value!==null&&Number.isFinite(r.value))) {
    const fields=complete.get(r.pra)??new Set<string>(); fields.add(r.phenomenon);complete.set(r.pra,fields);
  }
  const count=[...complete.values()].filter(s=>["heat","frost","dry","rain"].every(v=>s.has(v))).length;
  const age=reference?(Date.parse(editionDate)-Date.parse(reference))/86400000:null;
  return {policy_version:DATA_POLICY.version,nature:"reanalysis",reference_date:reference,age_days:age,
    complete_pra:count,total_pra:713,usable:age!==null&&age>=1&&age<=DATA_POLICY.max_reanalysis_age_days&&count>=DATA_POLICY.min_complete_pra,
    freshness:!reference?"absent":reference>=shift(editionDate,-2)?"fresh":"historical"};
}
export function qualityLimitations(q:HistoryQuality,forecast:boolean,acquisitions:{source:string;state:string}[]) {
  return [
    `Qualité ${q.policy_version} : réanalyse ERA5-Land, référence ${q.reference_date??"absente"}, âge ${q.age_days??"inconnu"} jours ; ${q.complete_pra}/713 PRA avec les quatre descripteurs sur support natif complet. Aucune valeur imputée aux PRA insuffisantes.`,
    ...(forecast?[]:["Publication dégradée rétrospective : aucune prévision qualifiée. Aucune affirmation prospective autorisée. Les réanalyses ne sont pas des observations de J-1." ]),
    ...acquisitions.map(a=>`Acquisition ${a.source} : ${a.state}. Ce statut technique ne prouve ni couverture ni fraîcheur.`),
  ];
}
