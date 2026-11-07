import Link from "next/link";
import type { Contribution } from "../registry";
import type { JournalEdition, EditorialEvent, RegionalSection } from "../model";
import { phenomenonLabel } from "./visualizations";
export function frenchDate(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}
export function StoryText({
  story,
  edition,
}: {
  story: EditorialEvent;
  edition: JournalEdition;
}) {
  return (
    <>
      <p className="eyebrow">{story.region}</p>
      {story.facts.map((id) => (
        <p key={id}>{edition.evidence.facts.find((f) => f.id === id)?.text}</p>
      ))}
      <Link href={story.href}>Voir les données et les preuves</Link>
    </>
  );
}
export function ProductionStoryCard({ section }: { section: Contribution }) {
  const indicators = section.indicators.filter(
    (i) =>
      i.qualified &&
      i.publishable &&
      i.status === "available" &&
      i.facts?.length,
  );
  return (
    <article
      className={
        indicators.length ? "production-story" : "production-story quiet"
      }
    >
      <p className="eyebrow">{section.family}</p>
      <h3>{section.label}</h3>
      {indicators.length ? (
        indicators.flatMap((i) =>
          i.facts!.map((f) => (
            <p key={f.id}>
              {f.text} <Link href={f.href}>Voir les données</Link>
            </p>
          )),
        )
      ) : (
        <p>Pas encore de fait agroclimatique qualifié pour cette édition.</p>
      )}
      <Link href={section.href}>Explorer la filière</Link>
      <details>
        <summary>Contexte et disponibilité</summary>
        <p>{section.limits}</p>
        <p>
          Présence déclarée : {section.declared_pra_count ?? "non documentée"}
          {section.declared_pra_count !== null ? " PRA" : ""} · millésime{" "}
          {section.year ?? "non disponible"}. Source : {section.source}.
        </p>
        {section.indicator_inventory?.map((i) => (
          <p key={i.id}>
            {i.id} · {i.status} · {i.qualified ? "qualifié" : "non qualifié"} ·{" "}
            {i.limits}
          </p>
        ))}
      </details>
    </article>
  );
}
export function RegionStory({ section }: { section: RegionalSection }) {
  const c = [...section.coverage]
    .filter((c) => c.evaluated > 0)
    .sort((a, b) => b.affected - a.affected)[0];
  return (
    <article className="region-story">
      <p className="eyebrow">ÉCLAIRAGE RÉGIONAL</p>
      <h3>{section.label}</h3>
      {c && c.affected > 0 ? (
        <>
          <p>{phenomenonLabel(c.phenomenon)}</p>
          <p className="region-number">
            {c.affected}
            <span> / {c.evaluated} PRA évaluables</span>
          </p>
        </>
      ) : (
        <p>{section.summary}</p>
      )}
      <p className="muted">
        {section.total_pra} petites régions agricoles dans le périmètre.
      </p>
      <Link href={section.href}>Lire la situation régionale</Link>
    </article>
  );
}
