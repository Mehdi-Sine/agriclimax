'use client';
import { useRef, useState, type ReactNode } from 'react';

// Only rendered map marks cross this boundary, never a publication or portfolio.
export function MapViewport({children}: {children:ReactNode}) {
  const [box,setBox]=useState({x:0,y:0,width:560});
  const drag=useRef<{x:number;y:number;left:number;top:number;moved:boolean}|null>(null);
  const dragged=useRef(false);
  const move=(dx:number,dy:number)=>setBox(b=>({...b,x:Math.max(-560,Math.min(560,b.x+dx*b.width/560)),y:Math.max(-550,Math.min(550,b.y+dy*b.width/560))}));
  const zoom=(factor:number)=>setBox(b=>{
    const width=Math.max(140,Math.min(560,b.width*factor));
    return {x:b.x+(b.width-width)/2,y:b.y+(b.width-width)*550/1120,width};
  });
  return <div>
    <div className="live-map-controls" role="group" aria-label="Commandes de la carte">
      <button type="button" className="button button-secondary" onClick={()=>zoom(0.5)} disabled={box.width===140}>Agrandir la carte</button>
      <button type="button" className="button button-secondary" onClick={()=>zoom(2)} disabled={box.width===560}>Réduire la carte</button>
      <button type="button" className="button button-secondary" onClick={()=>setBox({x:0,y:0,width:560})}>Recentrer sur la France</button>
      <button type="button" className="button button-secondary" onClick={()=>move(-60,0)}>Déplacer vers l’ouest</button>
      <button type="button" className="button button-secondary" onClick={()=>move(60,0)}>Déplacer vers l’est</button>
      <button type="button" className="button button-secondary" onClick={()=>move(0,-60)}>Déplacer vers le nord</button>
      <button type="button" className="button button-secondary" onClick={()=>move(0,60)}>Déplacer vers le sud</button>
    </div>
    <p id="live-map-help">Agrandissez puis faites glisser la carte, ou utilisez les boutons. Au clavier : flèches pour déplacer, + et − pour zoomer. La liste des stations reste disponible sous la carte.</p>
    <svg className="live-map" viewBox={`${box.x} ${box.y} ${box.width} ${box.width*550/560}`} role="group" tabIndex={0} aria-label="Carte des indicateurs live par station" aria-describedby="live-map-help"
      onKeyDown={e=>{
        if(e.target!==e.currentTarget) return;
        if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key)) e.preventDefault();
        if(e.key==='ArrowLeft') move(-60,0); if(e.key==='ArrowRight') move(60,0);
        if(e.key==='ArrowUp') move(0,-60); if(e.key==='ArrowDown') move(0,60);
        if(e.key==='+') zoom(0.5); if(e.key==='-') zoom(2);
      }}
      onPointerDown={e=>{dragged.current=false;drag.current={x:e.clientX,y:e.clientY,left:box.x,top:box.y,moved:false};}}
      onPointerMove={e=>{
        const d=drag.current;if(!d) return;
        const dx=e.clientX-d.x,dy=e.clientY-d.y;
        if(!d.moved && Math.hypot(dx,dy)<6) return;
        d.moved=true;dragged.current=true;e.currentTarget.setPointerCapture(e.pointerId);
        const scale=box.width/e.currentTarget.getBoundingClientRect().width;
        setBox(b=>({...b,x:Math.max(-560,Math.min(560,d.left-dx*scale)),y:Math.max(-550,Math.min(550,d.top-dy*scale))}));
      }}
      onPointerUp={()=>{drag.current=null;}}
      onPointerCancel={()=>{drag.current=null;}}
      onClickCapture={e=>{if(dragged.current){e.preventDefault();e.stopPropagation();dragged.current=false;}}}>
      <title>France métropolitaine et Corse · points station Météo-France</title>
      {children}
    </svg>
  </div>;
}
