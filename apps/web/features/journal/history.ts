export type Evolution='appearance'|'maintained'|'intensification'|'extension'|'attenuation'|'disappearance'|'unknown'|'insufficient_history';
export interface Snapshot {
 nature:'forecast'|'reanalysis'|'observation'; source:string; model:string; version:string; unit:string;
 period:[string,string]; date:string; complete:boolean; pra_ids:string[]; evaluated_ids:string[]; magnitude:number; episode_id:string;
}
export interface Change {horizon:3|7|14|30; status:Evolution; reason:string; nature:Snapshot['nature']; previous_date:string|null}
export function compare(current:Snapshot,previous:Snapshot|undefined,horizon:Change['horizon']):Change {
 const result=(status:Evolution,reason:string):Change=>({horizon,status,reason,nature:current.nature,previous_date:previous?.date??null});
 if(!Number.isFinite(Date.parse(current.date))||current.period.some(d=>!Number.isFinite(Date.parse(d)))||current.period[0]>current.period[1]||!Number.isFinite(current.magnitude))return result('unknown','Contrat temporel invalide.');
 if(!previous)return result('insufficient_history','Aucune série compatible fournie pour cet horizon.');
 if(!Number.isFinite(Date.parse(previous.date))||previous.period.some(d=>!Number.isFinite(Date.parse(d)))||previous.period[0]>previous.period[1]||!Number.isFinite(previous.magnitude))return result('unknown','Contrat temporel antérieur invalide.');
 if(!current.complete||!previous.complete)return result('unknown','Couverture incomplète.');
 if(current.nature!==previous.nature||current.source!==previous.source||current.model!==previous.model||current.version!==previous.version||current.unit!==previous.unit||current.episode_id!==previous.episode_id||JSON.stringify([...current.evaluated_ids].sort())!==JSON.stringify([...previous.evaluated_ids].sort()))return result('unknown','Sources, modèle, règle, épisode ou support incompatibles.');
 if(Date.parse(current.date)-Date.parse(previous.date)!==horizon*86400000)return result('unknown','Horizon non exact.');
 if(current.nature==='forecast'){
  if(JSON.stringify(current.period)!==JSON.stringify(previous.period))return result('unknown','Fenêtres de validité différentes : aucune tendance climatique déductible.');
 }else if(Date.parse(current.period[1])-Date.parse(current.period[0])!==Date.parse(previous.period[1])-Date.parse(previous.period[0])||Date.parse(current.period[0])-Date.parse(previous.period[0])!==horizon*86400000)return result('unknown','Fenêtres non homologues.');
 const a=current.pra_ids.length,b=previous.pra_ids.length;
 if(!b&&a)return result('appearance','Franchissement du critère sur le même support.');
 if(b&&!a)return result('disappearance','Plus aucun franchissement sur le support complet.');
 const overlap=current.pra_ids.some(id=>previous.pra_ids.includes(id));
 if(a&&b&&!overlap)return result('unknown','Épisodes spatialement disjoints.');
 if(a>b&&previous.pra_ids.every(id=>current.pra_ids.includes(id)))return result('extension','Extension du support franchissant le critère.');
 if(a<b&&current.pra_ids.every(id=>previous.pra_ids.includes(id)))return result('attenuation','Réduction du support franchissant le critère.');
 if(JSON.stringify([...current.pra_ids].sort())!==JSON.stringify([...previous.pra_ids].sort()))return result('unknown','Déplacement sans continuité démontrée.');
 return result(current.magnitude>previous.magnitude?'intensification':current.magnitude<previous.magnitude?'attenuation':'maintained',current.nature==='forecast'?'Révision des prévisions seulement ; aucune évolution observée.':'Comparaison descriptive homogène ; aucun dommage inféré.');
}
