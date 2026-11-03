'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import NationalMap, { type PraCollection } from '../national/map';
import { DAYS, NATIONAL, type ClimateContextRow } from '../national/model';
import { AGRICULTURE, INDICATORS, RULES, parseState, type Space, type TerritorialValue, type ProductionDefinition } from './model';
import './unified.css';

function valueLabel(value: number | null | undefined): string { return value == null ? 'Indisponible' : new Intl.NumberFormat('fr-FR', {maximumFractionDigits:2}).format(value); }

type Resource<T> = {key:string;data:T|null;error:string|null};
function useResource<T>(url:string|null, cached=false) {
  const [result,setResult]=useState<Resource<T>>({key:'',data:null,error:null});
  useEffect(()=>{
    if(!url)return;
    const controller=new AbortController();
    fetch(url,{signal:controller.signal,cache:cached?'force-cache':'default'}).then(async response=>{
      if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.error==='NOT_CONFIGURED'?'Source non activée dans cet environnement.':'Source momentanément inaccessible.');}
      return response.json() as Promise<T>;
    }).then(data=>setResult({key:url,data,error:null})).catch((error:unknown)=>{
      if(!controller.signal.aborted)setResult({key:url,data:null,error:error instanceof Error?error.message:'Source indisponible.'});
    });
    return ()=>controller.abort();
  },[url,cached]);
  return result.key===url?result:{key:url??'',data:null,error:null};
}
const TITLES={climat:'Climat des territoires agricoles',productions:'Les productions, dans leur territoire',analyse:'Comprendre les aléas agroclimatiques'};
const DESCRIPTIONS={climat:'Explorer les valeurs ERA5-Land, leurs normales et leurs écarts à l’échelle des PRA.',productions:'Surfaces, rendements et volumes : une lecture agricole à la maille de la source.',analyse:'Des indicateurs climatiques descriptifs pour le blé tendre, sans score d’impact implicite.'};
const STATUS={available:'Disponible',partial:'Partiel',unavailable:'Indisponible',not_applicable:'Non applicable',source_error:'Erreur source'};
export function UnifiedWorkspace() {
  const pathname=usePathname(),search=useSearchParams();
  const space:Space=pathname==='/productions'?'productions':pathname==='/analyse'?'analyse':'climat';
  const {state,errors}=parseState(new URLSearchParams(search.toString()),space);
  const def=INDICATORS.find(i=>i.id===state.indicator)!;
  const production=AGRICULTURE.find(p=>p.id===state.production)??AGRICULTURE[0];
  const [query,setQuery]=useState(''),[filtersOpen,setFiltersOpen]=useState(false);
  const geometry=useResource<PraCollection>(`/maps/pra-national.geojson?reference=${NATIONAL.reference}`,true);
  const collection=geometry.data?.type==='FeatureCollection'&&geometry.data.features.length===713?geometry.data:null;
  const feature=collection?.features.find(f=>f.id===state.pra);
  const selectionInvalid=!!state.pra&&!!collection&&!feature;
  const invalid=errors.length>0||selectionInvalid;
  const dataUrl=space==='productions'||invalid?null:`/api/unified?${new URLSearchParams({start:state.period?state.start:state.date,end:state.date,indicator:def.id,threshold:String(state.threshold)})}`;
  const source=useResource<{data:TerritorialValue[]}>(dataUrl);
  const history=useResource<{data:ClimateContextRow[]}>(state.pra&&space!=='productions'&&!invalid?`/api/national?${new URLSearchParams({action:'context-history',pra:state.pra})}`:null);
  const values=source.data?.data??[];
  const current=values.find(v=>v.territoryId===state.pra);
  const matches=useMemo(()=>{
    const normalize=(s:string)=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
    return query.trim()?collection?.features.filter(f=>normalize(`${f.properties.name} ${f.properties.code} ${f.properties.department_name}`).includes(normalize(query))).slice(0,8)??[]:[];
  },[query,collection]);
  const finite=values.flatMap(v=>v[state.mode]===null?[]:[v[state.mode]!]);
  let low=finite.length?Math.min(...finite):0,high=finite.length?Math.max(...finite):1;
  if(state.mode==='anomaly'){high=Math.max(Math.abs(low),Math.abs(high))||1;low=-high;}
  const cssColors=state.mode==='anomaly'?['--map-cool','--map-cool-light','--map-mid','--map-warm-light','--map-warm']:def.unit==='mm'?['--map-rain-1','--map-rain-2','--map-rain-3','--map-rain-4','--map-rain-5']:['--map-cool','--map-cool-light','--map-mid','--map-warm-light','--map-warm'];
  const [palette,setPalette]=useState<string[]>([]);
  const colorKey=cssColors.join(',');
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>{const css=getComputedStyle(document.documentElement);setPalette(colorKey.split(',').map(t=>css.getPropertyValue(t).trim()));});
    return()=>cancelAnimationFrame(frame);
  },[colorKey]);
  const bounds=Array.from({length:5},(_,i)=>low+(high-low)*(i+1)/5);
  function change(patch:Record<string,string>,path=pathname) {
    const next=new URLSearchParams(search.toString());
    for(const [key,value] of Object.entries(patch)){if(value)next.set(key,value);else next.delete(key);}
    // Establish defaults in the URL before switching spaces to preserve context.
    if(!next.has('date'))next.set('date',state.date);
    if(!next.has('start'))next.set('start',state.start);
    if(!next.has('periode'))next.set('periode',state.period?'periode':'jour');
    window.history.pushState(null,'',`${path}?${next}`);
  }
  function spaceHref(path:string) {
    const p=new URLSearchParams(search.toString());
    p.set('date',state.date);p.set('start',state.start);p.set('periode',state.period?'periode':'jour');
    if(path==='/analyse'&&!RULES.some(r=>r.indicator===state.indicator)){p.set('indicateur','hot');p.set('mode','value');p.set('periode','periode');}
    return `${path}?${p}`;
  }
  const title=space==='productions'?production.variables.find(v=>v.id===state.variable)!.label:def.label;
  return <div className="unified-product">
    <a className="skip-link" href="#main">Aller à la carte et aux filtres</a>
    <header className="unified-header">
      <Link className="unified-brand" href="/" aria-label="AgriclimaX, accueil">Agriclima<span>X</span></Link>
      <nav aria-label="Espaces produit">{([['/','Climat','climat'],['/productions','Productions agricoles','productions'],['/analyse','Analyse agroclimato','analyse']] as const).map(([path,label,key])=><Link key={key} href={spaceHref(path)} aria-current={space===key?'page':undefined}>{label}</Link>)}</nav>
      <a className="unified-help" href="#sources">ⓘ Aide et sources</a>
    </header>
    <main id="main" className="unified-main">
      <div className="unified-heading"><div><p className="eyebrow">EXPLORER LES TERRITOIRES · FRANCE MÉTROPOLITAINE ET CORSE</p><h1>{TITLES[space]}</h1><p>{DESCRIPTIONS[space]}</p></div><span className="scale-badge">713 PRA · contours officiels</span></div>
      <button className="filters-toggle" aria-expanded={filtersOpen} aria-controls="map-filters" onClick={()=>setFiltersOpen(!filtersOpen)}>Filtres · {space==='productions'?production.label:def.label} {filtersOpen?'−':'+'}</button>
      <section id="map-filters" className={`unified-filters ${filtersOpen?'filters-open':''}`} aria-label="Filtres de la carte">
        {space!=='climat'&&<label>Production<select value={state.production} onChange={e=>change({production:e.target.value})}>{AGRICULTURE.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>}
        {space==='productions'?<>
          <label>Variable agricole<select value={state.variable} onChange={e=>change({variable:e.target.value})}>{production.variables.map(v=><option key={v.id} value={v.id}>{v.label} ({v.unit})</option>)}</select></label>
          <label>Millésime<select disabled aria-label="Millésime"><option>À connecter · SAA annuelle</option></select></label>
          <label>Échelle de la source<select disabled><option>Département · données à connecter</option></select></label>
        </>:<>
          <label>Lecture temporelle<select value={state.period?'periode':'jour'} onChange={e=>change({periode:e.target.value})}><option value="jour">Jour</option><option value="periode">Période</option></select></label>
          {state.period&&<label>Début · UTC<input type="date" value={state.start} min={NATIONAL.start} max={NATIONAL.end} onChange={e=>change({start:e.target.value})}/></label>}
          <label>{state.period?'Fin':'Date'} · UTC<input type="date" value={state.date} min={NATIONAL.start} max={NATIONAL.end} onChange={e=>change({date:e.target.value})}/></label>
          <label>{space==='analyse'?'Aléa descriptif':'Indicateur'}<select value={state.indicator} onChange={e=>change({indicateur:e.target.value,mode:'value',seuil:String(INDICATORS.find(d=>d.id===e.target.value)?.parameter??25)})}>{space==='climat'?<>{['meteo','agrometeo'].map(f=><optgroup key={f} label={f==='meteo'?'Météo / climatologie':'Agrométéo simple'}>{INDICATORS.filter(d=>d.family===f).map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</optgroup>)}</>:RULES.filter(r=>r.production===state.production).map(r=><option key={r.id} value={r.indicator}>{r.label}</option>)}</select></label>
          {['above','gdd'].includes(def.operator)&&<label>{def.operator==='gdd'?'Base':'Seuil Tmax'} · °C<input type="number" min="-30" max="60" value={state.threshold} onChange={e=>change({seuil:e.target.value})}/></label>}
          <label>Lecture<select value={state.mode} onChange={e=>change({mode:e.target.value})}><option value="value">Valeur</option>{def.reference&&<><option value="normal">Normale 1991–2020</option><option value="anomaly">Anomalie</option></>}</select></label>
        </>}
      </section>
      {space!=='productions'&&<div className="unified-context"><span>Archive ERA5-Land · dernier jour disponible : 18/10/2026 · échelle PRA</span><div><button onClick={()=>change({date:NATIONAL.end,periode:'jour'})}>Dernier jour</button><button onClick={()=>change({start:DAYS[Math.max(0,DAYS.indexOf(state.date)-6)],periode:'periode'})}>7 jours</button><button onClick={()=>change({start:NATIONAL.start,date:NATIONAL.end,periode:'periode'})}>30 jours</button></div></div>}
      {space==='productions'&&<p className="unified-source-banner" role="status">Données agricoles non encore connectées · source recherchée : Agreste / SSP, SAA annuelle départementale. Aucun millésime qualifié.</p>}
      {invalid&&<p className="unified-alert" role="alert">{[...errors,...(selectionInvalid?['PRA inconnue dans le référentiel.']:[])].join(' ')} <Link href={pathname}>Réinitialiser les filtres</Link></p>}
      <div className="unified-search"><label htmlFor="pra-search">⌕ Rechercher une PRA</label><input id="pra-search" type="search" autoComplete="off" placeholder="Nom, code PRA ou département…" value={query} onChange={e=>setQuery(e.target.value)} maxLength={100}/>{query&&<div className="unified-results" aria-label="Résultats PRA">{matches.map(f=><button key={String(f.id)} onClick={()=>{change({pra:String(f.id)});setQuery('');}}>{f.properties.name} <small>{f.properties.code} · {f.properties.department_name}</small></button>)}{!matches.length&&<p>Aucun territoire trouvé.</p>}</div>}</div>
      <div className={`unified-grid ${feature?'has-selection':''}`}>
        <section className="unified-map-card" aria-label="Exploration cartographique">
          <div className="unified-map-title"><strong>{title}{space!=='productions'?` · ${def.unit}`:''}</strong><span>{space==='productions'?'Repères PRA · aucune statistique agricole':`${state.period?state.start+' → ':''}${state.date} · ${state.mode==='value'?'Valeur':state.mode==='normal'?'Normale 1991–2020':'Anomalie'}`}</span></div>
          {collection&&<NationalMap collection={collection} rows={null} contextRows={null} mode="availability" selected={state.pra} onSelect={id=>change({pra:id})} quantitative={{values:space==='productions'||invalid?[]:values,field:state.mode,unit:def.unit,bounds,colors:palette.length?palette:['transparent','transparent','transparent','transparent','transparent']}}/>}
          {!collection&&<p role={geometry.error?'alert':'status'}>{geometry.error?'Contours indisponibles.':'Chargement des 713 contours officiels…'}</p>}
          {space!=='productions'&&!invalid&&<div className="unified-source-state" role={source.error?'alert':'status'}>{source.error?<>{source.error} Aucune donnée de remplacement. <button onClick={()=>{window.location.reload();}}>Réessayer</button></>:!source.data?'Chargement des valeurs nationales…':`${values.filter(v=>v.status==='available').length} PRA complètes · ${values.filter(v=>v.status==='partial').length} partielles · ${values.filter(v=>v.status==='unavailable').length} indisponibles`}</div>}
          <div className="unified-legend" aria-label="Légende quantitative">{finite.length>0&&space!=='productions'&&!invalid?<><div className="legend-ramp">{bounds.map((b,i)=><span key={i} style={{background:`var(${cssColors[i]})`}}><small>{i===0?valueLabel(low)+' – ': '≤ '}{valueLabel(b)}</small></span>)}</div><p>{def.unit} · bornes calculées sur les valeurs affichées · bordure renforcée : partiel</p></>:<p>Aucune valeur cartographiée. Les contours servent uniquement de repères.</p>}<span className="missing-key"/> <small>Gris : donnée absente, aucune valeur zéro déduite</small></div>
        </section>
        <aside className="unified-panel" aria-label="Fiche territoire">
          {feature?<><div className="panel-top"><span className="eyebrow">PETITE RÉGION AGRICOLE · {feature.properties.code}</span><button aria-label="Fermer la fiche PRA" onClick={()=>change({pra:''})}>×</button></div><h2>{feature.properties.name}</h2><p>{feature.properties.department_name} · {feature.properties.region_name}</p>
          {space==='productions'?<AgriculturePanel production={production} variable={state.variable}/>:<>
            <span className="status-pill">{source.error?'Source inaccessible':current?STATUS[current.status]:'Chargement…'}</span>
            {space==='analyse'&&<h3>A. Aléa climatique</h3>}
            <div className="unified-value"><small>{def.label}{['above','gdd'].includes(def.operator)?` · ${state.threshold} °C`:''}</small><strong>{valueLabel(current?.[state.mode])} <em>{current?.[state.mode]!=null?def.unit:''}</em></strong></div>
            <dl className="unified-comparison"><div><dt>Normale 1991–2020</dt><dd>{def.reference?`${valueLabel(current?.normal)} ${current?.normal!=null?def.unit:''}`:'Non applicable'}</dd></div><div><dt>Anomalie</dt><dd>{def.reference?`${valueLabel(current?.anomaly)} ${current?.anomaly!=null?def.unit:''}`:'Non calculable'}</dd></div></dl>
            <p className="coverage-line">{current?`${current.observedDays}/${current.expectedDays} jours renseignés · couverture spatiale ${current.coverage==null?'inconnue':valueLabel(current.coverage*100)+' %'}`:'Valeur non disponible pour cette sélection.'}</p>
            {current?.status==='partial'&&<p>Résultat partiel : somme ou moyenne des seuls jours renseignés, sans extrapolation.</p>}
            {space==='analyse'&&<><h3>B. Production concernée</h3><p>{production.label} · exposition agricole non encore quantifiée à la PRA.</p><h3>C. Lecture agroclimatique</h3><p>{current?.value==null?'Données insuffisantes pour décrire cet aléa.':`${valueLabel(current.value)} ${def.unit} · ${def.label.toLowerCase()}${def.operator==='above'?` ${state.threshold} °C`:''}, sur ${current.observedDays} jours renseignés.`} Aucun impact sur le rendement ni niveau de vulnérabilité déduit. Le stade de la culture n’est pas renseigné.</p></>}
            <h3>{def.variable==='temperature_max'?'Tmax':def.variable==='temperature_min'?'Tmin':def.variable==='precipitation'?'Pluie':'Température moyenne'} · évolution quotidienne</h3>{!def.reference&&<p>Série climatique d’origine, avant calcul de l’indice.</p>}{history.error?<p role="alert">Historique indisponible. {history.error}</p>:history.data?<History rows={history.data.data.filter(r=>r.variable===def.variable)} unit={def.variable==='precipitation'?'mm':'°C'}/>:<p role="status">Chargement de l’historique…</p>}
            <details><summary>Détails et méthode</summary><p>{def.method}</p><p>Référence homologue exigée pour une anomalie ; aucune anomalie de jours au seuil ou degrés-jours. Réanalyse exploratoire, pas une mesure en station. Températures extrêmes : extrema des cellules, pas température au centre de PRA.</p><p>Règle {def.version} · {NATIONAL.dataset} · normale {NATIONAL.climatology}. Fraîcheur : archive septembre–octobre 2026.</p></details>
          </>}</>:<><div className="panel-illustration" aria-hidden="true">◎</div><h2>Chaque territoire a son histoire</h2><p>Sélectionnez une PRA sur la carte ou recherchez son nom pour ouvrir sa fiche.</p><p>La sélection vous accompagne dans les trois espaces.</p>{space==='productions'&&<AgriculturePanel production={production} variable={state.variable}/>}</>}
        </aside>
      </div>
      <details id="sources" className="unified-method"><summary>Sources, méthodes et limites</summary><p>Contours OFB / MASA · {NATIONAL.reference} · géométrie source inchangée, réserves PostGIS de l’issue #49 conservées. ERA5-Land est une réanalyse et non une observation stationnelle. Normales quotidiennes 1991–2020. Archive disponible du 19/09 au 18/10/2026 ; aucune journée postérieure inventée.</p><p>Pour les périodes : moyenne des températures, somme des pluies, compte de jours au seuil strict. Les jours absents restent absents ; résultats partiels signalés. Les anomalies exigent les mêmes jours observés et une référence complète. Le 29 février conserve l’état de référence insuffisante.</p><p>Agreste SAA : source départementale annuelle à qualifier ; aucune statistique départementale répartie artificiellement entre PRA. Aucun niveau de risque, sensibilité ou impact agricole estimé.</p><p><Link href="/stations?mode=live_meteofrance&production=wheat">Stations Météo-France</Link> · <Link href="/stations?mode=live_meteofrance&production=cattle&indicator=thi">THI bovin stationnel</Link> · <Link href="/demo">Démonstration fictive séparée</Link></p></details>
    </main>
  </div>;
}
function AgriculturePanel({production,variable}:{production:ProductionDefinition;variable:string}) {return <section className="agriculture-empty"><span className="eyebrow">AGRESTE / SSP · SOURCE ANNUELLE</span><h3>Données agricoles à connecter</h3><p>{production.variables.find(v=>v.id===variable)?.label} · {production.label} : aucun millésime ni chiffre qualifié dans cet environnement.</p><p>Maille attendue : département. La carte affiche les PRA comme repères climatiques, sans couleur agricole et sans attribution départementale implicite.</p><a href={production.source.sourceId} target="_blank" rel="noreferrer">Sources et millésimes · SAA ↗</a></section>;}
function History({rows,unit}:{rows:ClimateContextRow[];unit:string}) {
  const numbers=rows.flatMap(r=>[r.current_value,r.normal_1991_2020].filter((v):v is number=>v!==null));
  if(!numbers.length)return <p>Aucune valeur ni normale disponible.</p>;
  const min=Math.min(...numbers),max=Math.max(...numbers),span=max-min||1;
  const path=(field:'current_value'|'normal_1991_2020')=>{let pen=false;return rows.map((r,i)=>{const v=r[field];if(v===null){pen=false;return '';}const p=`${pen?'L':'M'} ${30+i*10} ${120-(v-min)*95/span}`;pen=true;return p;}).join(' ');};
  return <><figure className="unified-chart"><svg viewBox="0 0 340 150" role="img" aria-label={`Évolution observée et normale quotidienne, ${unit}`}><text x="0" y="18">{valueLabel(max)}</text><text x="0" y="140">{valueLabel(min)}</text><path className="normal-line" d={path('normal_1991_2020')}/><path className="observed-line" d={path('current_value')}/></svg><figcaption>Trait plein : réanalyse · pointillé : normale<br/>19 sept. → 18 oct. 2026 · {unit}</figcaption></figure><details><summary>Valeurs quotidiennes accessibles</summary><div className="history-table"><table><caption>ERA5-Land · {unit} · jours UTC</caption><thead><tr><th>Date</th><th>Valeur</th><th>Normale</th><th>État</th></tr></thead><tbody>{rows.map(r=><tr key={r.date}><th>{r.date}</th><td>{valueLabel(r.current_value)}</td><td>{valueLabel(r.normal_1991_2020)}</td><td>{r.current_status==='available'?'Disponible':r.current_status==='partial'?'Partiel':'Indisponible'}</td></tr>)}</tbody></table></div></details></>;
}
