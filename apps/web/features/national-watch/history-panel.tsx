'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import NationalMap from '../national/map';
import type {PraCollection} from '../national/map';
import {semanticPalette} from '../cartography/registry';
import {SemanticLegend} from '../cartography/legend';
import {usePaletteColors} from '../cartography/use-palette';
import {useResource} from '../unified/resource';
import {validatedAnomaly,type HistoricalWatch} from './historical';
import type {Place} from './model';
export function HistoricalWatchPanel({places,collection}:{places:Place[];collection:PraCollection|null}){
 const router=useRouter();
 const resource=useResource<HistoricalWatch>('/api/veille/historique'),data=resource.data;
 const [variable,setVariable]=useState('temperature');
 const palette=semanticPalette(variable==='temperature'?'temperature':'rain',variable==='temperature'?'°C':'mm',1,'anomaly'),colors=usePaletteColors(palette);
 const visible=new Set(places.map(p=>p.id));
 const rows=data?.rows.filter(r=>r.variable===variable&&visible.has(r.pra_id!))??[],valid=rows.filter(r=>validatedAnomaly(r)!==null);
 const threshold=variable==='temperature'?3:10;
 const groups=[...new Set(places.map(p=>p.region))].map(region=>{
  const ids=new Set(places.filter(p=>p.region===region).map(p=>p.id)),evaluated=valid.filter(r=>ids.has(r.pra_id!)),affected=evaluated.filter(r=>Math.abs(validatedAnomaly(r)!)>threshold);
  const extreme=affected.slice().sort((a,b)=>Math.abs(b.anomaly!)-Math.abs(a.anomaly!))[0];
  return {region,evaluated:evaluated.length,affected:affected.length,extreme};
 }).filter(g=>g.affected>0).sort((a,b)=>Math.abs(b.extreme!.anomaly!)-Math.abs(a.extreme!.anomaly!)||a.region.localeCompare(b.region));
 return <section aria-label="Dernière réanalyse nationale"><h2>Évolutions observées dans la dernière réanalyse</h2>{resource.error?<p role="alert">Historique momentanément inaccessible. Les prévisions restent indépendantes. <button onClick={()=>window.location.reload()}>Réessayer</button></p>:!data?<p role="status">Lecture de la dernière réanalyse et de ses références homologues…</p>:<><p>ERA5-Land · {data.date} UTC · {data.freshness==='stale'?'données retardées':'réanalyse récente'} · acquisition : {data.acquired_at??'non exposée'} · mise à jour : {data.updated_at??'non exposée'}. Une réanalyse n’est pas une observation en station.</p><label>Écart à la normale 1991–2020<select value={variable} onChange={e=>setVariable(e.target.value)}><option value="temperature">Température moyenne · °C</option><option value="precipitation">Précipitations quotidiennes · mm</option></select></label><p>{valid.length}/{places.length} PRA avec référence compatible et couverture complète. {places.length-valid.length} sans anomalie calculable ; aucune extrapolation.</p><label>Explorer une PRA au clavier<select aria-label="PRA historique à explorer" value="" onChange={e=>{if(e.target.value)router.push(`/?temporal=history&date=${data.date}&indicateur=${variable==='temperature'?'temperature':'rain'}&mode=anomaly&pra=${e.target.value}&retour=${encodeURIComponent('/veille?periode=history')}`);}}><option value="">Choisir un territoire</option>{places.map(p=><option key={p.id} value={p.id}>{p.name} · {p.region}</option>)}</select></label><div className="unified-map-card"><h3>Anomalie {variable==='temperature'?'de température moyenne':'de précipitations'} · {data.date}</h3>{collection&&<NationalMap collection={collection} rows={null} contextRows={null} mode="availability" selected="" onSelect={id=>{router.push(`/?temporal=history&date=${data.date}&indicateur=${variable==='temperature'?'temperature':'rain'}&mode=anomaly&pra=${id}&retour=${encodeURIComponent('/veille?periode=history')}`);}} quantitative={{values:rows.map(r=>({territoryId:r.pra_id!,value:validatedAnomaly(r),normal:null,anomaly:null,status:validatedAnomaly(r)===null?'unavailable':'available'})),field:'value',unit:palette.unit,bounds:palette.bounds,colors}}/>}<SemanticLegend palette={palette}/></div><h3>Écarts remarquables à la référence</h3><p>Convention de sélection : écart absolu strictement supérieur à {threshold} {palette.unit}. Classement par écart extrême puis région ; aucun risque de dommage évalué.</p>{groups.slice(0,5).map(g=><article key={g.region}><h4>{g.region}</h4><p>{g.affected}/{g.evaluated} PRA évaluables dépassent le critère ; écart territorial extrême {g.extreme!.anomaly!.toFixed(1)} {palette.unit}.</p><Link href={`/?temporal=history&date=${data.date}&indicateur=${variable==='temperature'?'temperature':'rain'}&mode=anomaly&pra=${g.extreme!.pra_id}&retour=${encodeURIComponent('/veille?periode=history')}`}>Explorer l’écart et sa référence homologue</Link></article>)}{!groups.length&&<p>Aucun écart ne franchit le critère parmi les PRA évaluables.</p>}<details><summary>Sources et méthode</summary><p>Identité : <span className="watch-proof">{data.identity}</span>. {data.source} · {data.rule_version}. Écart calculé par le lecteur scientifique existant, seulement avec couverture courante complète et trente années de référence complètes. Déficit de pluie en mm, sans diagnostic de sécheresse des sols. Reconstructions exclues des anomalies.</p></details></>}</section>;
}
