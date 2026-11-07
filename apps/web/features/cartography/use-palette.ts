
'use client';
import {useEffect,useState} from 'react';
import type {Palette} from './registry';
export function usePaletteColors(palette:Palette){
 const key=palette.tokens.join(',');
 const [colors,setColors]=useState<string[]>([]);
 useEffect(()=>{
 const read=()=>{const css=getComputedStyle(document.documentElement);setColors(key.split(',').map(t=>css.getPropertyValue(t).trim()));};
 const frame=requestAnimationFrame(read),observer=new MutationObserver(read);
 observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 return()=>{cancelAnimationFrame(frame);observer.disconnect();};
 },[key]);
 return colors.length?colors:palette.tokens.map(()=> 'transparent');
}
