import JournalPage from "./journal/page";
import {redirect} from "next/navigation";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const p=await searchParams;
 const q=new URLSearchParams();
 for(const [key,value] of Object.entries(p))if(typeof value==="string")q.set(key,value);
 if(p.mode==="demo")redirect(`/demo?${q}`);
 if(p.mode==="live_meteofrance"||p.mode==="wheat")redirect(`/stations?${q}`);
 if(p.view==="watch")redirect(`/watch?${q}`);
 // Legacy exploratory links retain all climatic query parameters.
 if(["pra","indicateur","temporal","periode","start","production","variable","mode","storage","rule_version","seuil"].some(k=>k in p))redirect(`/climat?${q}`);
 // ?date and ?id now refer to editorial archives.
 return <JournalPage searchParams={Promise.resolve({run:typeof p.run==="string"?p.run:undefined,date:typeof p.date==="string"?p.date:undefined,id:typeof p.id==="string"?p.id:undefined})}/>;
}
