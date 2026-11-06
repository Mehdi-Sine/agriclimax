'use client';
import {useEffect,useMemo,useState} from 'react';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import type {PraCollection} from '../national/map';
import {modeDates,modeDate,type TemporalMode} from '../unified/temporal';
import {VARIABLES,cumulativeRain,type WeatherVariable,type WeatherCycle,type WeatherModel} from './model';
import '../unified/unified.css';
import {useResource} from '../unified/resource';

const label=(v:number|null|undefined)=>v==null?'Indisponible':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(v);
const status={available:'Disponible',partial:'Partiel',unavailable:'Indisponible'};
export function useOperationalWeather(active:boolean,temporalMode:TemporalMode){
  const search=useSearchParams(),router=useRouter(),pathname=usePathname();
  const model=(search.get('weather_model')??'selected') as WeatherModel;
  const variable=(search.get('weather_variable')??'temperature') as WeatherVariable;
  const selected=search.get('pra')??'pra:28341';
  const archivedRun=search.get('weather_run')??'';
  const runQuery:Record<string,string>=archivedRun?{run:archivedRun}:{};
  const [colors,setColors]=useState<string[]>([]),[now]=useState(()=>Date.now());
  const today=new Date(now).toISOString().slice(0,10);
  function change(values:Record<string,string>){const q=new URLSearchParams(search.toString());q.delete('experimental');q.set('temporal',temporalMode);for(const [k,v] of Object.entries(values))q.set(k==='weather_date'?`${temporalMode}_date`:k,v);q.delete('weather_date');router.replace(`${pathname}?${q}`,{scroll:false});}
  const geometryResource=useResource<PraCollection>('/maps/pra-national.geojson',true),geometry=geometryResource.data;
  const catalogueResource=useResource<WeatherCycle>(`/api/operational?${new URLSearchParams({experimental:'weather',catalogue:'1',model,...runQuery})}`),catalogue=catalogueResource.data;
  const dates=modeDates(catalogue,temporalMode);
  const date=modeDate(new URLSearchParams(search.toString()),dates,temporalMode);
  const hasHorizon=active&&dates.includes(date);
  const base={experimental:'weather',model,...runQuery};
  const viewResource=useResource<WeatherCycle>(hasHorizon?`/api/operational?${new URLSearchParams({...base,date,variable})}`:null),view=viewResource.data;
  const historyResource=useResource<WeatherCycle>(hasHorizon?`/api/operational?${new URLSearchParams({...base,pra:selected})}`:null),history=historyResource.data;
  const error=catalogueResource.error??geometryResource.error??viewResource.error??historyResource.error;
  const loading=hasHorizon&&!view&&!viewResource.error;
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>{const css=getComputedStyle(document.documentElement);setColors(['--map-cool','--map-cool-light','--map-mid','--map-warm-light','--map-warm'].map(k=>css.getPropertyValue(k).trim()));});
    return()=>cancelAnimationFrame(frame);
  },[]);
  const geometryKey=catalogue?.pra_ids?.join(',')??'';
  const collection=useMemo(()=>{
    if(!geometry||!geometryKey)return null;
    const ids=new Set(geometryKey.split(','));return {...geometry,features:geometry.features.filter(f=>ids.has(`pra:${f.properties.code}`))};
  },[geometry,geometryKey]);
  const rows=view?.rows??[],current=rows.find(r=>r.pra_id===selected),def=VARIABLES.find(v=>v.id===variable);
  const finite=rows.flatMap(r=>r.value===null?[]:[r.value]),low=finite.length?Math.min(...finite):0,high=finite.length?Math.max(...finite):1;
  const bounds=Array.from({length:5},(_,i)=>low+(high-low||1)*(i+1)/5);
  const feature=geometry?.features.find(f=>`pra:${f.properties.code}`===selected);
  const past=!!date&&date<today;
  const stale=!!catalogue?.acquired_at&&now-Date.parse(catalogue?.acquired_at)>36*3600000;
  const coastalKey=current?.source_id==='ecmwf-open-data'?'ifs':current?.source_id.replace('meteofrance-','');
  const coastal=coastalKey?history?.coastal_qualification?.[coastalKey]:undefined;
  const available=rows.filter(r=>r.value!==null).length,partial=rows.filter(r=>r.status==='partial').length;
  const homogeneous=history&&current?{...history,rows:history.rows.filter(r=>r.source_id===current.source_id&&r.model_run_at===current.model_run_at&&r.valid_date>=(current.model_run_at??'').slice(0,10))}:null;
  const filters=<>
    <p role="status">{temporalMode==='recent'?(date===catalogue?.run?.slice(0,10)?'J0 : journée en cours, incluant des heures prévues ; pas une observation.':'Estimation issue de prévisions antérieures ; aucune observation ou analyse quotidienne validée.'):'Prévisions issues de modèles, pas des observations.'}{stale?' Cycle ancien : actualisation nécessaire.':''}</p>
    {error&&<p role="alert">{error}</p>}
    {!catalogue&&<p role="status">Chargement du catalogue météo vérifié…</p>}
        <section className="unified-filters filters-open" aria-label="Filtres météorologiques">
          <label>Date · UTC<select value={date} onChange={e=>change({weather_date:e.target.value})}>{dates.map(d=><option key={d} value={d}>{d}{!catalogue?.available_dates?.includes(d)?' · hors horizon':''}</option>)}</select></label>
          <label>Variable<select value={variable} onChange={e=>change({weather_variable:e.target.value})}>{VARIABLES.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
          <label>Modèle<select value={model} onChange={e=>change({weather_model:e.target.value})}>{catalogue?.models?.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
          <label>PRA<select value={selected} onChange={e=>change({pra:e.target.value})}>{collection?.features.map(f=><option key={f.properties.code} value={`pra:${f.properties.code}`}>{f.properties.name}</option>)}</select></label>
        </section>
        {loading&&<p role="status">Chargement des agrégats PRA…</p>}
        {!hasHorizon&&<p role="status">Aucune échéance de ce modèle pour cette journée. Les contours restent visibles ; aucune valeur n’est remplacée par zéro.</p>}
        <p>{past?'Estimation rétrospective issue de prévisions, pas une observation.':'Prévision, pas une observation.'} Source : {current?.model??'en cours de lecture'} · run {current?.model_run_at??'—'} UTC · acquis {current?.acquired_at??catalogue?.acquired_at} UTC.</p>
        {!loading&&hasHorizon&&<p>{catalogue?.pra_count} PRA référencées · {available} valeurs exploitables · {partial} supports partiels · {rows.filter(r=>r.status==='unavailable').length} indisponibles. La présence des contours ne signifie pas une couverture complète.</p>}
</>;
  const panel=<><h2>{feature?.properties.name??selected}</h2><p data-testid="weather-value">{label(current?.value)} {def?.unit??''}</p><p>Qualité : {current?status[current.status]:'Indisponible'} · support spatial des valeurs {label(current?current.spatial_coverage*100:null)} % · temporelle {label(current?current.temporal_coverage*100:null)} %.</p>
          {coastal&&<p>{coastal.physical_land_mask_available?`Fraction de terre du masque officiel ${coastalKey?.toUpperCase()}, pondérée sur les cellules : ${label(coastal.source_land_fraction==null?null:coastal.source_land_fraction*100)} %. Ce masque ne corrige pas les valeurs.`:`Masque terre/mer du modèle indisponible. Centres situés dans le référentiel territorial : ${label(coastal.centre_inside_reference_fraction==null?null:coastal.centre_inside_reference_fraction*100)} % du poids ; indicateur géométrique, pas une mesure de surface terrestre.`}</p>}
          <p>Validité : {current?.valid_from??'—'} → {current?.valid_to??'—'} · échéance fin H+{current?.lead_hours??'—'}.</p>
          <p>{model==='selected'?'Cumul multi-modèles non calculé.':`Précipitations cumulées du même scénario : ${label(homogeneous?cumulativeRain(homogeneous,selected,date):null)} mm.`}</p>
          <p>Températures minimale et maximale échantillonnées, sans garantie d’extrêmes continus. Moyennes intégrées sur 24 h. La représentativité des cellules littorales reste qualifiée ; aucune correction terre/mer implicite.</p>
          {pathname==='/analyse'&&<p>Aucun score d’impact agricole calculé à partir de ces prévisions. Les références RPG/SAA et les parcours blé/bovins restent séparés.</p>}
          <details><summary>Provenance et limites</summary><p>{current?.source_id} · {current?.model} · {current?.rule_version}</p><p>{current?.quality_flags.join(' · ')}</p><p style={{overflowWrap:'anywhere'}}>Empreinte : {current?.provenance_sha256}</p></details>
        </>;
  return {catalogue,dates,date,filters,panel,mapTitle:<div className="unified-map-title"><h2>{def?.label??'Variable inconnue'} · {def?.unit??''}</h2><span>{past?'Estimation issue de prévisions':'Prévision'}</span></div>,collection,mapProps:{selected,onSelect:(id:string)=>change({pra:id}),quantitative:{values:rows.map(r=>({territoryId:r.pra_id,value:r.value,normal:null,anomaly:null,status:r.status})),field:'value' as const,unit:def?.unit??'',bounds,colors}},shortcuts:<div className="unified-context">
    {dates.at(-1)&&temporalMode==='recent'&&<button onClick={()=>change({weather_date:dates.at(-1)!})}>Dernière estimation</button>}
    {dates.includes(today)&&<button onClick={()=>change({weather_date:today})}>Aujourd’hui</button>}
    {[3,7].map(lead=>{const day=catalogue?.run?new Date(Date.parse(catalogue.run)+lead*86400000).toISOString().slice(0,10):'';return dates.includes(day)?<button key={lead} onClick={()=>change({weather_date:day})}>J+{lead}</button>:null;})}
  </div>};
}
