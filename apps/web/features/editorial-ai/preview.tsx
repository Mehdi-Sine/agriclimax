import Link from "next/link";
import {PRODUCTIONS} from "../multiproduction/registry";
import {EditorialHeader} from "../../components/navigation/editorial-header";
import type { Archive, Block } from "./model";
import type {ConsultableEdition} from "./consultable";
import { frenchDate } from "../journal/ui/stories";
import { editorialText, frenchPeriod, frenchCycle } from "../journal/ui/editorial-dates";
import JournalPraMap from "../journal/ui/pra-map";
import {EditionMaps} from "../edition-maps/view";
import type {EditionMapsView} from "../edition-maps/model";
function Text({ block, facts }: { block: Block; facts: {id:string}[] }) {
  const unresolved=block.evidence_ids.filter(id=>!facts.some(f=>f.id===id));
  const resolved=block.evidence_ids.some(id=>facts.some(f=>f.id===id));
  return (
    <p>
      {editorialText(block.text)}
      {unresolved.map(id=><small key={id}> Référence non résolue : <code style={{overflowWrap:"anywhere"}}>{id}</code> (ne constitue pas une preuve).</small>)}
      {resolved && (
        <sup>
          {" "}
          <a href="#sources" aria-label="Consulter les preuves">
            {unresolved.length ? "[sources résolues]" : "[sources]"}
          </a>
        </sup>
      )}
    </p>
  );
}
export function EditorialPreview({
  edition: a,
  editions,
  published = false,
  personalStatus,
  editionMaps,
}: {
  edition: Archive|ConsultableEdition|undefined;
  editions: (Archive|ConsultableEdition)[];
  published?: boolean;
  personalStatus?: string;
  editionMaps?: EditionMapsView;
}) {
  const d = a?.draft;
  const cycles=[...new Set(a?.briefing.national.facts.flatMap(f=>{try{const cycle=new URL(f.href,"https://agriclimax.invalid").searchParams.get("cycle");return cycle&&Number.isFinite(Date.parse(cycle))?[cycle]:[];}catch{return [];}})??[])];
  const base=personalStatus?"/journal/personnel":published?"/journal":"/journal/preview";
  const api=personalStatus?"/api/journal/personnel":published?"/api/journal/edition":"/api/journal-preview";
  const mapsBase=personalStatus?"/journal/personnel":published?"/cartes-du-jour":"/journal/preview";
  const mapApi=personalStatus?"/api/journal/personnel/map":published?"/api/journal/edition-map":"/api/journal-preview/map";
  return (
    <main className="journal ux01-journal">
      <EditorialHeader active="journal"/>
      <div className="ux01-edition-meta"><span>{a?`ÉDITION DU ${frenchDate(a.date)}`:"ARCHIVES DU JOURNAL"}</span><span>France métropolitaine & Corse · {published?"Journal IA":personalStatus?"Espace personnel":"Prévisualisation"}</span></div>
      
      {!a || !d ? (
        <section className="empty-story">
          <h1>{personalStatus?"Aucun brouillon IA vérifié à cette date":"Aucune édition archivée à cette date"}</h1>
          <p>Choisissez une édition disponible dans les archives.</p>
        </section>
      ) : (
        <>
          <aside className="freshness">
            <p>
              {a.mode === "simulation"
                ? "SIMULATION · Texte d’essai rédigé pour la recette, aucune génération OpenAI réelle."
                : a.mode === "fallback"
                  ? "ÉDITION DE SECOURS · Rédaction déterministe."
                  : "Rédigé avec assistance IA."}{" "}
              {personalStatus ? personalStatus : published ? "Édition expérimentale IA — contenu non entièrement vérifié" : "Revue éditoriale requise. Archive historique : ne décrit pas la situation actuelle."}
            </p>
          </aside>
          {published&&<details className="editorial-note"><summary>Réserves scientifiques de cette édition</summary>
            <p>Consultable ne signifie pas scientifiquement validée ou approuvée.</p>
            <p>Contrôles enregistrés : {a.validation.errors.join(" · ")||"aucune erreur détectée"}.</p>
            {"assessment" in a&&<p>Réexamen actuel : {[...a.assessment.errors,...a.assessment.review].join(" · ")||"aucune réserve automatique"}.</p>}
          </details>}
          <section className="front-page" aria-labelledby="headline">
            <div className="hero-copy">
              <p className="eyebrow">À LA UNE · FRANCE</p>
              <h1 id="headline">{editorialText(d.headline.text)}</h1>
              <div className="standfirst">
                <Text facts={a.briefing.national.facts} block={d.lead} />
              </div>
            </div>
            {editionMaps?.maps.length ? <EditionMaps key={a.edition_id} view={editionMaps} editionId={a.edition_id} main/> : a.illustrations.some(m=>d.illustration_ids.includes(m.id)) ? (
              a.illustrations
                .filter((m) => d.illustration_ids.includes(m.id))
                .slice(0,1)
                .map((m) => (
                  <JournalPraMap
                    key={m.id}
                    run={m.cycle}
                    phenomenon={m.phenomenon}
                    period={m.period}
                    source={m.data.source}
                    archiveUrl={`${mapApi}?id=${a.edition_id}&map=${m.id}`}
                  />
                ))
            ) : (
              editionMaps ? <EditionMaps view={editionMaps} editionId={a.edition_id} main/> : <aside className="empty-story">
                <p className="eyebrow">LA CARTE DU DOSSIER</p>
                <h2>Aucune carte compatible archivée</h2>
                <p>
                  Aucune carte compatible n’a été archivée pour cette édition.
                  Aucune carte actuelle ne lui est substituée.
                </p>
              </aside>
            )}
            <aside className="ux01-map-context">
                <p className="eyebrow">LE FAIT MARQUANT</p>
                <h2>Une situation à replacer dans son contexte</h2>
                <Text facts={a.briefing.national.facts} block={d.decision}/>
                <p className="ux01-map-footnote">Les phénomènes météorologiques ne préjugent pas, à eux seuls, de leurs conséquences sur les cultures et les élevages.</p>
                <Link href="/climat">Explorer les indicateurs →</Link>
              </aside>
              <section className="key-facts" aria-label="Les faits essentiels">
              {d.key_figures.slice(0,3).map((f) => (
                <article key={f.fact_id}>
                  <p className="eyebrow">
                    ÉCHANTILLON TERRITORIAL · {f.region ?? "France"}
                  </p>
                  <strong>
                    {new Intl.NumberFormat("fr-FR",{maximumFractionDigits:2}).format(f.value)}
                    <span> {f.unit}</span>
                  </strong>
                  <p>{frenchPeriod(f.period[0], f.period[1])}</p>
                  <p>
                    {
                      a.briefing.national.facts.find(
                        (source) => source.id === f.fact_id,
                      )?.text
                    }
                  </p>
                  <p>
                    Valeur issue du dossier ; aucun effet agricole déduit. Un
                    extrême PRA ne caractérise pas la région.
                  </p>
                </article>
              ))}
            </section>
          </section>
          <section className="ux01-cartes-teasers" aria-labelledby="ux01-carte-title">
              <div className="ux01-teaser-heading">
                <div><p className="eyebrow">L’ESSENTIEL EN CARTES</p><h2 id="ux01-carte-title">Les cartes de l’édition</h2></div>
                <Link href={`${mapsBase}?date=${a.date}&id=${a.edition_id}`}>Toutes les cartes →</Link>
              </div>
              <div className="ux01-teaser-grid">
                {a.illustrations.filter(m=>d.illustration_ids.includes(m.id)).slice(0,3).map(m=>
                  <Link key={m.id} href={`${mapsBase}?date=${a.date}&id=${a.edition_id}&map=${m.id}`} className="ux01-teaser-card">
                    <span className="ux01-teaser-stripe" aria-hidden="true"/>
                    <span className="ux01-kicker">CARTE ARCHIVÉE · {m.period[0]} → {m.period[1]}</span>
                    <h3>{m.caption}</h3>
                    <small>Explorer les données et la légende →</small>
                  </Link>)}
                {editionMaps?.maps.slice(0,3).map(m=><Link key={m.id} href={`${mapsBase}?id=${a.edition_id}&map=${m.id}`} className="ux01-teaser-card"><span className="ux01-kicker">{m.nature==="forecast"?"PRÉVISION":"RÉANALYSE"} · {m.period.join(" → ")}</span><h3>{m.title}</h3><small>{editionMaps.status==="preview"?"Candidate non publiée":"Carte publiée de l’édition"} · {m.unit}</small></Link>)}
                {!editionMaps?.maps.length&&!a.illustrations.some(m=>d.illustration_ids.includes(m.id))&&<p>Cette édition ne comporte pas de carte archivée compatible. Aucune carte récente ne lui est substituée.</p>}
              </div>
            </section>
           <section className="understand">
            <article className="article-column">
              <p className="eyebrow">DÉCRYPTAGE</p>
              <h2>Comprendre la situation</h2>
              {d.article.map((b, i) => (
                <Text facts={a.briefing.national.facts} block={b} key={i} />
              ))}
            </article>
            <aside className="editorial-note">
              <h2>Le choix de la rédaction</h2>
              <Text facts={a.briefing.national.facts} block={d.decision} />
              {d.alternatives.map((x) => (
                <Text facts={a.briefing.national.facts} key={x.candidate_id} block={x.reason} />
              ))}
            </aside>
          </section>
          <section id="filieres">
            <div className="section-heading">
              <div>
                <p className="eyebrow">L’AGRICULTURE EN CONTEXTE</p>
                <h2>Dans les filières</h2>
              </div>
            </div>
            <div className="production-grid">
              {d.productions.map((p) => (
                <article className="production-card" key={p.production_id}>
                  <h3>
                    {PRODUCTIONS.find(production=>production.id===p.production_id)?.label??p.production_id}
                  </h3>
                  {p.blocks.map((b, i) => (
                    <Text facts={a.briefing.national.facts} block={b} key={i} />
                  ))}
                </article>
              ))}
            </div>
            {!d.productions.length && (
              <p>Aucun éclairage de filière suffisamment documenté.</p>
            )}
          </section>
          <section id="regions">
            <div className="section-heading">
              <div>
                <p className="eyebrow">AU PLUS PRÈS DES TERRITOIRES</p>
                <h2>Le tour des régions</h2>
              </div>
            </div>
            <div className="region-grid">
              {d.regions.map((r) => (
                <article key={r.region}>
                  <h3>{r.region}</h3>
                  {r.blocks.map((b, i) => (
                    <Text facts={a.briefing.national.facts} key={i} block={b} />
                  ))}
                </article>
              ))}
            </div>
          </section>
          {d.news_ids.length > 0 && (
            <section>
              <h2>Ce qu’en disent les instituts et la presse agricole</h2>
              {a.briefing.documentary.publications
                .filter((p) => d.news_ids.includes(p.id))
                .map((p) => (
                  <article key={p.id}>
                    <h3>
                      <a
                        href={
                          /^https?:\/\//.test(p.original_url)
                            ? p.original_url
                            : undefined
                        }
                        rel="noreferrer"
                      >
                        {p.title}
                      </a>
                    </h3>
                    <p>
                      {p.publisher} · {p.published_at} · Rapprochement
                      documentaire, sans confirmation scientifique.
                    </p>
                  </article>
                ))}
            </section>
          )}
          
           <footer id="sources">
            <p className="eyebrow">LA RIGUEUR DERRIÈRE LE RÉCIT</p>
            <h2>Sources & méthodes</h2>
            {cycles.length>0&&<p>Cycles de prévision : {cycles.map(frenchCycle).join(" · ")}.</p>}
            <p>Historique disponible jusqu’au {frenchDate(a.briefing.validity.history_cutoff)}. Prévisions : {frenchPeriod(a.briefing.validity.forecast_period?.[0]??a.date,a.briefing.validity.forecast_period?.[1]??a.date)}.</p>
            {d.limitations.map((b, i) => (
              <Text facts={a.briefing.national.facts} key={i} block={b} />
            ))}
            <details>
              <summary>Preuves, Almanach et arbitrages documentaires</summary>
              <p>
                Les rapprochements faibles de T34 sont écartés de la rubrique
                presse.
              </p>
              <p>
                Contrôle : {a.validation.status}.{" "}
                {a.validation.review.join(" · ")}
              </p>
              <p>
                Dossier {a.briefing.bundle_id} · {a.generated_at} UTC ·{" "}
                {"prompt_version" in a?a.prompt_version:"Archive éditoriale consultable"}
              </p>
              <ol>
                {a.briefing.national.facts.map((f) => (
                  <li key={f.id}>
                    <p>{f.text}</p>
                    <p>
                      {f.source} · {f.rule_version} ·{" "}
                      {f.quality_flags.join(" · ")}
                    </p>
                  </li>
                ))}
              </ol>
              {a.briefing.seasonal.windows.map((w) => (
                <p key={w.id}>
                  {w.title} — {w.question} Contexte théorique, à vérifier.
                </p>
              ))}
              <Link href={`${api}?id=${a.edition_id}`}>
                Archive JSON et preuves de cette édition
              </Link>
            </details>
            <p><Link href="/almanach">Almanach agricole</Link> · <Link href="/aide-et-documentation/indicateurs">Définitions des indicateurs</Link></p>
            <p className="footer-brand">
              AgriclimaX <span>Le Journal agroclimatique</span>
            </p>
          </footer>
        </>
      )}
      <section className="editorial-note" aria-label="Archives">
        <h2>{personalStatus ? "Vos brouillons IA archivés" : published ? "Les éditions archivées" : "Les éditions en Preview"}</h2>
        <form action={base}>
          <label htmlFor="edition-date">Choisir une date </label>
          <input
            id="edition-date"
            name="date"
            type="date"
            defaultValue={a?.date}
          />
          <button type="submit">Consulter</button>
        </form>
        <nav aria-label="Éditions archivées">
          {editions.map((e) => (
            <p key={e.edition_id}>
              <Link href={`${base}?date=${e.date}&id=${e.edition_id}`}>
                {frenchDate(e.date)} · Révision {e.revision}
              </Link>
            </p>
          ))}
        </nav>
      </section>
    </main>
  );
}
