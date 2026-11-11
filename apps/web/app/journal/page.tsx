import {EditorialHeader} from "../../components/navigation/editorial-header";
import { EditorialPreview } from "../../features/editorial-ai/preview";
import { parisDate } from "../../features/editorial/almanac";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isJournalRun } from "../../features/journal/query";
import { journal } from "../../lib/server/journal";
import type { JournalEdition } from "../../features/journal/model";
import { RegionalChart } from "../../features/journal/ui/visualizations";
import {
  StoryText,
  ProductionStoryCard,
  RegionStory,
} from "../../features/journal/ui/stories";
import JournalPraMap from "../../features/journal/ui/pra-map";
import {
  editorialText,
  frenchCycle,
  frenchPeriod,
} from "../../features/journal/ui/editorial-dates";
import { selectKeyFigures } from "../../features/journal/ui/key-figures";
import { nationalWatch } from "../../lib/server/national-watch";
import type { WatchSummary } from "../../features/national-watch/model";
import "./journal.css";
export const dynamic = "force-dynamic";
export const metadata={robots:{index:false,follow:false}};
async function EditionFigures({
  edition,
  references,
}: {
  edition: JournalEdition;
  references: JournalEdition["key_facts"];
}) {
  let summary: WatchSummary | undefined;
  if (edition.main_story) {
    try {
      summary = await nationalWatch(edition.source_cycles[0]);
    } catch {
      summary = undefined;
    }
  }
  const figures = selectKeyFigures(edition, summary);
  return (
    <section className="key-facts" aria-label="Les faits essentiels">
      {figures.map((figure) => (
        <article key={figure.id}>
          <p className="eyebrow">ÉTENDUE TERRITORIALE · {figure.region}</p>
          <strong>
            {figure.value}
            <span> / {figure.denominator} PRA</span>
          </strong>
          <p>
            {editorialText(figure.label)} en {figure.region}, {figure.period}.
          </p>
          <p className="figure-qualification">
            PRA franchissant le critère / PRA évaluables. Pas une proportion de
            surface agricole.
          </p>
          <a href={`#reference-${figure.factId}`}>
            [{references.findIndex((f) => f.id === figure.factId) + 1}] Voir les
            données et la source
          </a>
        </article>
      ))}
      {!figures.length && (
        <p>
          Aucun chiffre de une suffisamment documenté pour cette édition. Les
          faits disponibles restent accessibles dans l’article et les preuves.
        </p>
      )}
    </section>
  );
}
async function JournalContent({
  searchParams,
}: {
  searchParams: Promise<{ run?: string; date?: string;id?:string }>;
}) {
  const { run, date, id } = await searchParams;
  if(!run) {
    let editions;
    try {
      const { operationalEditions }=await import("../../lib/server/editorial-published");
      editions=await operationalEditions();
    } catch {
      return <main className="journal ux01-journal"><h1>Le Journal agroclimatique</h1><p role="status">Lecture des archives momentanément indisponible.</p></main>;
    }
    const selected=date||id ? editions.find(e=>(!date||e.date===date)&&(!id||e.edition_id===id)) : editions[0];
    const {editionMaps}=await import("../../lib/server/edition-maps");
    const maps=selected?(await editionMaps(selected)).view:undefined;
    return <>{!date && editions[0]?.date!==parisDate(new Date().toISOString()) && <p role="status">L’édition du jour est retardée. La dernière édition consultable conserve sa date réelle.</p>}<EditorialPreview edition={selected} editions={editions} published editionMaps={maps}/></>;
  }
  if (run !== undefined && !isJournalRun(run)) notFound();
  let edition: JournalEdition;
  try {
    edition = await journal(run);
  } catch {
    return (
      <main className="journal ux01-journal">
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
    <main className="journal ux01-journal">
      <a className="journal-skip" href="#une">
        Aller à la une
      </a>
      <EditorialHeader active="journal"/>
      <div className={`freshness freshness-${edition.data_freshness}`}>
        <span>{freshness}</span>
        <span>Cycle du {frenchCycle(edition.source_cycles[0])}</span>
      </div>
      <section id="une" className="front-page" aria-labelledby="headline">
        <div className="hero-copy">
          <p className="eyebrow">À LA UNE · FRANCE</p>
          <h1 id="headline">
            {editorialText(edition.headline.replace(": le point en", " en"))}
          </h1>
          <p className="standfirst">
            {story
              ? `Des critères météorologiques sont franchis dans les prévisions, notamment en ${story.region}. La carte montre les contrastes à la maille des petites régions agricoles. Aucun dommage agricole ni tendance observée n’est déduit.`
              : editorialText(edition.lead)}
          </p>
          {period && (
            <p className="period">
              Prévisions <strong>{frenchPeriod(...period)}</strong>
            </p>
          )}
          <Link className="read-link" href={story?.href ?? "/veille"}>
            Approfondir dans la veille nationale
          </Link>
        </div>
        {story ? (
          <JournalPraMap
            key={`${edition.source_cycles[0]}/${story.phenomenon}/${edition.provenance[0]}`}
            run={edition.source_cycles[0]}
            phenomenon={story.phenomenon}
            period={story.period}
            source={edition.provenance[0]}
          />
        ) : (
          <aside className="empty-story">
            <p className="eyebrow">UNE LECTURE À NUANCER</p>
            <h2>Pas de signal à mettre en carte</h2>
            <p>
              {editorialText(edition.headline)}. L’absence de fait saillant ne
              signifie pas une absence de risque agricole.
            </p>
            <a href="#regions">Consulter la couverture régionale</a>
          </aside>
        )}
        <Suspense
          fallback={
            <section className="key-facts" aria-busy="true">
              <p role="status">Vérification des chiffres de une…</p>
            </section>
          }
        >
          <EditionFigures edition={edition} references={references} />
        </Suspense>
      </section>
      <section className="understand" aria-labelledby="understand">
        <div className="article-column">
          <p className="eyebrow">DÉCRYPTAGE · 3 MINUTES</p>
          <h2 id="understand">Comprendre la situation</h2>
          {story ? (
            <StoryText story={story} edition={edition} />
          ) : (
            <p>{editorialText(edition.lead)}</p>
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
      <section className="ux01-cartes-link"><div><h2>Les cartes du jour</h2><p>Voir les cartes et leurs périodes d’origine.</p></div><Link href="/cartes-du-jour">Voir la sélection →</Link></section>
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
                  {editorialText(f.text)} · {frenchPeriod(...f.period)} ·{" "}
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
        <p>
          <Link prefetch={false} href="/almanach">
            Almanach agricole — repères documentaires
          </Link>
        </p>
        <p className="footer-brand">
          AgriclimaX <span>Le Journal agroclimatique</span>
        </p>
      </footer>
    </main>
  );
}

export default function Page(props: {
  searchParams: Promise<{ run?: string; date?: string;id?:string }>;
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
