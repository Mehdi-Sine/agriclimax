'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import NationalMap,{type PraCollection} from '../national/map';
import {VARIABLES,cumulativeRain,type WeatherVariable,type WeatherCycle,type WeatherModel} from './model';
import '../unified/unified.css';
import {useResource} from '../unified/resource';

const label=(v:number|null|undefined)=>v==null?'Indisponible':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(v);
const status={available:'Disponible',partial:'Partiel',unavailable:'Indisponible'};
export function OperationalWorkspace(){
  const search=useSearchParams(),router=useRouter(),pathname=usePathname();
  const model=(search.get('weather_model')??'selected') as WeatherModel;
  const variable=(search.get('weather_variable')??'temperature') as WeatherVariable;
  const selected=search.get('pra')??'pra:28341';
  const requestedDate=search.get('weather_date')??'',archivedRun=search.get('weather_run')??'';
  const runQuery:Record<string,string>=archivedRun?{run:archivedRun}:{};
  const [colors,setColors]=useState<string[]>([]),[now]=useState(()=>Date.now());
  const today=new Date(now).toISOString().slice(0,10);
  function change(values:Record<string,string>){const q=new URLSearchParams(search.toString());q.set('experimental','weather');for(const [k,v] of Object.entries(values))q.set(k,v);router.replace(`${pathname}?${q}`,{scroll:false});}
  const geometryResource=useResource<PraCollection>('/maps/pra-national.geojson',true),geometry=geometryResource.data;
  const catalogueResource=useResource<WeatherCycle>(`/api/operational?${new URLSearchParams({experimental:'weather',catalogue:'1',model,...runQuery})}`),catalogue=catalogueResource.data;
  const dates=catalogue?.all_dates??catalogue?.available_dates??[];
  const date=requestedDate||(dates.includes(today)?today:dates[0]??'');
  const hasHorizon=!!catalogue?.available_dates?.includes(date);
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
  const recentDates=dates.filter(d=>d<today);
  const stale=!!catalogue?.acquired_at&&now-Date.parse(catalogue.acquired_at)>36*3600000;
  const historic=new URLSearchParams();historic.set('pra',selected);
  const context=new URLSearchParams(search.toString());context.set('experimental','weather');context.set('pra',selected);
  const coastalKey=current?.source_id==='ecmwf-open-data'?'ifs':current?.source_id.replace('meteofrance-','');
  const coastal=coastalKey?history?.coastal_qualification?.[coastalKey]:undefined;
  const available=rows.filter(r=>r.value!==null).length,partial=rows.filter(r=>r.status==='partial').length;
  const homogeneous=history&&current?{...history,rows:history.rows.filter(r=>r.source_id===current.source_id&&r.model_run_at===current.model_run_at&&r.valid_date>=(current.model_run_at??'').slice(0,10))}:null;
  return <div className="unified-product">
    <header className="unified-header"><Link className="unified-brand" href="/">Agri<span>climaX</span></Link><nav aria-label="Espaces agricoles"><Link href={`/?${context}`} aria-current={pathname==='/'?'page':undefined}>Climat</Link><Link href={`/productions?${historic}`}>Productions agricoles</Link><Link href={`/analyse?${context}`} aria-current={pathname==='/analyse'?'page':undefined}>Analyse agroclimato</Link></nav></header>
    <main className="unified-main">
      <section className="unified-heading"><div><p className="eyebrow">MÉTÉO TERRITORIALE · {catalogue?.pra_count??'…'} PRA RÉFÉRENCÉES</p><h1>{catalogue?.scope==='national'?'Météo des territoires agricoles':'Météo des territoires — pilote'}</h1><p>Estimations récentes issues de modèles et prévisions. Résultats exploratoires, distincts des observations et d’ERA5-Land.</p></div></section>
      <p><Link href={`/?${historic}`}>Historique ERA5-Land et normales</Link> · <strong>Météo récente et prévisions</strong></p>
      <p role="status">{catalogue?.scope==='national'?`Dernière estimation passée : ${recentDates.at(-1)??'indisponible'} UTC, issue de prévisions antérieures ; aucune observation ou analyse quotidienne validée.`:'Estimation J−1 : indisponible dans le pilote précédent.'}{stale?' Cycle ancien : actualisation nécessaire.':''}</p>
      {error&&<p role="alert">{error}</p>}
      {!catalogue?<p role="status">Chargement du catalogue météo vérifié…</p>:<>
        <section className="unified-filters filters-open" aria-label="Filtres météorologiques">
          <label>Date · UTC<select value={date} onChange={e=>change({weather_date:e.target.value})}>{dates.map(d=><option key={d} value={d}>{d}{!catalogue.available_dates?.includes(d)?' · hors horizon':''}</option>)}</select></label>
          <label>Variable<select value={variable} onChange={e=>change({weather_variable:e.target.value})}>{VARIABLES.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
          <label>Modèle<select value={model} onChange={e=>change({weather_model:e.target.value})}>{catalogue.models?.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
          <label>PRA<select value={selected} onChange={e=>change({pra:e.target.value})}>{collection?.features.map(f=><option key={f.properties.code} value={`pra:${f.properties.code}`}>{f.properties.name}</option>)}</select></label>
        </section>
        {loading&&<p role="status">Chargement des agrégats PRA…</p>}
        {!hasHorizon&&<p role="status">Aucune échéance de ce modèle pour cette journée. Les contours restent visibles ; aucune valeur n’est remplacée par zéro.</p>}
        <p>{past?'Estimation rétrospective issue de prévisions, pas une observation.':'Prévision, pas une observation.'} Source : {current?.model??'en cours de lecture'} · run {current?.model_run_at??'—'} UTC · acquis {current?.acquired_at??catalogue.acquired_at} UTC.</p>
        {!loading&&hasHorizon&&<p>{catalogue.pra_count} PRA référencées · {available} valeurs exploitables · {partial} supports partiels · {rows.filter(r=>r.status==='unavailable').length} indisponibles. La présence des contours ne signifie pas une couverture complète.</p>}
        <div className="unified-grid has-selection"><section className="unified-map-card"><div className="unified-map-title"><h2>{def?.label??'Variable inconnue'} · {def?.unit??''}</h2><span>{past?'Estimation issue de prévisions':'Prévision'}</span></div>
          {collection&&colors.length>0&&<NationalMap collection={collection} rows={null} contextRows={null} mode="availability" selected={selected} onSelect={id=>change({pra:id})} quantitative={{values:rows.map(r=>({territoryId:r.pra_id,value:r.value,normal:null,anomaly:null,status:r.status})),field:'value',unit:def?.unit??'',bounds,colors}} geography={{prefix:'pra:',label:`${catalogue.pra_count} PRA · valeurs qualifiées`,attribution:catalogue.attribution}}/>}
          <p>Gris : valeur absente, partielle ou invalide ; aucune valeur zéro déduite.</p>
        </section>
        <aside className="unified-panel"><h2>{feature?.properties.name??selected}</h2><p data-testid="weather-value">{label(current?.value)} {def?.unit??''}</p><p>Qualité : {current?status[current.status]:'Indisponible'} · support spatial des valeurs {label(current?current.spatial_coverage*100:null)} % · temporelle {label(current?current.temporal_coverage*100:null)} %.</p>
          {coastal&&<p>{coastal.physical_land_mask_available?`Fraction de terre du masque IFS, pondérée sur les cellules : ${label(coastal.source_land_fraction==null?null:coastal.source_land_fraction*100)} %. Ce masque ne corrige pas les valeurs.`:`Masque terre/mer du modèle indisponible. Centres situés dans le référentiel territorial : ${label(coastal.centre_inside_reference_fraction==null?null:coastal.centre_inside_reference_fraction*100)} % du poids ; indicateur géométrique, pas une mesure de surface terrestre.`}</p>}
          <p>Validité : {current?.valid_from??'—'} → {current?.valid_to??'—'} · échéance fin H+{current?.lead_hours??'—'}.</p>
          <p>{model==='selected'?'Cumul multi-modèles non calculé.':`Précipitations cumulées du même scénario : ${label(homogeneous?cumulativeRain(homogeneous,selected,date):null)} mm.`}</p>
          <p>Températures minimale et maximale échantillonnées, sans garantie d’extrêmes continus. Moyennes intégrées sur 24 h. La représentativité des cellules littorales reste qualifiée ; aucune correction terre/mer implicite.</p>
          {pathname==='/analyse'&&<p>Aucun score d’impact agricole calculé à partir de ces prévisions. Les références RPG/SAA et les parcours blé/bovins restent séparés.</p>}
          <details><summary>Provenance et limites</summary><p>{current?.source_id} · {current?.model} · {current?.rule_version}</p><p>{current?.quality_flags.join(' · ')}</p><p style={{overflowWrap:'anywhere'}}>Empreinte : {current?.provenance_sha256}</p></details>
        </aside></div>
        <details className="unified-method"><summary>Sources et méthodes</summary><p>Un seul modèle et un seul run par journée dans la sélection nationale ; les modèles restent consultables séparément. Les valeurs invalides de pluie ou d’humidité restent NULL, sans écrêtage. Les fractions terre/mer et leurs limites figurent dans les preuves de couverture ; les empreintes de grille sont indépendantes de celles d’ERA5-Land.</p><p><Link href="/stations?production=wheat">Parcours blé stationnel</Link> · <Link href="/stations?production=cattle&indicator=thi">THI bovin stationnel</Link></p></details>
      </>}
    </main>
  </div>;
}
