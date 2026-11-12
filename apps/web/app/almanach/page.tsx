import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSeasonalEditorialContext,
  parisDate,
  productionOptions,
  regionOptions,
} from "../../features/editorial/almanac";
import { shift } from "../../features/editorial/temporal";
import { frenchDate } from "../../features/journal/ui/editorial-dates";
import "./almanach.css";
export const metadata = { title: "Almanach agricole | Climacta" };
export default async function AlmanacPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const scalar = (key: string) =>
    typeof q[key] === "string" ? (q[key] as string) : undefined;
  const date = scalar("date") ?? parisDate(new Date().toISOString()),
    region = scalar("region") || undefined,
    production = scalar("production") || undefined;
  let context: ReturnType<typeof getSeasonalEditorialContext>;
  try {
    context = getSeasonalEditorialContext(date, region, production, 40);
  } catch {
    notFound();
  }
  const href = (date: string) =>
    "/almanach?" +
    new URLSearchParams({
      date,
      ...(region ? { region } : {}),
      ...(production ? { production } : {}),
    }).toString();
  const year = date.slice(0, 4);
  return (
    <main className="almanach">
      <a href="#calendrier" className="almanach-skip">
        Aller au calendrier
      </a>
      <header>
        <Link prefetch={false} href="/journal">
          Climacta · Le Journal
        </Link>
        <nav aria-label="Rubriques">
          <Link prefetch={false} href="/">
            Climat
          </Link>
          <Link prefetch={false} href="/analyse">
            Analyse
          </Link>
          <Link prefetch={false} href="/veille">
            Veille
          </Link>
        </nav>
      </header>
      <p className="eyebrow">
        Repères de saison · France métropolitaine et Corse
      </p>
      <h1>L’Almanach agricole</h1>
      <p className="almanach-notice">
        Un calendrier théorique et documentaire pour poser les bonnes questions.
        Les fenêtres indiquées ne sont ni des observations de l’année, ni des
        prescriptions agricoles, ni des alertes.
      </p>
      <section id="calendrier" aria-labelledby="jour-title">
        <h2 id="jour-title">{frenchDate(date)}</h2>
        <form key={`${date}/${region??''}/${production??''}`} action="/almanach" className="almanach-filters">
          <label>
            Date
            <input
              type="date"
              name="date"
              defaultValue={date}
              min="1583-01-01"
              max="9998-12-31"
              required
            />
          </label>
          <label>
            Région
            <select name="region" defaultValue={region ?? ""}>
              <option value="">France entière</option>
              {regionOptions.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            Production
            <select name="production" defaultValue={production ?? ""}>
              <option value="">Toutes les productions</option>
              {productionOptions.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <button type="submit">Consulter</button>
        </form>
        <nav className="almanach-days" aria-label="Changer de jour">
          <Link prefetch={false} href={href(shift(date, -1))}>
            ← Jour précédent
          </Link>
          <Link prefetch={false} href={href(shift(date, 1))}>
            Jour suivant →
          </Link>
        </nav>
        <nav className="almanach-months" aria-label="Les douze mois">
          {Array.from({ length: 12 }, (_, i) => {
            const target = `${year}-${String(i + 1).padStart(2, "0")}-01`;
            return (
              <Link
                key={target}
                href={href(target)}
                aria-current={
                  Number(date.slice(5, 7)) === i + 1 ? "date" : undefined
                }
              >
                {new Intl.DateTimeFormat("fr-FR", {
                  month: "long",
                  timeZone: "UTC",
                }).format(new Date(target))}
              </Link>
            );
          })}
        </nav>
        {context.region && (
          <p>
            <strong>{context.region.region} :</strong>{" "}
            {context.region.profil_climatique}. {context.region.precaution}.
            Profil de recherche indicatif ; aucune présence ni aucun stade
            régional déduit.
          </p>
        )}
        {context.leap_day && (
          <p>
            29 février : fenêtres saisonnières compatibles, sans tradition ni
            repère fixe hérité du 28 février.
          </p>
        )}
      </section>
      <section aria-labelledby="sujets-title">
        <h2 id="sujets-title">Questions de saison</h2>
        <p>
          {context.active_count} fenêtres documentaires correspondant aux
          filtres.
        </p>
        <div className="almanach-grid">
          {context.windows.map((w) => (
            <article key={w.id}>
              <p className="eyebrow">
                {w.category} ·{" "}
                {w.confidence === "review_required"
                  ? "Relecture technique requise"
                  : "Repère indicatif"}
              </p>
              <h3>{w.title}</h3>
              <p>{w.question}</p>
              <p>
                <strong>Productions :</strong> {w.productions.join(", ")}
              </p>
              <p>{w.region_scope}</p>
              <details>
                <summary>Sources et réserves</summary>
                <p>{w.reserve}</p>
                <p>À confronter : {w.signal_ids.join(", ")}.</p>
                <ul>
                  {w.source_ids.map((id) => {
                    const s = context.sources.find((s) => s.id === id);
                    return (
                      <li key={id}>
                        {s ? (
                          <a href={s.url} rel="noreferrer">
                            {s.label}
                          </a>
                        ) : (
                          id
                        )}
                      </li>
                    );
                  })}
                </ul>
              </details>
            </article>
          ))}
        </div>
        {!context.windows.length && (
          <p>
            Aucune fenêtre documentaire pour ces filtres. Cela ne décrit pas une
            absence de phénomène climatique.
          </p>
        )}
      </section>
      <section>
        <h2>Repères et traditions du jour</h2>
        {context.markers.length ? (
          context.markers.map((m) => (
            <article key={m.id}>
              <h3>{m.titre}</h3>
              <p>{m.question}</p>
              <p>
                {m.reserve}. Patrimoine culturel et contexte documentaire :
                aucune valeur prédictive.
              </p>
            </article>
          ))
        ) : (
          <p>Aucun repère fixe recensé pour ce jour.</p>
        )}
      </section>
      <section>
        <h2>Événements mobiles de {year}</h2>
        <ul>
          {context.mobile_events.map((m) => (
            <li key={m.name}>
              <strong>{m.name}</strong> —{" "}
              {m.date
                ? frenchDate(m.date)
                : "Date non résolue : source annuelle vérifiée requise."}{" "}
              {m.active && "Repère de ce jour."}
              <details>
                <summary>Méthode et précautions</summary>
                <p>{m.rule}</p>
                {m.related_dates.length > 0 && (
                  <ul>
                    {m.related_dates.map((f) => (
                      <li key={f.name}>
                        {f.name} : {frenchDate(f.date)}
                      </li>
                    ))}
                  </ul>
                )}
                <p>{m.question}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>
      <footer>
        <p>
          Référentiel {context.version}. Les ajouts exploratoires restent soumis
          à relecture par une filière. Les obligations réglementaires ne sont
          pas publiées automatiquement.
        </p>
        <Link prefetch={false} href="/journal">
          Retour au Journal
        </Link>{" "}
        ·{" "}
        <Link prefetch={false} href="/api/editorial-briefing/example">
          Consulter un dossier historique de démonstration
        </Link>
      </footer>
    </main>
  );
}
