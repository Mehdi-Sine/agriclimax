import { TerritorialWatchSection } from "../agro-territorial/section";
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
const fieldQuestions: Record<string, string> = {
  field_peak_rain5: "Si une intervention est envisagée, quels sols ont suffisamment ressuyé pour porter le matériel ? La texture et le drainage modulent le ressuyage.",
  field_antecedent_rain: "Quel ressuyage vérifier avant d’intervenir ? La texture et le drainage influencent la portance.",
  field_frost: "Quels stades et quelles expositions vérifier ? La sensibilité au froid varie avec la variété, le stade et la durée du gel.",
  field_dry_sequence: "Quelle humidité vérifier dans le lit de semences ? Les réserves initiales et l’irrigation modifient l’eau disponible.",
};

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
          <a href="#sources" aria-label={`${unresolved.length ? "[sources résolues]" : "[sources]"} : consulter les preuves`}>
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
  const selection=a?.map_selection;
  const selectedMaps=selection ? ("map_ids" in selection ? selection : {hero_map_id:selection.response.hero_map_id,map_ids:[...selection.response.priority,...selection.response.complementary].map(c=>c.map_id)}) : undefined;
  const articleMaps = editionMaps && {
    ...editionMaps,
    maps: selectedMaps?.map_ids.length
      ? selectedMaps.map_ids.flatMap(id => editionMaps.maps.filter(map => map.id === id))
      : selectedMaps ? [] : editionMaps.maps,
  };
  const seasonal = d?.article.find(block =>
    (block.kind === "question" || block.kind === "context") && block.seasonal_ids.some(id => a?.briefing.seasonal.windows.some(window => window.id === id)),
  );
  const takeaways = d?.article.filter(block => block !== seasonal && block.kind === "fact").slice(0, 3) ?? [];
  const remaining = d?.article.filter(block => block !== seasonal && !takeaways.includes(block));

  const agroField = [...(a?.briefing.agro_field ?? [])];
  if (articleMaps?.maps[0]?.indicator === "frost") {
    agroField.sort((lhs, rhs) => Number(rhs.indicator === "field_frost") - Number(lhs.indicator === "field_frost"));
  }
  const cycles=[...new Set(a?.briefing.national.facts.flatMap(f=>{try{const cycle=new URL(f.href,"https://agriclimax.invalid").searchParams.get("cycle");return cycle&&Number.isFinite(Date.parse(cycle))?[cycle]:[];}catch{return [];}})??[])];
  const base=personalStatus?"/journal/personnel":published?"/journal":"/journal/preview";
  const api=personalStatus?"/api/journal/personnel":published?"/api/journal/edition":"/api/journal-preview";
  const mapsBase=personalStatus?"/journal/personnel":published?"/cartes-du-jour":"/journal/preview";
  const mapApi=personalStatus?"/api/journal/personnel/map":published?"/api/journal/edition-map":"/api/journal-preview/map";
  return (
    <>
      <EditorialHeader active="journal"/>
    <main className="journal ux01-journal ux02b-journal journal-edition">
      <div className="ux01-edition-meta"><span>{a?`ÉDITION DU ${frenchDate(a.date)}`:"ARCHIVES DU JOURNAL"}</span><span>France métropolitaine & Corse · {published?"Journal IA":personalStatus?"Espace personnel":"Prévisualisation"}</span></div>

      {!a || !d ? (
        <section className="empty-story">
          <h1>{personalStatus?"Aucun brouillon IA vérifié à cette date":"Aucune édition archivée à cette date"}</h1>
          <p>Choisissez une édition disponible dans les archives.</p>
        </section>
      ) : (
        <>
          <p className="edition-status">
            {a.mode === "simulation" ? "Simulation éditoriale sur archives"
              : a.mode === "fallback" ? "Édition de secours · Rédaction déterministe"
              : "Rédigé avec assistance IA"}
            {personalStatus ? ` · ${personalStatus}` : published ? " · Édition expérimentale" : " · Revue éditoriale requise"}
          </p>
          <section className="front-page" aria-labelledby="headline">
            <div className="hero-copy">
              <p className="eyebrow">À LA UNE · FRANCE</p>
              <h1 id="headline">{editorialText(d.headline.text)}</h1>
              <div className="standfirst">
                <Text facts={a.briefing.national.facts} block={d.lead} />
              </div>
            </div>
            <div className="edition-hero-map" id="carte">
            {articleMaps?.maps.length ? <EditionMaps key={a.edition_id} view={articleMaps} editionId={a.edition_id} initialMapId={selectedMaps?.hero_map_id ?? undefined} main/> : a.illustrations.some(m=>d.illustration_ids.includes(m.id)) ? (
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
              articleMaps ? <EditionMaps view={articleMaps} editionId={a.edition_id} main/> : <aside className="empty-story">
                <p className="eyebrow">LA CARTE DU DOSSIER</p>
                <h2>Aucune carte compatible archivée</h2>
                <p>
                  Aucune carte compatible n’a été archivée pour cette édition.
                  Aucune carte actuelle ne lui est substituée.
                </p>
              </aside>
            )}
            </div>
          </section>
          <section className="edition-takeaways" aria-labelledby="essentiel">
            <h2 id="essentiel">Ce qu’il faut retenir</h2>
            {takeaways.length > 0 && <ol>{takeaways.map((block, i) =>
              <li key={i}><Text facts={a.briefing.national.facts} block={block}/></li>,
            )}</ol>}
            {remaining?.filter(block => block.kind !== "limitation").map((block, i) =>
              <Text key={i} facts={a.briefing.national.facts} block={block}/>,
            )}
            <p className="edition-links">
              <a href="#carte">Carte et territoires</a>
              <Link href={`${mapsBase}?date=${a.date}&id=${a.edition_id}`}>Toutes les cartes</Link>
            </p>
            {d.key_figures.length > 0 && <div className="key-facts">
              {d.key_figures.slice(0,3).map((f) => (
                <article key={f.fact_id}>
                  <p className="eyebrow">
                    {f.nature === "forecast" ? "PRÉVISION" : f.nature === "reanalysis" ? "RÉANALYSE" : "INDICATEUR DESCRIPTIF"} · {f.region ?? "France"}
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
                  <Link href={a.briefing.national.facts.find(source => source.id === f.fact_id)?.href ?? "#sources"}>Détail de l’indicateur</Link>
                </article>
              ))}
            </div>}
          </section>
          {!published && "territorial_watch" in a.briefing &&
            <TerritorialWatchSection situations={a.briefing.territorial_watch ?? []}
              returnTo={`${base}?date=${a.date}&id=${a.edition_id}#productions-surveillance`} />}
          <section id="regions">
            <h2>Tour des régions</h2>
            <div className="region-grid">
              {d.regions.map((r) => (
                <article key={r.region}>
                  <h3>{r.region}</h3>
                  {r.blocks.map((b, i) => (
                    <Text facts={a.briefing.national.facts} key={i} block={b} />
                  ))}
                  {(() => {
                    const fact = a.briefing.national.facts.find(f =>
                      r.blocks.some(block => block.evidence_ids.includes(f.id)) && f.href.startsWith("/veille?"),
                    );
                    return fact && <Link href={fact.href}>Explorer le signal territorial</Link>;
                  })()}
                </article>
              ))}
            </div>
          </section>
          <section id="filieres">
            <h2>Le regard agricole</h2>
            {d.productions.length > 0 && <div className="production-grid">
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
            </div>}
            {agroField.length ? (
              <div className="edition-field">
                <p>ERA5-Land · Réanalyse {frenchPeriod(agroField[0].period.start, agroField[0].period.end)}. Les productions citées proviennent des déclarations historiques au RPG 2025.</p>
                {agroField.map((summary, i) => {
                  const content = <article key={summary.indicator}>
                    {i === 0 && <h3>{summary.label}</h3>}
                    <p>{fieldQuestions[summary.indicator]}</p>
                    <p>Maximum territorial de {summary.maximum?.toLocaleString("fr-FR", {maximumFractionDigits: 2})} {summary.unit} sur {summary.evaluable_pra} PRA évaluables sur {summary.total_pra}.</p>
                    {summary.territories.length > 0 && <ul>{summary.territories.map(territory => (
                      <li key={territory.id}>
                        <Link prefetch={false} href={`/analyse?${new URLSearchParams({
                          production: "field", agro: summary.indicator, agro_start: summary.period.start,
                          agro_end: summary.period.end, pra: territory.id,
                          retour: `${base}?date=${a.date}&id=${a.edition_id}#filieres`,
                        })}`}>{territory.name}</Link>
                        {territory.productions.length > 0 && ` · ${territory.productions.map(production => production.label).join(", ")}`}
                      </li>
                    ))}</ul>}
                  </article>;
                  return i === 0 ? content : <details key={summary.indicator}><summary>{summary.label}</summary>{content}</details>;
                })}
              </div>
            ) : !d.productions.length && (
              <p>Aucun éclairage de filière suffisamment documenté.</p>
            )}
          </section>
          {seasonal && <section id="almanach" aria-labelledby="almanach-title">
            <h2 id="almanach-title">L’Almanach</h2>
            <Text facts={a.briefing.national.facts} block={seasonal}/>
            <Link href="/almanach">Consulter les repères saisonniers</Link>
          </section>}
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
            <h2>Pour aller plus loin</h2>
            {published && <details>
              <summary>Réserves et validation éditoriale</summary>
              <p>Édition expérimentale — Les analyses présentées sont produites automatiquement à partir de données météorologiques et de modèles de prévision.</p>
              <p>Édition expérimentale IA — contenu non entièrement vérifié.</p>
              <p>Contrôles enregistrés : {a.validation.errors.join(" · ") || "aucune erreur détectée"}.</p>
              {"assessment" in a && <p>Réexamen actuel : {[...a.assessment.errors, ...a.assessment.review].join(" · ") || "aucune réserve automatique"}.</p>}
            </details>}
            <p>Les stations fournissent des observations. ERA5-Land fournit une réanalyse et les modèles fournissent des prévisions. Les indicateurs décrivent un signal météorologique. Les situations agricoles potentielles appellent une vérification à la parcelle. Un impact avéré exige un constat de terrain.</p>
            {a.briefing.agro_field?.length ? <p>Les décomptes AGRO-05 excluent les supports partiels. Chaque PRA évaluable compte une fois.</p> : null}
            {cycles.length>0&&<p>Cycles de prévision : {cycles.map(frenchCycle).join(" · ")}.</p>}
            <p>Historique disponible jusqu’au {frenchDate(a.briefing.validity.history_cutoff)}. {a.briefing.validity.forecast_period && ` Prévisions ${frenchPeriod(...a.briefing.validity.forecast_period)}.`}</p>
            {[...d.limitations, ...(remaining?.filter(block => block.kind === "limitation") ?? [])].map((b, i) => (
              <Text facts={a.briefing.national.facts} key={i} block={b} />
            ))}
            <details>
              <summary>Sources, méthode et arbitrages</summary>
              <Text facts={a.briefing.national.facts} block={d.decision}/>
              {d.alternatives.map(item => <Text key={item.candidate_id} facts={a.briefing.national.facts} block={item.reason}/>)}
              {a.briefing.agro_field?.map(summary => <p key={summary.indicator}>{summary.label}. {summary.limitations[0]}</p>)}
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
              Climacta <span>Le Journal agroclimatique</span>
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
    </>
  );
}
