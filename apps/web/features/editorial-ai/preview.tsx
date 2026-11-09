import Link from "next/link";
import type { Archive, Block } from "./model";
import { frenchDate } from "../journal/ui/stories";
import { editorialText, frenchPeriod } from "../journal/ui/editorial-dates";
import JournalPraMap from "../journal/ui/pra-map";
function Text({ block }: { block: Block }) {
  return (
    <p>
      {editorialText(block.text)}
      {block.evidence_ids.length > 0 && (
        <sup>
          {" "}
          <a href="#sources" aria-label="Consulter les preuves">
            [sources]
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
}: {
  edition: Archive | undefined;
  editions: Archive[];
  published?: boolean;
  personalStatus?: string;
}) {
  const d = a?.draft;
  const base=personalStatus?"/journal/personnel":published?"/journal":"/journal/preview";
  const api=personalStatus?"/api/journal/personnel":published?"/api/journal/edition":"/api/journal-preview";
  const mapApi=personalStatus?"/api/journal/personnel/map":published?"/api/journal/edition-map":"/api/journal-preview/map";
  return (
    <main className="journal">
      <header className="masthead">
        <div className="edition-strip">
          <span>
            {a ? `ÉDITION DU ${frenchDate(a.date)}` : "ARCHIVES DU JOURNAL"}
          </span>
          <span>France métropolitaine & Corse · {personalStatus ? "Espace personnel" : published ? "Journal IA" : "Preview expérimentale"}</span>
        </div>
        <div className="masthead-title">
          <Link href="/journal">
            AgriclimaX<span>Le Journal agroclimatique</span>
          </Link>
          <p>
            Le climat en perspective.
            <br />
            L’agriculture en contexte.
          </p>
        </div>
        <nav aria-label="Espaces produit">
          <Link href="/journal">Le Journal</Link>
          <Link href="/">Climat</Link>
          <a href="#filieres">Productions agricoles</a>
          <a href="#regions">Régions</a>
          <a href="#sources">Sources & méthodes</a>
        </nav>
      </header>
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
              {personalStatus ? personalStatus : published ? "Édition validée et archivée. Les dates des cycles et les limites figurent dans les preuves." : "Revue éditoriale requise. Archive historique : ne décrit pas la situation actuelle."}
            </p>
          </aside>
          <section className="front-page" aria-labelledby="headline">
            <div className="hero-copy">
              <p className="eyebrow">À LA UNE · FRANCE</p>
              <h1 id="headline">{editorialText(d.headline.text)}</h1>
              <div className="standfirst">
                <Text block={d.lead} />
              </div>
            </div>
            {d.illustration_ids.length ? (
              a.illustrations
                .filter((m) => d.illustration_ids.includes(m.id))
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
              <aside className="empty-story">
                <p className="eyebrow">LA CARTE DU DOSSIER</p>
                <h2>Aucune carte compatible archivée</h2>
                <p>
                  Les preuves de ce replay historique ne contiennent pas de
                  carte qualifiée pour cette période. Aucune carte actuelle ne
                  leur est substituée.
                </p>
              </aside>
            )}
            <section className="key-facts" aria-label="Les faits essentiels">
              {d.key_figures.map((f) => (
                <article key={f.fact_id}>
                  <p className="eyebrow">
                    ÉCHANTILLON TERRITORIAL · {f.region ?? "France"}
                  </p>
                  <strong>
                    {f.value}
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
          <section className="understand">
            <article className="article-column">
              <p className="eyebrow">DÉCRYPTAGE</p>
              <h2>Comprendre la situation</h2>
              {d.article.map((b, i) => (
                <Text block={b} key={i} />
              ))}
            </article>
            <aside className="editorial-note">
              <h2>Le choix de la rédaction</h2>
              <Text block={d.decision} />
              {d.alternatives.map((x) => (
                <Text key={x.candidate_id} block={x.reason} />
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
                    {p.production_id === "wheat"
                      ? "Blé tendre"
                      : p.production_id}
                  </h3>
                  {p.blocks.map((b, i) => (
                    <Text block={b} key={i} />
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
                    <Text key={i} block={b} />
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
            {d.limitations.map((b, i) => (
              <Text key={i} block={b} />
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
                {a.prompt_version}
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
            <p className="footer-brand">
              AgriclimaX <span>Le Journal agroclimatique</span>
            </p>
          </footer>
        </>
      )}
    </main>
  );
}
