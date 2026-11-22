import Link from "next/link";
import type { Situation } from "./situations";

const phenomena = { rain: "Pluie forte", frost: "Gel météorologique", heat: "Température élevée" };

export function TerritorialWatchSection({ situations, returnTo }: {
  situations: readonly Situation[];
  returnTo: string;
}) {
  if (!situations.length) return null;
  return (
    <section className="editorial-note" id="productions-surveillance" aria-labelledby="territorial-watch-title">
      <h2 id="territorial-watch-title">Productions sous surveillance</h2>
      <p>Repérages exploratoires, et non impacts constatés : conditions à la parcelle, stades et interventions restent à vérifier. Aucun dommage agricole ni perte de rendement n’est évalué.</p>
      {situations.map(item => (
        <article key={item.id}>
          <h3>{phenomena[item.phenomenon]} · {item.place}</h3>
          <p>{item.productions.join(", ")} · {item.region}</p>
          <p>
            {item.nature === "forecast" ? "Prévision" : "Réanalyse"} du{" "}
            <time dateTime={item.date}>{item.date.split("-").reverse().join("/")}</time>
            {" · "}{new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(item.value)} {item.unit}
            {" · "}{item.confidence === "indicative" ? "Contexte agricole indicatif" : "Signal climatique qualifié · sensibilité potentielle"}
          </p>
          <p>{item.mechanism} {item.limitation}</p>
          <p><Link href={`${item.href}&retour=${encodeURIComponent(returnTo)}`}>Voir la carte et la PRA</Link> · <a href={item.reference}>Référence technique</a></p>
          <details>
            <summary>Provenance et qualification</summary>
            <p>Almanach {item.window} · {item.rule_version}</p>
            <p>{item.data_freshness.join(" · ")} · {item.quality_flags.join(" · ")}</p>
            <ul>{item.provenance.map(ref => <li key={ref} className="agro-territorial-proof">{ref}</li>)}</ul>
          </details>
        </article>
      ))}
    </section>
  );
}
