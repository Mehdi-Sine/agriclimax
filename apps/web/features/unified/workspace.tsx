'use client';
import {semanticPalette} from '../cartography/registry';
import {usePaletteColors} from '../cartography/use-palette';
import {SemanticLegend} from '../cartography/legend';
import { ComplementNotice } from "../agroclimatic/complement";
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {MapPresentation} from '../cartography/presentation';
import { type PraCollection } from '../national/map';
import { DAYS, NATIONAL, type ClimateContextRow } from '../national/model';
import { trailingStart, type NationalAvailability } from '../national/daily-availability';
import { AGRICULTURE, INDICATORS, RULES, parseState, type Space, type TerritorialValue } from './model';
import './unified.css';
import { useAgriculturalExplorer } from '../agriculture/explorer';
import {useOperationalWeather} from '../operational/workspace';
import {temporalMode,switchMode,temporalGap,type TemporalMode} from './temporal';
import { WheatContext } from '../agriculture/wheat-context';
import {useResource} from './resource';
import {useAgroclimatic} from '../agroclimatic/workspace';

function valueLabel(value: number | null | undefined): string { return value == null ? 'Indisponible' : new Intl.NumberFormat('fr-FR', {maximumFractionDigits:2}).format(value); }

const TITLES={climat:'Climat des territoires agricoles',productions:'Les productions, dans leur territoire',analyse:'Comprendre les aléas agroclimatiques'};
const DESCRIPTIONS={climat:'Explorer les valeurs ERA5-Land, leurs normales et leurs écarts à l’échelle des PRA.',productions:'Surfaces, rendements et volumes : une lecture agricole à la maille de la source.',analyse:'Des indicateurs climatiques descriptifs pour le blé tendre, sans score d’impact implicite.'};
const STATUS={available:'Disponible',partial:'Partiel',unavailable:'Indisponible',not_applicable:'Non applicable',source_error:'Erreur source'};
export function UnifiedWorkspace() {
  return <HistoricalWorkspace/>;
}
function HistoricalWorkspace() {
  const pathname=usePathname(),search=useSearchParams();
  const geometry=useResource<PraCollection>(`/maps/pra-national.geojson?reference=${NATIONAL.reference}`,true);
  const collection=geometry.data?.type==='FeatureCollection'&&geometry.data.features.length===713?geometry.data:null;
  const temporal=temporalMode(new URLSearchParams(search.toString()));
  const weather=temporal!=='history'&&pathname!=='/productions';
  const operational=useOperationalWeather(weather,temporal,collection);
  const space:Space=pathname==='/productions'?'productions':pathname==='/analyse'?'analyse':'climat';
  const availability=useResource<NationalAvailability>('/api/national?action=availability');
  const availableDays=availability.data?.days??DAYS;
  const latest=availability.data?.latest??NATIONAL.end;
  const agro=useAgroclimatic(space==='analyse',collection,availability.data);
  const analysis=space==='analyse';
  const gap=temporalGap(latest,operational.catalogue?.all_dates??[]);
  const {state,errors}=parseState(new URLSearchParams(search.toString()),space,availableDays);
  const def=INDICATORS.find(i=>i.id===state.indicator)!;
  const agriculture = useAgriculturalExplorer(space === 'productions');
  const [query,setQuery]=useState(''),[filtersOpen,setFiltersOpen]=useState(false);
  const feature=collection?.features.find(f=>f.id===state.pra);
  const selectionInvalid=!!state.pra&&!!collection&&!feature;
  const invalid=errors.length>0||selectionInvalid||!availability.data;
  const dataUrl=analysis||weather||space==='productions'||invalid?null:`/api/unified?${new URLSearchParams({start:state.period?state.start:state.date,end:state.date,indicator:def.id,threshold:String(state.threshold),...(search.get('rule_version')?{rule_version:search.get('rule_version')!}:{}),...(search.get('storage')==='cold'?{storage:'cold'}:{})})}`;
  const source=useResource<{data:TerritorialValue[]}>(dataUrl);
  const history=useResource<{data:ClimateContextRow[]}>(state.pra&&!analysis&&!weather&&space!=='productions'&&!invalid?`/api/national?${new URLSearchParams({action:'context-history',pra:state.pra,end:state.date,...(search.get('storage')==='cold'?{storage:'cold'}:{})})}`:null);
  const support=useResource<{verified:boolean;collection:PraCollection}>(!analysis&&!weather&&space!=='productions'&&state.mode==='value'&&['temperature','temperature_min','temperature_max','hot','frost','rain','gdd'].includes(state.indicator)?`/api/national/support?${new URLSearchParams({start:state.period?state.start:state.date,end:state.date,variable:def.variable})}`:null);
  const values=source.data?.data??[];
  const current=values.find(v=>v.territoryId===state.pra);
  const matches=useMemo(()=>{
    const normalize=(s:string)=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
    return query.trim()?collection?.features.filter(f=>normalize(`${f.properties.name} ${f.properties.code} ${f.properties.department_name}`).includes(normalize(query))).slice(0,8)??[]:[];
  },[query,collection]);
  const semantic=semanticPalette(def.id,def.unit,state.period?Math.round((Date.parse(state.date)-Date.parse(state.start))/86400000)+1:1,state.mode);
  const bounds=semantic.bounds,palette=usePaletteColors(semantic);
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
    if(path!=='/analyse'&&p.get('production')==='cattle'){p.set('production','wheat');p.set('variable','area');}
    p.set('date',state.date);p.set('start',state.start);p.set('periode',state.period?'periode':'jour');
    if(path==='/analyse'&&!RULES.some(r=>r.indicator===state.indicator)){p.set('indicateur','hot');p.set('mode','value');p.set('periode','periode');}
    return `${path}?${p}`;
  }
  const title=def.label;
  const mapCollection = space === 'productions' ? agriculture.collection ?? collection : collection;
  const mapProps = space === 'productions' ? agriculture.mapProps : analysis?agro.mapProps:weather?operational.mapProps: { selected: state.pra, onSelect: (id: string) => change({pra:id}), quantitative: {values: invalid ? [] : values.map(v=>v.quality?{...v,value:state.mode==='value'?(v.value??(v.quality.state==='observed_partial'?v.observed_value:null)??null):v.value}:state.mode==='value'&&v.observed_value!=null?{...v,value:support.data?.collection.features.some(f=>f.id===v.territoryId)?v.value??v.observed_value:null}:v), field: state.mode, unit: def.unit, bounds, colors: palette.length ? palette : ['transparent','transparent','transparent','transparent','transparent']} };
  const climateBody = <>
      {!analysis&&space!=='productions'&&<section className="temporal-navigation" aria-label="Lecture temporelle des données">{([['history','Historique climatique'],['recent','Météo récente'],['forecast','Prévisions']] as const).map(([mode,label])=><button key={mode} aria-pressed={(weather?operational.temporalMode:temporal)===mode} onClick={()=>{const p=switchMode(new URLSearchParams(search.toString()),mode as TemporalMode);window.history.pushState(null,'',`${pathname}?${p}`);}}>{label}</button>)}<p>{weather?`Cycle ${operational.catalogue?.run??'en cours de vérification'} · validités ${operational.dates[0]??'—'} → ${operational.dates.at(-1)??'—'} UTC`:`Historique jusqu’au ${latest} UTC · normales 1991–2020`}</p>{gap&&<p role="status">Lacune de séries : {gap.start} → {gap.end} UTC ({gap.days} jours). Aucune continuité ni interpolation inventée entre historique et météo.</p>}</section>}
      {space === 'productions' ? agriculture.filters : analysis?agro.filters:weather?<>{operational.filters}{operational.shortcuts}</>:<>
      <button className="filters-toggle" aria-expanded={filtersOpen} aria-controls="map-filters" onClick={()=>setFiltersOpen(!filtersOpen)}>Filtres · {def.label} {filtersOpen?'−':'+'}</button>
      <section id="map-filters" className={`unified-filters ${filtersOpen?'filters-open':''}`} aria-label="Filtres de la carte">
        {space!=='climat'&&<label>Production<select value={state.production} onChange={e=>change({production:e.target.value})}>{AGRICULTURE.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>}
          <label>Lecture temporelle<select value={state.period?'periode':'jour'} onChange={e=>change({periode:e.target.value})}><option value="jour">Jour</option><option value="periode">Période</option></select></label>
          {state.period&&<label>Début · UTC<input type="date" value={state.start} min={availableDays[0]} max={latest} onChange={e=>change({start:e.target.value})}/></label>}
          <label>{state.period?'Fin':'Date'} · UTC<input type="date" value={state.date} min={availableDays[0]} max={latest} onChange={e=>change({date:e.target.value})}/></label>
          <label>{analysis?'Aléa descriptif':'Indicateur'}<select value={state.indicator} onChange={e=>change({indicateur:e.target.value,mode:'value',seuil:String(INDICATORS.find(d=>d.id===e.target.value)?.parameter??25)})}>{space==='climat'?<>{['meteo','agrometeo'].map(f=><optgroup key={f} label={f==='meteo'?'Météo / climatologie':'Agrométéo simple'}>{INDICATORS.filter(d=>d.family===f).map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</optgroup>)}</>:RULES.filter(r=>r.production===state.production).map(r=><option key={r.id} value={r.indicator}>{r.label}</option>)}</select></label>
          {['above','gdd'].includes(def.operator)&&<label>{def.operator==='gdd'?'Base':'Seuil Tmax'} · °C<input type="number" min="-30" max="60" value={state.threshold} onChange={e=>change({seuil:e.target.value})}/></label>}
          <label>Lecture<select value={state.mode} onChange={e=>change({mode:e.target.value})}><option value="value">Valeur</option>{def.reference&&<><option value="normal">Normale 1991–2020</option><option value="anomaly">Anomalie</option></>}</select></label>
      </section>
      <div className="unified-context"><span>ERA5-Land · dernier jour acquis national : {availability.data?.latest??'vérification…'} · échelle PRA</span><div><button onClick={()=>change({date:latest,periode:'jour'})}>Dernier historique</button><button onClick={()=>change({start:trailingStart(latest,7),date:latest,periode:'periode'})}>7 jours</button><button onClick={()=>change({start:trailingStart(latest,30),date:latest,periode:'periode'})}>30 jours</button></div></div>
      {(errors.length>0||selectionInvalid)&&<p className="unified-alert" role="alert">{[...errors,...(selectionInvalid?['PRA inconnue dans le référentiel.']:[])].join(' ')} <Link href={pathname}>Réinitialiser les filtres</Link></p>}
      <div className="unified-search"><label htmlFor="pra-search">⌕ Rechercher une PRA</label><input id="pra-search" type="search" autoComplete="off" placeholder="Nom, code PRA ou département…" value={query} onChange={e=>setQuery(e.target.value)} maxLength={100}/>{query&&<div className="unified-results" aria-label="Résultats PRA">{matches.map(f=><button key={String(f.id)} onClick={()=>{change({pra:String(f.id)});setQuery('');}}>{f.properties.name} <small>{f.properties.code} · {f.properties.department_name}</small></button>)}{!matches.length&&<p>Aucun territoire trouvé.</p>}</div>}</div>
      </>}
      {!weather&&space!=='productions'&&search.get('storage')==='cold'&&<p role="status">Lecture depuis les archives vérifiées lorsqu’elles existent ; autres journées lues dans les données DEV conservées.</p>}

      <div className={`unified-grid ${(space === 'productions' ? agriculture.hasSelection : !!feature)?'has-selection':''}`}>
        <section className="unified-map-card" aria-label="Exploration cartographique">
          {mapCollection&&<MapPresentation identity={`${pathname}/${search}/${palette.join(',')}/${source.data?values[0]?.datasetVersion??'ready':''}/${operational.catalogue?.run??''}/${mapProps.quantitative.colors.join(',')}`} loading={space === 'productions'?agriculture.loading:analysis?agro.loading:weather?operational.loading:!invalid&&!source.data&&!source.error} error={space === 'productions'?agriculture.error:analysis?agro.error:weather?operational.error:source.error} presentation={{title:(space === 'productions' ? agriculture.mapTitle : analysis?agro.mapTitle:weather?operational.mapTitle:<>          <div className="unified-map-title"><strong>{title} · {def.unit}</strong><span>{`${state.period?state.start+' → ':''}${state.date} · ${state.mode==='value'?'Valeur':state.mode==='normal'?'Normale 1991–2020':'Anomalie'}`}</span></div></>),legend:(space === 'productions' ? agriculture.legend : analysis?agro.legend:weather?operational.legend:<SemanticLegend palette={semantic}/>),map:{collection:mapCollection,rows:null,contextRows:null,mode:'availability' as const,coveredSupport:analysis?agro.coveredSupport:!weather&&space!=='productions'&&!values.some(v=>v.quality)?support.data?.collection:null,...mapProps}}}/>}
          {space === 'productions' ? agriculture.mapState : analysis?agro.mapState:weather?<p>713 PRA · valeurs qualifiées, gris : absence de valeur exploitable.</p>:<>          {!collection&&<p role={geometry.error?'alert':'status'}>{geometry.error?'Contours indisponibles.':'Chargement des 713 contours officiels…'}</p>}
          {!invalid&&<div className="unified-source-state" role={source.error?'alert':'status'}>{source.error?<>{source.error} Aucune donnée de remplacement. <button onClick={()=>{window.location.reload();}}>Réessayer</button></>:!source.data?'Chargement des valeurs nationales…':`${values.filter(v=>v.status==='available'&&v.value!==null).length} PRA complètes · ${values.filter(v=>v.value!==null&&v.observed_value!=null).length} estimations qualifiées ≥90% · ${values.filter(v=>v.value===null&&v.observed_value!=null).length} portions seulement · ${values.filter(v=>v.value===null&&v.observed_value==null&&!v.complementary).length} sans résultat · ${values.filter(v=>v.complementary).length} estimation(s) complémentaire(s) en fiche`}</div>}
</>}

        </section>
        <aside className="unified-panel" aria-label="Fiche territoire">
          {space === 'productions' ? agriculture.panel : analysis?agro.panel:weather?operational.panel:feature?<><div className="panel-top"><span className="eyebrow">PETITE RÉGION AGRICOLE · {feature.properties.code}</span><button aria-label="Fermer la fiche PRA" onClick={()=>change({pra:''})}>×</button></div><h2>{feature.properties.name}</h2><p>{feature.properties.department_name} · {feature.properties.region_name}</p>
            <span className="status-pill">{source.error?'Source inaccessible':current?.complementary?'Natif absent · estimation disponible':current?STATUS[current.status]:'Chargement…'}</span>
            {analysis&&<h3>A. Aléa climatique</h3>}
            <div className="unified-value"><small>{def.label}{['above','gdd'].includes(def.operator)?` · ${state.threshold} °C`:''}</small><strong>{valueLabel(state.mode==='value'&&current?.quality?.state==='observed_partial'?current.observed_value:current?.[state.mode])} <em>{(state.mode==='value'&&current?.quality?.state==='observed_partial'?current.observed_value:current?.[state.mode])!=null?def.unit:''}</em>{state.mode==='value'&&current?.quality?.state==='observed_partial'&&<small>Sur support observé uniquement</small>}</strong></div>
            <dl className="unified-comparison"><div><dt>Normale 1991–2020</dt><dd>{def.reference?`${valueLabel(current?.normal)} ${current?.normal!=null?def.unit:''}`:'Non applicable'}</dd></div><div><dt>Anomalie</dt><dd>{def.reference?`${valueLabel(current?.anomaly)} ${current?.anomaly!=null?def.unit:''}`:'Non calculable'}</dd></div></dl>
            {current?.complementary&&(state.mode==='value'?<ComplementNotice result={current.complementary}/>:<p>La reconstruction complémentaire ne fournit ni normale ni anomalie ; elle est accessible dans la lecture Valeur.</p>)}
            {current?.observed_value!=null&&<p>Valeur sur la seule portion réellement renseignée : {valueLabel(current.observed_value)} {def.unit}. {current.quality?'Support observé uniquement ; aucune généralisation à toute la PRA sans certificat de méthode.': ['temperature_min','temperature_max'].includes(def.variable)?'Extrême natif limité au support couvert ; aucune extrapolation à la PRA entière, même au-delà de90%. Un zéro de jours chauds ou de gel sur cette portion ne prouve pas leur absence ailleurs.':current.value===null?'Couverture inférieure à90% : aucune valeur pour la PRA entière.':'Estimation qualifiée à couverture≥90%, pas une mesure intégrale.'} Normale et anomalie non calculées pour cette restitution.</p>}<p className="coverage-line">{current?`${current.observedDays}/${current.expectedDays} jours renseignés · couverture spatiale ${current.coverage==null?'inconnue':valueLabel(current.coverage*100)+' %'}`:'Valeur non disponible pour cette sélection.'}</p>
            {current?.status==='partial'&&<p>{current.observedDays===current.expectedDays?'Support spatial partiel ; toutes les journées de la fenêtre sont renseignées.':'Résultat partiel : seuls les jours renseignés sont disponibles, sans extrapolation.'}</p>}
            {analysis&&<WheatContext pra={state.pra} climate={current} indicator={def} start={state.period ? state.start : state.date} end={state.date} threshold={state.threshold} />}
            <h3>{def.variable==='temperature_max'?'Tmax':def.variable==='temperature_min'?'Tmin':def.variable==='precipitation'?'Pluie':'Température moyenne'} · évolution quotidienne</h3>{!def.reference&&<p>Série climatique d’origine, avant calcul de l’indice.</p>}{history.error?<p role="alert">Historique indisponible. {history.error}</p>:history.data?<History reconstructed={!!current?.complementary} rows={history.data.data.filter(r=>r.variable===def.variable).map(r=>current?.complementary?{...r,current_value:current.complementary.series.find(p=>p.date===r.date)?.input_value??null,normal_1991_2020:null,current_status:'partial' as const}:current?.observed_series?{...r,current_value:current.observed_series.find(p=>p.date===r.date)?.value??null,normal_1991_2020:null,current_status:'partial' as const}:r)} unit={def.variable==='precipitation'?'mm':'°C'}/>:<p role="status">Chargement de l’historique…</p>}
            <details><summary>Détails et méthode</summary><p>{def.method}</p><p>Référence homologue exigée pour une anomalie ; aucune anomalie de jours au seuil ou degrés-jours. Réanalyse exploratoire, pas une mesure en station. Températures extrêmes : extrema des cellules, pas température au centre de PRA.</p><p>Règle {def.version} · {NATIONAL.dataset} · normale {NATIONAL.climatology}. Date source : {state.date} UTC.</p></details>
          </>:<><div className="panel-illustration" aria-hidden="true">◎</div><h2>Chaque territoire a son histoire</h2><p>Sélectionnez une PRA sur la carte ou recherchez son nom pour ouvrir sa fiche.</p><p>La sélection vous accompagne dans les trois espaces.</p></>}
        </aside>
      </div>
      {analysis?agro.summary:space === 'productions' ? agriculture.method : <>      {<p><Link href={`/?date=${state.date}&indicateur=${def.id}&storage=cold${state.pra?'&pra='+encodeURIComponent(state.pra):''}`}>Consulter les archives historiques vérifiées</Link></p>}
      <details id="sources" className="unified-method"><summary>Sources, méthodes et limites</summary><p>Contours OFB / MASA · {NATIONAL.reference} · géométrie source inchangée, réserves PostGIS de l’issue #49 conservées. ERA5-Land est une réanalyse et non une observation stationnelle. Normales quotidiennes 1991–2020. Dernière journée nationale réellement acquise : {availability.data?.latest??'en cours de vérification'}. Les dates sont vérifiées dans les données persistées.</p><p>Pour les périodes : moyenne des températures, somme des pluies, compte de jours au seuil strict. Les jours absents restent absents ; résultats partiels signalés. Les anomalies exigent les mêmes jours observés et une référence complète. Le 29 février conserve l’état de référence insuffisante.</p><p>Agreste SAA : séries annuelles départementales et régionales, dans l’espace Productions ; aucune statistique départementale répartie artificiellement entre PRA. Aucun niveau de risque, sensibilité ou impact agricole estimé.</p><p><Link href="/stations?mode=live_meteofrance&production=wheat">Stations Météo-France</Link> · <Link href="/stations?mode=live_meteofrance&production=cattle&indicator=thi">THI bovin stationnel</Link> · <Link href="/demo">Démonstration fictive séparée</Link></p></details></>}
  </>;
  return <div className="unified-product">
    <a className="skip-link" href="#main">Aller à la carte et aux filtres</a>
    <header className="unified-header">
      <Link className="unified-brand" href="/" aria-label="AgriclimaX, accueil">Agriclima<span>X</span></Link>
      <nav aria-label="Espaces produit"><Link href="/veille">Veille nationale</Link>{([['/','Climat','climat'],['/productions','Productions agricoles','productions'],['/analyse','Analyse agroclimato','analyse']] as const).map(([path,label,key])=><Link key={key} href={spaceHref(path)} aria-current={space===key?'page':undefined}>{label}</Link>)}</nav>
      <Link className="unified-help" href="/aide/cartes">ⓘ Aide et sources</Link>
    </header>
    <main id="main" className="unified-main">
      <div className="unified-heading"><div><p className="eyebrow">EXPLORER LES TERRITOIRES · FRANCE MÉTROPOLITAINE ET CORSE</p><h1>{analysis?TITLES.analyse:weather?(operational.temporalMode==='recent'?'Météo récente des territoires agricoles':'Prévisions des territoires agricoles'):TITLES[space]}</h1><p>{analysis?'Blé tendre et bovins : indicateurs exploratoires, historiques et prévisionnels, à l’échelle PRA.':weather?'Données de modèles, sources et couvertures qualifiées ; les observations et normales historiques restent distinctes.':DESCRIPTIONS[space]}</p></div><span className="scale-badge">{space === 'productions' ? 'Mailles agricoles · sources officielles' : '713 PRA · contours officiels'}</span></div>
      <div className="unified-context" role={availability.error?'alert':'status'}>{availability.error?<span>Disponibilité climatique inaccessible. {availability.error}</span>:availability.data?<span>Historique ERA5-Land · dernière journée acquise · {availability.data.freshness==='stale'?'Données retardées':'Réanalyse récente'} · date source : {availability.data.source_date} UTC · acquisition : {availability.data.acquired_at??'date non exposée par le service actuel'} · mise à jour : {availability.data.updated_at??'inconnue'} (UTC)</span>:<span>Vérification de la dernière journée nationale acquise…</span>}</div>
      {search.get('retour')?.startsWith('/veille?')&&<p><Link href={search.get('retour')!}>← Revenir à la veille nationale</Link></p>}
      {climateBody}
    </main>
  </div>;
}
function History({rows,unit,reconstructed=false}:{rows:ClimateContextRow[];unit:string;reconstructed?:boolean}) {
  const numbers=rows.flatMap(r=>[r.current_value,r.normal_1991_2020].filter((v):v is number=>v!==null));
  if(!numbers.length)return <p>Aucune valeur ni normale disponible.</p>;
  const min=Math.min(...numbers),max=Math.max(...numbers),span=max-min||1;
  const path=(field:'current_value'|'normal_1991_2020')=>{let pen=false;return rows.map((r,i)=>{const v=r[field];if(v===null){pen=false;return '';}const p=`${pen?'L':'M'} ${30+i*10} ${120-(v-min)*95/span}`;pen=true;return p;}).join(' ');};
  return <><figure className="unified-chart"><svg viewBox="0 0 340 150" role="img" aria-label={`Évolution ${reconstructed?"reconstituée":"observée et normale"} quotidienne, ${unit}`}><text x="0" y="18">{valueLabel(max)}</text><text x="0" y="140">{valueLabel(min)}</text><path className="normal-line" d={path('normal_1991_2020')}/><path className="observed-line" d={path('current_value')}/>{rows.filter(r=>r.current_value!==null).length===1&&rows.map((r,i)=>r.current_value===null?null:<circle key={r.date} cx={30+i*10} cy={120-(r.current_value-min)*95/span} r="2.5" fill="var(--map-rain-4)"/>)}</svg><figcaption>Trait plein : {reconstructed?"reconstruction spatiale":"réanalyse"} {reconstructed?" · normale indisponible":" · pointillé : normale"}<br/>{rows[0]?.date} → {rows.at(-1)?.date} · {unit}</figcaption></figure><details><summary>Valeurs quotidiennes accessibles</summary><div className="history-table"><table><caption>ERA5-Land {reconstructed?"· reconstruction spatiale":""} · {unit} · jours UTC</caption><thead><tr><th>Date</th><th>Valeur</th><th>Normale</th><th>État</th></tr></thead><tbody>{rows.map(r=><tr key={r.date}><th>{r.date}</th><td>{valueLabel(r.current_value)}</td><td>{valueLabel(r.normal_1991_2020)}</td><td>{r.current_status==='available'?'Disponible':r.current_status==='partial'?'Partiel':'Indisponible'}</td></tr>)}</tbody></table></div></details></>;
}
