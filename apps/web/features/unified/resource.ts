'use client';
import {useEffect,useState} from 'react';

type Resource<T> = {key:string;data:T|null;error:string|null};
export function useResource<T>(url:string|null, cached=false) {
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{const refreshNow=()=>setRefresh(n=>n+1),timer=setInterval(refreshNow,60000);window.addEventListener('focus',refreshNow);return()=>{clearInterval(timer);window.removeEventListener('focus',refreshNow);};},[]);
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
  },[url,cached,refresh]);
  return result.key===url?result:{key:url??'',data:null,error:null};
}
