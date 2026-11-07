import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isJournalRun } from "../../features/journal/query";
import { journal } from "../../lib/server/journal";
import type { JournalEdition } from "../../features/journal/model";
import {
  RegionalMap,
  RegionalChart,
} from "../../features/journal/ui/visualizations";
import {
  frenchDate,
  StoryText,
  ProductionStoryCard,
  RegionStory,
} from "../../features/journal/ui/stories";
import "./journal.css";
export const dynamic = "force-dynamic";
async function JournalContent({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  if (run !== undefined && !isJournalRun(run)) notFound();
  let edition: JournalEdition;
  try {
    edition = await journal(run);
  } catch {
    return (
      <main className="journal">
        <p className="eyebrow">AgriclimaX · Le Journal</p>
        <h1>Le Journal agroclimatique</h1>
        <p role="alert">
          Archives nationales vérifiées momentanément indisponibles. Aucune
          édition de substitution.
        </p>
        <Link href="/journal">Réessayer</Link> ·{" "}
        <Link href="/veille">Veille nationale</Link>
      </main>
    );
  }
  const story = edition.main_story,
    focus = edition.regional_sections
      .filter((r) => edition.regional_focus_ids.includes(r.id))
      .slice(0, 3);
  const period = story?.period ?? edition.evidence.facts[0]?.period;
  const references = [
    ...edition.key_facts,
    ...edition.evidence.facts.filter(
      (f) => !edition.key_facts.some((k) => k.id === f.id),
    ),
  ];
  const freshness = {
    fresh: "Cycle récent",
    stale: "Cycle ancien · prévisions à consulter avec réserve",
    expired: "Prévisions expirées · lecture d’archive",
  }[edition.data_freshness];
  return (
    <main className="journal">
      <a className="journal-skip" href="#une">
        Aller à la une
      </a>
      <header className="masthead">
        <div className="edition-strip">
          <span>ÉDITION DU {frenchDate(edition.edition_date)}</span>
          <span>France métropolitaine & Corse · Prévisualisation</span>
        </div>
        <div className="masthead-title">
          <Link
            href="/journal"
            aria-label="AgriclimaX — Le Journal agroclimatique"
          >
            AgriclimaX<span>Le Journal agroclimatique</span>
          </Link>
          <p>
            Le climat en perspective.
            <br />
            L’agriculture en contexte.
          </p>
        </div>
        <nav aria-label="Espaces produit">
          <Link href="/journal" aria-current="page">
            Le Journal
          </Link>
          <Link href="/">Climat</Link>
          <a href="#filieres">Productions agricoles</a>
          <Link href="/analyse">Analyse agroclimatique</Link>
          <a href="#sources">Sources & méthodes</a>
        </nav>
      </header>
      <div className={`freshness freshness-${edition.data_freshness}`}>
        <span>{freshness}</span>
        <span>Cycle du {frenchDate(edition.source_cycles[0])} · UTC</span>
      </div>
      <section id="une" className="front-page" aria-labelledby="headline">
        <div className="hero-copy">
          <p className="eyebrow">À LA UNE · FRANCE</p>
          <h1 id="headline">
            {edition.headline.replace(": le point en", " en")}
          </h1>
          <p className="standfirst">
            {story
              ? `Des critères météorologiques sont franchis dans les prévisions, notamment en ${story.region}. La carte compare leur répartition régionale. Aucun dommage agricole ni tendance observée n’est déduit.`
              : edition.lead}
          </p>
          {period && (
            <p className="period">
              Prévisions du <strong>{frenchDate(period[0])}</strong> au{" "}
              <strong>{frenchDate(period[1])}</strong>
            </p>
          )}
          <Link className="read-link" href={story?.href ?? "/veille"}>
            Approfondir dans la veille nationale
          </Link>
        </div>
        {story ? (
          <RegionalMap
            regions={edition.regional_sections}
            phenomenon={story.phenomenon}
          />
        ) : (
          <aside className="empty-story">
            <p className="eyebrow">UNE LECTURE À NUANCER</p>
            <h2>Pas de signal à mettre en carte</h2>
            <p>
              {edition.headline}. L’absence de fait saillant ne signifie pas une
              absence de risque agricole.
            </p>
            <a href="#regions">Consulter la couverture régionale</a>
          </aside>
        )}
      </section>
      <section className="key-facts" aria-label="Les faits essentiels">
        {edition.key_facts.slice(0, 3).map((f, i) => (
          <article key={f.id}>
            <p className="eyebrow">
              {f.text.includes("Minimum territorial")
                ? "MINIMUM TERRITORIAL"
                : f.text.includes("Maximum territorial")
                  ? "MAXIMUM TERRITORIAL"
                  : `FAIT ${String(i + 1).padStart(2, "0")}`}
            </p>
            <strong>
              {new Intl.NumberFormat("fr-FR", {
                maximumFractionDigits: 1,
              }).format(f.value)}{" "}
              <span>{f.unit}</span>
            </strong>
            <p>{f.text}</p>
            <a
              href={`#reference-${f.id}`}
              aria-label={`Source du fait ${i + 1}`}
            >
              [{i + 1}] Voir la source
            </a>
          </article>
        ))}
        {!edition.key_facts.length && (
          <p>
            Aucun fait saillant publiable. Les données et leur couverture
            restent consultables ci-dessous.
          </p>
        )}
      </section>
      <section className="understand" aria-labelledby="understand">
        <div className="article-column">
          <p className="eyebrow">DÉCRYPTAGE · 3 MINUTES</p>
          <h2 id="understand">Comprendre la situation</h2>
          {story ? (
            <StoryText story={story} edition={edition} />
          ) : (
            <p>{edition.lead}</p>
          )}
          <h3>Ce que ces prévisions permettent de dire</h3>
          <p>
            Les critères décrivent des phénomènes météorologiques à l’échelle
            des petites régions agricoles (PRA). Le graphique compare leur
            répartition régionale, sur les seules PRA évaluables.
          </p>
          <h3>Ce qu’il faut garder en perspective</h3>
          <p>
            Un franchissement de critère ne mesure ni les dommages ni les
            rendements. La présence déclarée d’une production ne renseigne pas
            son stade ou sa sensibilité actuelle.
          </p>
          <aside className="editorial-note">
            <strong>Et l’évolution ?</strong>
            <p>
              L’historique comparable ne permet pas encore d’affirmer une
              tendance observée ou la continuité d’un épisode. À surveiller :
              les prochains cycles et leur couverture, dans la veille nationale.
            </p>
          </aside>
        </div>
        {story && (
          <RegionalChart
            regions={edition.regional_sections}
            phenomenon={story.phenomenon}
          />
        )}
      </section>
      {edition.secondary_stories.length > 0 && (
        <section className="also" aria-labelledby="also">
          <h2 id="also">Également dans les prévisions</h2>
          <div className="secondary-grid">
            {edition.secondary_stories.map((s) => (
              <article key={s.id}>
                <StoryText story={s} edition={edition} />
              </article>
            ))}
          </div>
        </section>
      )}
      <section id="filieres" aria-labelledby="filieres-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">L’AGRICULTURE EN CONTEXTE</p>
            <h2 id="filieres-title">Dans les filières</h2>
          </div>
          <p>Des faits publiés à mesure que les indicateurs sont qualifiés.</p>
        </div>
        <div className="production-grid">
          {edition.production_sections.map((s) => (
            <ProductionStoryCard key={s.id} section={s} />
          ))}
        </div>
      </section>
      <section id="regions" aria-labelledby="regions-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">AU PLUS PRÈS DES TERRITOIRES</p>
            <h2 id="regions-title">Le tour des régions</h2>
          </div>
          <p>Des prévisions, sans présumer des conséquences agricoles.</p>
        </div>
        <div className="region-grid">
          {focus.map((r) => (
            <RegionStory key={r.id} section={r} />
          ))}
        </div>
        <details className="all-regions">
          <summary>
            Consulter les {edition.regional_sections.length} régions
          </summary>
          <div className="region-grid">
            {edition.regional_sections.map((r) => (
              <RegionStory key={r.id} section={r} />
            ))}
          </div>
        </details>
      </section>
      <footer id="sources">
        <p className="eyebrow">LA RIGUEUR DERRIÈRE LE RÉCIT</p>
        <h2>Sources & méthodes</h2>
        <p>
          Rédaction déterministe, sans IA. Prévisions uniquement ; dénombrements
          de PRA, sans moyenne régionale ni surface affectée.
        </p>
        <details>
          <summary>Consulter les preuves, la fraîcheur et les limites</summary>
          <p>
            Acquisition : {edition.data_cutoff} · Génération :{" "}
            {edition.generated_at} · dates UTC.
          </p>
          {edition.limitations.map((l) => (
            <p key={l}>{l}</p>
          ))}
          <ol>
            {references.map((f) => (
              <li id={`reference-${f.id}`} key={f.id}>
                <p>
                  {f.text} · du {frenchDate(f.period[0])} au{" "}
                  {frenchDate(f.period[1])} ·{" "}
                  <Link href={f.href}>Voir les données</Link>
                </p>
                <details>
                  <summary>Traçabilité du fait</summary>
                  <p>
                    Source : {f.source} · règle : {f.rule_version}
                  </p>
                  <p>{f.provenance.join(" · ")}</p>
                  <p>
                    {f.quality_flags.join(" · ") ||
                      "Aucun drapeau supplémentaire"}{" "}
                    · {f.data_freshness.join(" · ")}
                  </p>
                </details>
              </li>
            ))}
          </ol>
          <p>Édition : {edition.edition_id}</p>
          <p>{edition.provenance.join(" · ")}</p>
          <Link
            href={`/api/journal${run ? `?run=${encodeURIComponent(run)}` : ""}`}
          >
            Dossier de preuves JSON de cette édition
          </Link>
        </details>
        <p className="footer-brand">
          AgriclimaX <span>Le Journal agroclimatique</span>
        </p>
      </footer>
    </main>
  );
}

export default function Page(props: {
  searchParams: Promise<{ run?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="journal" aria-busy="true">
          <p className="eyebrow">AgriclimaX · Le Journal</p>
          <h1>Le Journal agroclimatique</h1>
          <p role="status">
            Préparation de l’édition à partir des archives vérifiées…
          </p>
        </main>
      }
    >
      <JournalContent {...props} />
    </Suspense>
  );
}
