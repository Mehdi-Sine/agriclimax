"use client";
import dynamic from "next/dynamic";
import {useId,useState} from "react";
import Link from "next/link";
import type {EditionMap,EditionMapsView} from "./model";
import type {PraCollection} from "../national/map";
import places from "../../data/operational/pra-watch-places.json";
import {useResource} from "../unified/resource";
import {semanticPalette} from "../cartography/registry";
import {usePaletteColors} from "../cartography/use-palette";
import {SemanticLegend} from "../cartography/legend";
import {frenchPeriod,frenchCycle} from "../journal/ui/editorial-dates";
const NationalMap=dynamic(()=>import("../national/map"),{ssr:false});
const nature=(n:string)=>n==="reanalysis"?"Réanalyse":"Prévision";
export function EditionMaps({view,editionId,initialMapId,main=false}:{view:EditionMapsView;editionId:string;initialMapId?:string;main?:boolean}){
  const [id,setId]=useState(view.maps.some(m=>m.id===initialMapId)?initialMapId!:view.maps[0]?.id??"");
  const [selected,setSelected]=useState("");
  const picker=useId();
  const info=view.maps.find(m=>m.id===id);
  const url=info?`/api/journal/maps?id=${encodeURIComponent(editionId)}&map=${info.id}`:null;
  const result=useResource<{map:EditionMap;bundle_sha256:string}>(url);
  const geometry=useResource<PraCollection>(info?"/maps/journal-pra-v1.geojson":null,true);
  const days=info?(Date.parse(info.period[1])-Date.parse(info.period[0]))/86400000+1:1;
  const palette=semanticPalette(info?.indicator??"temperature_mean",info?.unit??"°C",days),colors=usePaletteColors(palette);
  const map=result.data?.map.id===info?.id&&result.data?.bundle_sha256===view.bundle_sha256?result.data?.map:undefined;
  const row=map?.rows.find(r=>r.territoryId===selected);
  const shape=geometry.data;
  const validShape=shape?.features.length===713&&new Set(shape.features.map(f=>f.id)).size===713&&shape.features.every(f=>places.places.some(p=>p.id===f.id));
  if(!info)return <aside className="empty-story" role="status"><p className="eyebrow">LES CARTES DE L’ÉDITION</p><h2>Pas de carte opérationnelle publiée</h2><p>{view.status==="error"?"L’archive cartographique est inaccessible ou son intégrité n’est pas vérifiée.":"Aucune carte qualifiée n’a encore été publiée pour cette édition."} L’article conserve ses données d’origine.</p><details><summary>État de la carte</summary><p>{view.code}</p></details></aside>;
  return <section className="edition-maps" aria-label={main?"Carte principale de l’édition":"Cartes opérationnelles de l’édition"}>
    {view.status==="preview"&&<p className="freshness" role="status">RECETTE · Cartes candidates réelles, non publiées. Qualification et revue humaine requises.</p>}
    <label className="pra-picker" htmlFor={picker}>Indicateur et période <select id={picker} aria-label="Indicateur de l’édition" value={id} onChange={e=>{setId(e.target.value);setSelected("");}}>{view.maps.map(m=><option key={m.id} value={m.id}>{m.title} · {nature(m.nature)} · {m.period.join(" → ")}</option>)}</select></label>
    <figure className="journal-pra-map" data-map-id={info.id}>
      <div className="figure-heading"><span>LA FRANCE À LA MAILLE PRA</span><span>713 territoires officiels · dont 6 en Corse</span></div>
      <figcaption><h2>{info.title}</h2><p>{nature(info.nature)} {frenchPeriod(...info.period)} · {info.unit}.</p></figcaption>
      <p>Carte de contexte associée aux données gelées de cette édition. Sa période propre peut différer de celle de l’article ; elle ne décrit pas nécessairement la situation du jour.</p>
      <div className="pra-stage">
        {result.error||geometry.error||shape&&!validShape?<p role="alert">Carte indisponible ou contours incompatibles. Les archives et l’article restent consultables.</p>:map&&shape&&validShape?<>
          <NationalMap collection={shape} rows={null} contextRows={null} mode="availability" selected={selected} onSelect={setSelected} quantitative={{values:map.rows.map(r=>({territoryId:r.territoryId,value:r.value??(r.support_scope==="observed_area"?r.observed_value??null:null),normal:null,anomaly:null,status:r.status})),field:"value",unit:info.unit,bounds:palette.bounds,colors}} geography={{prefix:"pra:",label:"713 PRA",attribution:"PRA · OFB / MASA · contours simplifiés T32B"}}/>
          <label className="pra-picker">Consulter une PRA <select aria-label="PRA de l’édition" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choisir un territoire</option>{places.places.map(p=><option key={p.id} value={p.id}>{p.name} · {p.region}</option>)}</select></label>
          {row&&<aside className="pra-selection" aria-label="PRA sélectionnée"><h3>{places.places.find(p=>p.id===selected)?.name}</h3><p>{places.places.find(p=>p.id===selected)?.region}</p><strong>{row.value===null?row.support_scope==="observed_area"&&row.observed_value!=null?`${row.observed_value.toLocaleString("fr-FR",{maximumFractionDigits:2})} ${info.unit} sur la portion observée uniquement`:"Valeur non évaluable":`${row.value.toLocaleString("fr-FR",{maximumFractionDigits:2})} ${info.unit}`}</strong>
            <p>{row.support_scope==="observed_area"?"Couverture partielle : aucune extrapolation à la PRA entière ; valeur exclue des chiffres clés.":row.value===null?"Données absentes ou insuffisantes ; NULL distinct de zéro.":"Valeur descriptive sur le support qualifié par le moteur."}</p>
            <p>Couverture surfacique : {((row.spatial_coverage??0)*100).toFixed(1)} % · couverture temporelle : {((row.temporal_coverage??0)*100).toFixed(1)} %.</p>
            <p>{row.reason}</p><details><summary>Qualité, règle et provenance</summary><p>{row.rule_version}</p><p>{row.quality_flags.join(" · ")}</p><p>Fraîcheur source : {row.data_freshness.join(" · ")}</p><p>{row.provenance.join(" · ")}</p></details>
          </aside>}
        </>:<p role="status">Chargement de la carte des 713 PRA…</p>}
      </div>
      <SemanticLegend palette={palette}/>
      <p>{info.coverage.whole}/713 PRA avec valeur territoriale · {info.coverage.partial} sur portion observée uniquement · {info.coverage.missing} non évaluables. Les hachures signalent les supports partiels ; aucune valeur absente n’est remplacée.</p>
      <p className="pra-source">Sources : {info.sources.join(", ")} · {info.cycles.length?`cycles ${info.cycles.map(frenchCycle).join(" ; ")}`:"historique de réanalyse"}. Validité : {info.period.join(" → ")}. Résultats descriptifs exploratoires, sans dommage agricole déduit.</p>
      <details><summary>Traçabilité de la carte</summary><p>Carte {info.id} · bundle {view.bundle_sha256}.</p><p>Empreinte des entrées : {info.input_sha256}.</p><a href={url??undefined}>Données structurées de cette carte</a></details>
    </figure>
    {main&&<Link href={`/cartes-du-jour?id=${encodeURIComponent(editionId)}&map=${id}`}>Toutes les cartes de cette édition →</Link>}
  </section>;
}
