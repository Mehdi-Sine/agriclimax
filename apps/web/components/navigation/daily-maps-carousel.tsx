"use client";
import {useState,useRef} from "react";
import Link from "next/link";
import JournalPraMap from "../../features/journal/ui/pra-map";
import {initialMapIndex} from "./initial-map-index";
export type ArchivedMap = {id:string;caption:string;phenomenon:string;period:[string,string];cycle:string;source:string};
export function DailyMapsCarousel({slides,editionId,initialMapId}:{slides:ArchivedMap[];editionId:string;initialMapId?:string}) {
  const [index,setIndex]=useState(()=>initialMapIndex(slides,initialMapId));
  const touchX=useRef<number|null>(null);
  const slide=slides[index];
  const move=(delta:number)=>setIndex(i=>(i+delta+slides.length)%slides.length);
  if (!slide) return <section className="ux01-map-frame" role="status"><h2>Pas de carte archivée compatible</h2><p>La sélection éditoriale sera affichée lorsque des cartes scientifiquement qualifiées seront disponibles. Aucune représentation fictive n’est utilisée.</p><Link href="/climat">Explorer les cartes climatiques disponibles</Link></section>;
  return <section aria-label="Carrousel des cartes de cette édition" className="ux01-maps-carousel">
    <div className="ux01-carousel-controls">
      <button type="button" onClick={()=>move(-1)} aria-label="Carte précédente">← Précédente</button>
      <strong aria-live="polite">{index+1} / {slides.length}</strong>
      <button type="button" onClick={()=>move(1)} aria-label="Carte suivante">Suivante →</button>
    </div>
    <div className="ux01-map-frame" tabIndex={0} role="group" aria-roledescription="diapositive" aria-label={`Carte ${index+1} sur ${slides.length}`}
      onKeyDown={e=>{if(e.key==="ArrowRight"){e.preventDefault();move(1)}if(e.key==="ArrowLeft"){e.preventDefault();move(-1)}}}
      onTouchStart={e=>{touchX.current=e.changedTouches[0]?.clientX??null}}
      onTouchEnd={e=>{const start=touchX.current,end=e.changedTouches[0]?.clientX;if(start!==null&&end!==undefined&&Math.abs(end-start)>50)move(end<start?1:-1);touchX.current=null}}>
      <h2>{slide.caption||"Carte archivée"}</h2>
      <p className="ux01-map-caption">Période d’origine : {slide.period[0]} – {slide.period[1]} · Prévision archivée · édition conservée</p>
      <JournalPraMap key={slide.id} run={slide.cycle} phenomenon={slide.phenomenon} period={slide.period} source={slide.source} archiveUrl={`/api/journal/edition-map?id=${encodeURIComponent(editionId)}&map=${encodeURIComponent(slide.id)}`}/>
    </div>
    <div className="ux01-map-dots" aria-label="Choisir une carte">{slides.map((item,i)=><button type="button" aria-current={i===index} aria-label={`Afficher la carte ${i+1}`} key={item.id} onClick={()=>setIndex(i)}>{i+1}</button>)}</div>
    <p><Link href="/climat?temporal=forecast">Ouvrir l’explorateur climatique</Link> · <Link href="/journal">Revenir au Journal</Link></p>
  </section>;
}
