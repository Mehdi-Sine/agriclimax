'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import NationalMap,{type PraCollection} from '../national/map';
import {VARIABLES,weatherSelection,cumulativeRain,type WeatherVariable,type WeatherCycle} from './model';
import '../unified/unified.css';
const label=(value:number|null|undefined)=>value==null?'Indisponible':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(value);
export function OperationalWorkspace(){
  const [cycle,setCycle]=useState<WeatherCycle|null>(null),[geometry,setGeometry]=useState<PraCollection|null>(null);
  const [error,setError]=useState(''),[date,setDate]=useState(''),[variable,setVariable]=useState<WeatherVariable>('temperature');
  const [now]=useState(()=>Date.now());
  const [selected,setSelected]=useState('pra:28341');
  const [colors,setColors]=useState<string[]>([]);
  useEffect(()=>{
    const css=getComputedStyle(document.documentElement);
    const palette=['--map-cool','--map-cool-light','--map-mid','--map-warm-light','--map-warm'].map(k=>css.getPropertyValue(k).trim());
    const controller=new AbortController();
    Promise.all([fetch('/api/operational?experimental=weather',{signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error('Aucun cycle réel vérifié disponible.');return r.json() as Promise<WeatherCycle>;}),
      fetch('/maps/pra-national.geojson',{signal:controller.signal}).then(r=>r.json() as Promise<PraCollection>)]).then(([c,g])=>{
        setCycle(c);setGeometry(g);setDate([...new Set(c.rows.map(r=>r.valid_date))].sort()[0]??'');setColors(palette);
      }).catch((e:unknown)=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Source indisponible.');});
    return()=>controller.abort();
  },[]);
  const dates=[...new Set(cycle?.rows.map(r=>r.valid_date)??[])].sort();
  const rows=cycle?weatherSelection(cycle,date,variable):[];
  const ids=new Set(cycle?.rows.map(r=>r.pra_id)??[]);
  const collection=geometry?{...geometry,features:geometry.features.filter(f=>ids.has(`pra:${f.properties.code}`))}:null;
  const current=rows.find(r=>r.pra_id===selected),def=VARIABLES.find(v=>v.id===variable)!;
  const finite=rows.flatMap(r=>r.value===null?[]:[r.value]),low=finite.length?Math.min(...finite):0,high=finite.length?Math.max(...finite):1;
  const bounds=Array.from({length:5},(_,i)=>low+(high-low||1)*(i+1)/5);
  const name=geometry?.features.find(f=>`pra:${f.properties.code}`===selected)?.properties.name??selected;
  const stale=!!cycle?.acquired_at&&now-Date.parse(cycle.acquired_at)>36*3600000;
  return <div className="unified-product">
    <header className="unified-header"><Link className="unified-brand" href="/">Agri<span>climaX</span></Link><nav aria-label="Navigation du pilote"><Link href="/">Climat historique</Link><span>Pilote expérimental</span></nav></header>
    <main className="unified-main"><section className="unified-heading"><div><p className="eyebrow">EXPÉRIMENTAL · PRÉVISIONS · {cycle?.pra_count??0} PRA PILOTES</p><h1>Météo des territoires — pilote</h1><p>Scénario IFS distinct d’ERA5-Land. Résultats exploratoires, sans validation statistique.</p></div></section>
    <p role="status">Estimation J−1 : indisponible, accès aux analyses et observations non validé.{stale?' Cycle ancien : prévisions à réactualiser.':''}</p>
    {error?<p role="alert">{error}</p>:!cycle?<p role="status">Chargement des données réelles…</p>:<>
      <section className="unified-filters filters-open" aria-label="Filtres du pilote"><label>Date · UTC<select value={date} onChange={e=>setDate(e.target.value)}>{dates.map(d=><option key={d}>{d}</option>)}</select></label><label>Variable<select value={variable} onChange={e=>setVariable(e.target.value as WeatherVariable)}>{VARIABLES.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></label><label>PRA<select value={selected} onChange={e=>setSelected(e.target.value)}>{collection?.features.map(f=><option key={f.properties.code} value={`pra:${f.properties.code}`}>{f.properties.name}</option>)}</select></label></section>
      <p>Source : ECMWF IFS 0,25° · run {cycle.run} UTC · acquis {cycle.acquired_at} UTC. {cycle.pra_count} PRA, aucune couverture nationale annoncée.</p>
      <div className="unified-grid has-selection"><section className="unified-map-card"><div className="unified-map-title"><h2>{def.label} · {def.unit}</h2><span>Prévision, pas une observation</span></div>
      {collection&&colors.length>0&&<NationalMap collection={collection} rows={null} contextRows={null} mode="availability" selected={selected} onSelect={setSelected} quantitative={{values:rows.map(r=>({territoryId:r.pra_id,value:r.value,normal:null,anomaly:null,status:r.status})),field:'value',unit:def.unit,bounds,colors}} geography={{prefix:'pra:',label:`${cycle.pra_count} PRA pilotes`,attribution:cycle.attribution}}/>}</section>
      <aside className="unified-panel"><h2>{name}</h2><p data-testid="weather-value">{label(current?.value)} {def.unit}</p><p>Qualité : {current?.status??'indisponible'} · couverture spatiale {label(current?current.spatial_coverage*100:null)} % · temporelle {label(current?current.temporal_coverage*100:null)} %.</p><p>Validité : {current?.valid_from??'—'} → {current?.valid_to??'—'} · échéance fin H+{current?.lead_hours??'—'}.</p><p>Précipitations cumulées depuis le premier jour prévu : {label(cumulativeRain(cycle,selected,date))} mm.</p><p>Les minima/maxima sont échantillonnés toutes les 3 à 6 heures. La moyenne est une intégration trapézoïdale ; les cellules côtières peuvent inclure la mer.</p><details><summary>Provenance et limites</summary><p>{current?.source_id} · {current?.model} · {current?.rule_version}</p><p>{current?.quality_flags.join(' · ')}</p><p style={{overflowWrap:"anywhere"}}>Empreinte : {current?.provenance_sha256}</p></details></aside></div>
    </>}
    </main></div>;
}
