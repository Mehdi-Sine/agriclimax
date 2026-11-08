"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useMemo } from "react";
import type { PraCollection } from "../../national/map";
import { classLabel } from "../../cartography/registry";
import { SemanticLegend } from "../../cartography/legend";
import { usePaletteColors } from "../../cartography/use-palette";
import {
  mapTheme,
  mapPalette,
  sameMapContext,
  explorerHref,
  type JournalMapData,
} from "./map-data";
import { frenchPeriod, frenchCycle } from "./editorial-dates";
const NationalMap = dynamic(() => import("../../national/map"), {
  ssr: false,
  loading: () => (
    <div className="pra-skeleton" role="status">
      Préparation de la carte interactive…
    </div>
  ),
});
let geometryPromise: Promise<PraCollection> | undefined;
function geometry() {
  if (!geometryPromise)
    geometryPromise = fetch("/maps/journal-pra-v1.geojson", {
      cache: "force-cache",
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        const g: PraCollection = await r.json();
        if (
          g.features.length !== 713 ||
          new Set(g.features.map((f) => f.id)).size !== 713
        )
          throw Error();
        return g;
      })
      .catch((error) => {
        geometryPromise = undefined;
        throw error;
      });
  return geometryPromise;
}
export default function JournalPraMap({
  run,
  phenomenon,
  period,
  source,
}: {
  run: string;
  phenomenon: string;
  period: [string, string];
  source: string;
}) {
  const container = useRef<HTMLElement>(null),
    [near, setNear] = useState(false),
    [resource, setResource] = useState<{
      key: string;
      data: JournalMapData;
      collection: PraCollection;
    } | null>(null),
    [error, setError] = useState(false),
    [selected, setSelected] = useState(""),
    [active, setActive] = useState(false),
    [attempt, setAttempt] = useState(0);
  const key = `${run}/${phenomenon}/${period.join("/")}/${source}`,
    theme = mapTheme(phenomenon),
    palette = mapPalette(phenomenon),
    colors = usePaletteColors(palette),
    [start, end] = period;
  useEffect(() => {
    if (!container.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px" },
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!near) return;
    const abort = new AbortController();
    let disposed = false;
    const query = new URLSearchParams({ run, phenomenon });
    Promise.all([
      fetch(`/api/journal/map?${query}`, { signal: abort.signal }).then(
        async (response) => {
          if (!response.ok) throw Error();
          const data: JournalMapData = await response.json();
          if (!sameMapContext(data, run, phenomenon, [start, end], source))
            throw Error();
          return data;
        },
      ),
      geometry(),
    ])
      .then(([data, collection]) => {
        if (
          collection.features.some((f) => !data.rows.some((r) => r.id === f.id))
        )
          throw Error("PRA_GEOMETRY_IDENTITIES");
        if (!disposed) setResource({ key, data, collection });
      })
      .catch(() => {
        if (!disposed) setError(true);
      });
    return () => {
      disposed = true;
      abort.abort();
    };
  }, [near, run, phenomenon, start, end, source, key, attempt]);
  const current = resource?.key === key ? resource : null,
    place = current?.data.rows.find((r) => r.id === selected),
    evidence = place ? current?.data.evidence[place.evidence_id] : undefined;
  const quantitative = useMemo(
    () =>
      current
        ? {
            values: current.data.rows.map((r) => ({
              territoryId: r.id,
              value: r.value,
              normal: null,
              anomaly: null,
              status: r.status,
            })),
            field: "value" as const,
            unit: theme.unit,
            bounds: palette.bounds,
            colors,
          }
        : undefined,
    [current, theme.unit, palette.bounds, colors],
  );
  return (
    <figure
      ref={container}
      className={`journal-pra-map ${active ? "map-active" : "map-inactive"}`}
      data-context={key}
      data-cycle={run}
      data-phenomenon={phenomenon}
    >
      <div className="figure-heading">
        <span>LA FRANCE À LA MAILLE PRA</span>
        <span>713 territoires officiels</span>
      </div>
      <figcaption>
        <h2>{theme.title}</h2>
        <p>
          Prévisions {frenchPeriod(start, end)} · {frenchCycle(run)}.
        </p>
      </figcaption>
      <div className="pra-stage">
        {error ? (
          <div className="pra-skeleton" role="alert">
            <p>
              Carte de ce cycle indisponible. L’article et ses preuves restent
              consultables.
            </p>
            <button
              onClick={() => {
                setError(false);
                setAttempt((n) => n + 1);
              }}
            >
              Réessayer la carte
            </button>
          </div>
        ) : current ? (
          <>
            <div className="pra-map-actions">
              <button
                aria-pressed={active}
                onClick={() => setActive((v) => !v)}
              >
                {active
                  ? "Désactiver le déplacement"
                  : "Activer zoom et déplacement"}
              </button>
              <span>
                Défilement de la page libre tant que la carte est désactivée.
              </span>
            </div>
            <NationalMap
              collection={current.collection}
              rows={null}
              contextRows={null}
              mode="availability"
              selected={selected}
              onSelect={setSelected}
              quantitative={quantitative}
              geography={{
                prefix: "pra:",
                label: "713 PRA",
                attribution: "PRA · OFB / MASA · contours simplifiés T32B",
              }}
            />
            <label className="pra-picker">
              Consulter une PRA
              <select
                aria-label="PRA du Journal"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Choisir un territoire</option>
                {current.data.rows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {r.region}
                  </option>
                ))}
              </select>
            </label>
            {place && (
              <aside className="pra-selection" aria-label="PRA sélectionnée">
                <h3>{place.name}</h3>
                <p>{place.region}</p>
                <strong>
                  {place.value === null
                    ? "Valeur non évaluable"
                    : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(place.value)} ${theme.unit}`}
                </strong>
                <p>
                  {place.status === "available"
                    ? "Disponible · fenêtre temporelle complète selon le moteur"
                    : place.status === "partial"
                      ? evidence?.quality_flags.includes(
                          "partial_spatial_support_not_evaluated",
                        )
                        ? "Support spatial partiel · non extrapolé"
                        : "Couverture temporelle insuffisante ou fenêtre incompatible · valeur non extrapolée"
                      : "Données insuffisantes ou indisponibles"}
                  .
                </p>
                <p>
                  Prévisions {frenchPeriod(start, end)}. Source(s) :{" "}
                  {[
                    ...new Set(evidence?.sources.map((s) => s.split("/")[0])),
                  ].join(", ") || "non disponibles"}
                  .
                </p>
                <a href={explorerHref(run, phenomenon, selected)}>
                  Explorer les données de cette PRA
                </a>
                <details>
                  <summary>Qualité et provenance</summary>
                  <p>{evidence?.rule_version}</p>
                  <p>{evidence?.quality_flags.join(" · ")}</p>
                  <p>Fraîcheur : {evidence?.data_freshness.join(", ")}</p>
                  <p>{evidence?.provenance.join(" · ")}</p>
                  <p>
                    Modèles et cycles sources : {evidence?.sources.join(" · ")}
                  </p>
                </details>
              </aside>
            )}
          </>
        ) : (
          <div className="pra-skeleton" role="status" aria-live="polite">
            Chargement de la carte des 713 PRA…
          </div>
        )}
      </div>
      <p className="pra-source">
        Sources :{" "}
        {current
          ? [
              ...new Set(
                Object.values(current.data.evidence).flatMap((e) =>
                  e.sources.map((s) => s.split("/")[0]),
                ),
              ),
            ].join(", ")
          : "archives nationales vérifiées"}{" "}
        · prévisions exploratoires.
      </p>
      <div className="pra-legend" aria-label="Légende quantitative">
        <div className="legend-ramp">
          {palette.bounds.map((_, i) => (
            <span key={i} style={{ background: `var(${palette.tokens[i]})` }}>
              <small>{classLabel(palette, i)}</small>
            </span>
          ))}
        </div>
        <p>
          {theme.unit} · Gris : non évaluable · Hachures : couverture partielle.
        </p>
      </div>
      <details className="pra-map-method">
        <summary>Sources et méthode de la carte</summary>
        <SemanticLegend palette={palette} />
        <p>
          {phenomenon === "dry"
            ? "Longueur maximale d’une séquence homogène, sans joindre des sources ou cycles différents."
            : phenomenon === "rain"
              ? "Maximum d’un cumul quotidien sur la fenêtre, et non cumul de toute la période."
              : "Extrême échantillonné sur la fenêtre, et non moyenne régionale."}{" "}
          Prévisions exploratoires. Aucun dommage agricole évalué.
        </p>
      </details>
      <a href={explorerHref(run, phenomenon)}>Ouvrir l’explorateur complet</a>
    </figure>
  );
}
