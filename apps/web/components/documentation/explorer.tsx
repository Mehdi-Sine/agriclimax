"use client";
import Link from "next/link";
import {useMemo,useState} from "react";
import {documentationTopics} from "./topics";
export function DocumentationExplorer(){
 const [query,setQuery]=useState("");
 const visible=useMemo(()=>{const q=query.trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();return documentationTopics.filter(t=>(t.title+" "+t.body).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().includes(q));},[query]);
 return <>
 <label htmlFor="ux01-doc-search">Rechercher dans la documentation</label>
 <p><input id="ux01-doc-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ex. PRA, données, pluie, limites..." aria-controls="ux01-doc-results"/></p>
 <div className="ux01-doc-layout" id="ux01-doc-results">
 <nav className="ux01-doc-nav" aria-label="Sommaire de la documentation">{visible.map((t,i)=><a key={t.id} href={`#${t.id}`}>{i+1}. {t.title}</a>)}</nav>
 <article className="ux01-doc-article">
 {visible.length===0&&<p role="status">Aucune rubrique ne correspond à cette recherche.</p>}
 {visible.map((t,i)=><section key={t.id} id={t.id}><span className="ux01-doc-number">GUIDE · {String(i+1).padStart(2,"0")}</span><h2>{t.title}</h2><p>{t.body}</p><Link href={t.href}>Consulter la ressource détaillée</Link></section>)}
 </article></div>
 </>;
}
