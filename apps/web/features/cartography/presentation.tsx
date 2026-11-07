'use client';
import {useState,type ComponentProps,type ReactNode} from 'react';
import NationalMap from '../national/map';
interface Presentation {title:ReactNode;legend:ReactNode;map:ComponentProps<typeof NationalMap>}
export function MapPresentation({identity,loading,error,presentation}:{identity:string;loading:boolean;error:string|null;presentation:Presentation}){
 const [committed,setCommitted]=useState<{identity:string;presentation:Presentation}|null>(null);
 const usable=!loading&&!error;
 if(usable&&committed?.identity!==identity)setCommitted({identity,presentation});
 const shown=loading&&committed?committed.presentation:presentation;
 return <>{shown.title}<NationalMap {...shown.map} loading={loading}/>{loading&&committed&&<p role="status">Sélection précédente conservée pendant la lecture. Titre, légende et valeurs seront remplacés ensemble.</p>}{shown.legend}</>;
}
