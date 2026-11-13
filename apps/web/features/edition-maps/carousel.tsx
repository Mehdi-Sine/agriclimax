"use client";
import Link from "next/link";
import Image from "next/image";
import {useEffect, useId, useRef, useState, type KeyboardEvent} from "react";
import type {JournalMapCard} from "./carousel-model";
import {semanticPalette, classLabel} from "../cartography/registry";

function Thumbnail({card, priority}: {card: JournalMapCard; priority: boolean}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (image.current?.complete) setState(image.current.naturalWidth ? "ready" : "error");
  }, []);
  return <div className="journal-thumbnail" data-state={state} aria-busy={state === "loading"}>
    {state !== "error" && <Image unoptimized ref={image} src={card.thumbnail_url} width={480} height={300} alt={`Carte PRA · ${card.title} · ${card.caption}`} loading="eager" fetchPriority={priority ? "high" : "low"} decoding="async" onLoad={() => setState("ready")} onError={() => setState("error")}/>}
    {state !== "ready" && <span className="journal-thumbnail-status" role="status">{state === "error" ? "Aperçu indisponible · ouvrir la carte interactive →" : "Chargement de l’aperçu…"}</span>}
  </div>;
}
function CardLegend({card}: {card: JournalMapCard}) {
  const m = card.info, days = (Date.parse(m.period[1]) - Date.parse(m.period[0])) / 86400000 + 1;
  const palette = semanticPalette(m.indicator, m.unit, days);
  return <div className="journal-card-legend" aria-label={`Légende · ${m.unit}`}>
    <div className="journal-card-ramp">{palette.bounds.map((_, i) => <span key={i}><i aria-hidden="true" style={{background: `var(${palette.tokens[i]})`}}/>{classLabel(palette, i)}</span>)}</div>
    <p>{m.unit} · {palette.meaning}.</p>
    <p><i className="journal-missing-key" aria-hidden="true"/> Gris : non évaluable · <i className="journal-partial-key" aria-hidden="true"/> Hachures : support partiel.</p>
  </div>;
}
export function JournalMapCarousel({cards, preview = false}: {cards: JournalMapCard[]; preview?: boolean}) {
  const id = useId(), track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0), [end, setEnd] = useState(false);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const update = () => {
      const nodes = Array.from(el.children) as HTMLElement[];
      const distances = nodes.map(n => Math.abs(n.getBoundingClientRect().left - el.getBoundingClientRect().left));
      setIndex(distances.indexOf(Math.min(...distances)));
      setEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
    };
    update();
    const observer = new ResizeObserver(update); observer.observe(el);
    el.addEventListener("scroll", update, {passive: true});
    return () => {observer.disconnect(); el.removeEventListener("scroll", update);};
  }, [cards.length]);
  const move = (target: number, focus = false) => {
    const el = track.current, node = el?.children[Math.max(0, Math.min(cards.length - 1, target))] as HTMLElement | undefined;
    if (!el || !node) return;
    el.scrollTo({left: node.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
    if (focus) node.querySelector("a")?.focus({preventScroll: true});
  };
  const keyboard = (e: KeyboardEvent<HTMLUListElement>) => {
    const focused = Array.from(track.current?.children ?? []).findIndex(n => n.contains(document.activeElement));
    const current = focused >= 0 ? focused : index;
    const target = e.key === "ArrowRight" ? current + 1 : e.key === "ArrowLeft" ? current - 1 : e.key === "Home" ? 0 : e.key === "End" ? cards.length - 1 : null;
    if (target !== null) {e.preventDefault(); move(target, true);}
  };
  if (!cards.length) return <section className="journal-map-carousel" role="status"><h2>Les cartes de l’édition</h2><p>Aucune miniature disponible. Les archives et l’article restent consultables.</p></section>;
  return <section className="journal-map-carousel" aria-labelledby={`${id}-title`} aria-roledescription="carrousel">
    <div className="journal-carousel-heading">
      <div><p className="eyebrow">L’ESSENTIEL EN CARTES</p><h2 id={`${id}-title`}>Les cartes de l’édition</h2></div>
      <div className="journal-carousel-controls">
        <button type="button" aria-label="Cartes précédentes" aria-controls={`${id}-track`} disabled={index === 0} onClick={() => move(index - 1)}>←</button>
        <span aria-live="polite" aria-atomic="true">{index + 1} / {cards.length}</span>
        <button type="button" aria-label="Cartes suivantes" aria-controls={`${id}-track`} disabled={end} onClick={() => move(index + 1)}>→</button>
      </div>
    </div>
    {preview && <p className="freshness" role="status">RECETTE · Cartes candidates réelles, non publiées. Qualification et revue humaine requises.</p>}
    <p id={`${id}-help`} className="journal-carousel-help">Faites défiler les cartes ou utilisez les flèches. Au clavier : ← →, Début et Fin. Ouvrez une carte pour explorer les PRA.</p>
    <ul ref={track} id={`${id}-track`} className="journal-carousel-track" aria-describedby={`${id}-help`} onKeyDown={keyboard}>
      {cards.map((card, i) => <li key={card.map_id} className="journal-map-card" data-map-id={card.map_id}>
        <Link href={card.interactive_url} prefetch={false} className="journal-map-card-link">
          <Thumbnail card={card} priority={i < 2}/>
          <div className="journal-map-card-copy"><span className="eyebrow">{card.info.nature === "forecast" ? "PRÉVISION" : "HISTORIQUE · RÉANALYSE"}</span><h3>{card.title}</h3><p>{card.info.period.join(" → ")}</p><span className="journal-card-open">Explorer la carte PRA →</span></div>
        </Link>
        <CardLegend card={card}/>
      </li>)}
    </ul>
    <p className="journal-carousel-note">Cartes de contexte de cette édition · PRA, dont la Corse · périodes d’origine conservées. Classes descriptives, sans dommage agricole déduit.</p>
  </section>;
}
