'use client';
import dynamic from 'next/dynamic';
import {useState} from 'react';
import type {PraCollection} from '../../features/national/map';
import type {CoverageQuality} from '../../features/climate-quality/policy';
import {semanticPalette} from '../../features/cartography/registry';
import {usePaletteColors} from '../../features/cartography/use-palette';
const Map=dynamic(()=>import('../../features/national/map'),{ssr:false});
type Reading={pra:string;indicator:string;value:number|null;quality:CoverageQuality};
export default function Preview({readings,collection,support}:{readings:Reading[];collection:PraCollection;support:{geometries:Record<string,PraCollection['features'][number]>}}){
 const [indicator,setIndicator]=useState('rain');
 const palette=semanticPalette(indicator,indicator==='rain'?'mm':'°C');const colors=usePaletteColors(palette);
 const values=readings.filter(r=>r.indicator===indicator).map(r=>({territoryId:r.pra,value:r.value,quality:r.quality,normal:null,anomaly:null,status:r.quality.state==='native_complete'?'available' as const:'partial' as const}));
 return <main style={{padding:16}}><h1>COUV-04 · comparaison sur archives gelées</h1><p>ERA5-Land · 1er novembre 2026 · 713 PRA, dont 6 corses. Rejeu, aucune disponibilité actuelle déduite.</p><select aria-label="Indicateur" value={indicator} onChange={e=>setIndicator(e.target.value)}>{['rain','temperature_mean','temperature_min'].map(id=><option key={id}>{id}</option>)}</select><div className="compare">{[false,true].map(enabled=><section key={String(enabled)}><h2>{enabled?'Après · contrat COUV-04':'Avant · rendu existant'}</h2><Map collection={collection} rows={null} contextRows={null} mode="availability" selected="" onSelect={()=>{}} quantitative={{values,field:'value',unit:palette.unit,bounds:palette.bounds,colors}} coverageEnabled={enabled} coveredSupport={enabled?{type:'FeatureCollection',features:Object.values(support.geometries)}:null}/></section>)}</div><p>Gris clair : surface sans valeur exploitable ; le contour reste complet. La valeur reste limitée au support qualifié.</p><style>{`.compare{display:grid;grid-template-columns:1fr 1fr;gap:16px}.national-map{height:500px!important}@media(max-width:700px){.compare{grid-template-columns:1fr}.national-map{height:380px!important}}`}</style></main>;
}
