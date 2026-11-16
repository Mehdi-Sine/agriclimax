'use client';
import dynamic from 'next/dynamic';
import {useState} from 'react';
import type {EditionMap,EditionMapsView} from '../../features/edition-maps/model';
import type {JournalMapCard} from '../../features/edition-maps/carousel-model';
import type {PraCollection} from '../../features/national/map';
import {EditionMaps} from '../../features/edition-maps/view';
import {JournalMapCarousel} from '../../features/edition-maps/carousel';
import {semanticPalette} from '../../features/cartography/registry';
import {usePaletteColors} from '../../features/cartography/use-palette';
const Map=dynamic(()=>import('../../features/national/map'),{ssr:false});
type Sample={map:EditionMap;collection:PraCollection};
export default function Preview({samples,view,cards,editionId,collection}:{samples:Sample[];view:EditionMapsView;cards:JournalMapCard[];editionId:string;collection:PraCollection}){
  const [index,setIndex]=useState(0),sample=samples[index],map=sample.map;
  const palette=semanticPalette(map.indicator,map.unit),colors=usePaletteColors(palette);
  const values=map.rows.map(r=>({territoryId:r.territoryId,value:r.value??r.observed_value??null,quality:r.quality,normal:null,anomaly:null,status:r.status}));
  return <main style={{padding:16,maxWidth:1400,margin:'auto'}}><h1>COUV-05C · rejeu local, non publié</h1><p>ARPEGE · archive réelle du 15 novembre 2026. Contrôle des composants partagés ; aucune édition publiée ni disponibilité actuelle déduite.</p>
    <label>Recette <select aria-label="Recette du rejeu" value={index} onChange={e=>setIndex(Number(e.target.value))}>{samples.map((s,i)=><option key={s.map.id} value={i}>{s.map.indicator}</option>)}</select></label>
    <section><h2>Moteur partagé Explorer / agroclimat</h2><Map coverageEnabled collection={collection} rows={null} contextRows={null} mode="availability" selected="" onSelect={()=>{}} coveredSupport={sample.collection} quantitative={{values,field:'value',unit:map.unit,bounds:palette.bounds,colors}}/></section>
    <section><h2>Composant Cartes du jour</h2><EditionMaps view={view} editionId={editionId}/></section>
    <section><h2>Composant principal Journal</h2><EditionMaps view={view} editionId={editionId} main/></section>
    <JournalMapCarousel cards={cards} preview/>
    <script id="replay-data" type="application/json" dangerouslySetInnerHTML={{__html:JSON.stringify({samples,view,editionId}).replace(/</g,'\\u003c')}}/>
    <style>{`.national-map{height:420px!important}@media(max-width:700px){.national-map{height:360px!important}}`}</style>
  </main>;
}
