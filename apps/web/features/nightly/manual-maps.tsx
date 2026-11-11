'use client';
import dynamic from 'next/dynamic';
import {useState} from 'react';
import type {ManualMap,ManualMapInfo} from '../../lib/server/manual-journal';
import type {PraCollection} from '../national/map';
import {useResource} from '../unified/resource';
import {semanticPalette} from '../cartography/registry';
import {usePaletteColors} from '../cartography/use-palette';
import {SemanticLegend} from '../cartography/legend';
const NationalMap=dynamic(()=>import('../national/map'),{ssr:false});
export function ManualMaps({catalogue}:{catalogue:ManualMapInfo[]}){
 const [id,setId]=useState(catalogue[0]?.id??''),[selected,setSelected]=useState('');
 const result=useResource<ManualMap>(id?'/api/manual-journal?map='+encodeURIComponent(id):null);
 const geometry=useResource<PraCollection>('/maps/journal-pra-v1.geojson');
 const info=catalogue.find(m=>m.id===id);
 const key=info?.indicator??'rain',paletteKey=key.startsWith('gdd')?'gdd':key==='hot30'?'hot':key==='hot30_sequence'?'hot_sequence':key;
 const days=info?(Date.parse(info.period[1])-Date.parse(info.period[0]))/86400000+1:1;
 const palette=semanticPalette(paletteKey,info?.unit??'mm',days),colors=usePaletteColors(palette);
 const row=result.data?.rows.find(r=>r.territoryId===selected);
 return <section className="journal" aria-label="Cartes de l’exécution de test">
  <h2>Cartes de l’exécution de test</h2><p>Résultats isolés · 713 PRA · aucune publication remplacée.</p>
  <label className="pra-picker" htmlFor="manual-map">Indicateur et source <select id="manual-map" value={id} onChange={e=>{setId(e.target.value);setSelected('');}}>{catalogue.map(m=><option key={m.id} value={m.id}>{m.production} · {m.indicator} · {m.nature} · {m.period.join(' → ')}</option>)}</select></label>
  {info&&<p>{info.nature} du {info.period.join(' au ')} · <a href="/aide/cartes">Sources, couverture et méthodes</a></p>}
  {result.error||geometry.error?<p role="alert">Lecture de la carte de test impossible.</p>:result.data&&geometry.data?<>
   <div className="journal-pra-map"><NationalMap collection={geometry.data} rows={null} contextRows={null} mode="availability" selected={selected} onSelect={setSelected} quantitative={{values:result.data.rows.map(r=>({...r,normal:null,anomaly:null})),field:'value',unit:info?.unit??'',bounds:palette.bounds,colors}}/></div>
   <SemanticLegend palette={palette}/><p>{result.data.rows.filter(r=>r.value!==null).length} PRA avec valeur qualifiée ; les valeurs absentes ne sont pas remplacées.</p>
   {row&&<p role="status">{row.territoryId} : {row.value??'indisponible'} {info?.unit} · support {row.support_scope??'inconnu'} · couverture {row.spatial_coverage??'inconnue'} · {row.data_freshness.join('; ')} · {row.reason}</p>}
  </>:<p role="status">Chargement des résultats de test…</p>}
 </section>;
}
