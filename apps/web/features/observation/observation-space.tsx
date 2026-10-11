"use client";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ApiObservationAdapter,
  DemoObservationAdapter,
  type Collection,
  type LayerData,
  type Properties,
} from "./adapter";
import { parseViewport, viewportParams, type Viewport } from "./state";
import { Button, Sheet, Callout } from "../../components/ui/primitives";
import {
  DataState,
  RiskBadge,
  ConfidenceBadge,
  FreshnessBadge,
  RiskLegend,
  Metric,
  RISK_LABELS,
} from "../../components/ui/scientific";
import type { ShellData } from "../../lib/shell-data";
import "./observation.css";
const MapCanvas = dynamic(() => import("./map-canvas"), {
  ssr: false,
  loading: () => <DataState state="loading" />,
});
const EMPTY: Collection = { type: "FeatureCollection", features: [] };
const demoAdapter = new DemoObservationAdapter();
const apiAdapter = new ApiObservationAdapter();

function LocalDetail({ p, demo }: { p: Properties; demo: boolean }) {
  return (
    <div className="stack observation-detail-content">
      <span className="eyebrow">
        {demo ? "Cellule fictive" : "Cellule observée"}
      </span>
      <h3>{p.cell_id}</h3>
      <div className="badges">
        <RiskBadge level={p.risk_level} />
        <ConfidenceBadge level={p.confidence_level} />
        <FreshnessBadge freshness={p.freshness} />
      </div>
      <p>
        Validité : <time dateTime={p.valid_date}>{p.valid_date}</time> · date
        calendaire
      </p>
      <Metric
        label={`Aléa · ${p.indicator_id}`}
        value={p.hazard_value ?? null}
        unit={p.hazard_unit ?? ""}
        kind={demo ? "Valeur fictive" : "Indicateur calculé fourni par API"}
      />
      {p.risk_level === "unavailable" && <DataState state="insufficient" />}
      {p.freshness === "stale" && <DataState state="stale" />}
      {p.result ? (
        <>
          <h4>Méthode & provenance</h4>
          <p>
            Règle : {p.result.rule.rule_id} · version {p.result.rule.version}
            <br />
            Statut scientifique : {p.result.confidence.scientific_status}
          </p>
          <ul className="evidence-list">
            {p.result.provenance.map((source, i) => (
              <li key={`${source.source_id}-${i}`}>
                Source : {source.source_id}
                <br />
                Observation : {source.observed_at ?? "inconnue"}
                <br />
                Récupération : {source.retrieved_at ?? "inconnue"}
              </li>
            ))}
          </ul>
          <p>
            Qualité :{" "}
            {p.result.quality.flags.join(", ") || "aucun drapeau fourni"}
          </p>
          {p.result.confidence.reasons?.length ? (
            <ul>
              {p.result.confidence.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p>Version de règle et provenance détaillée indisponibles.</p>
      )}
      <Callout title="Limites">
        La classe de risque vient de la source. Confiance et fraîcheur sont
        indépendantes. Aucun seuil ni calcul scientifique n’est déduit par la
        carte.
      </Callout>
    </div>
  );
}
export function ObservationSpace({ initialData }: { initialData: ShellData }) {
  const search = useSearchParams();
  const router = useRouter();
  const queryString = search.toString();
  const params = new URLSearchParams(queryString);
  const mode =
    params.get("mode") === "live" ||
    (!params.has("mode") && initialData.mode === "live")
      ? "live"
      : "demo";
  const viewport = parseViewport(params);
  const selected = params.get("territory");
  // Viewpoint requests are debounced by MapLibre moveend. Selection does not refetch.
  const requestParams = new URLSearchParams(params);
  requestParams.delete("territory");
  requestParams.delete("view");
  requestParams.delete("compare");
  const requestKey = requestParams.toString();
  const [stateKey, setStateKey] = useState(requestKey);
  const [data, setData] = useState<LayerData | null>(() =>
    initialData.mode === "demo"
      ? { mode: "demo", collection: initialData.collection }
      : null,
  );
  const [status, setStatus] = useState<
    "loading" | "available" | "missing" | "source-error"
  >(() =>
    initialData.mode === "demo"
      ? initialData.collection.features.length
        ? "available"
        : "missing"
      : initialData.state === "available"
        ? "loading"
        : initialData.state,
  );
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const [riskVisible, setRiskVisible] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [panelWidth, setPanelWidth] = useState(340);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const latest = useRef(params);
  useEffect(() => {
    latest.current = new URLSearchParams(queryString);
  }, [queryString]);
  const moveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setStateKey(requestKey);
      setStatus("loading");
      setData(null);
      setMessage("");
      const p = new URLSearchParams(requestKey);
      const adapter = mode === "live" ? apiAdapter : demoAdapter;
      void adapter
        .read(p, parseViewport(p), controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setData(result);
          setStatus(
            result.collection.features.length ? "available" : "missing",
          );
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setStatus("source-error");
          setMessage(
            error instanceof Error && error.message === "LIVE_CONTEXT_REQUIRED"
              ? "Pour le live, renseignez production, indicateur, date, règle et version explicites."
              : "Lecture impossible. Aucun résultat ni niveau de risque ajouté.",
          );
        });
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [mode, requestKey, retry]);
  useEffect(
    () => () => {
      if (moveTimer.current) clearTimeout(moveTimer.current);
    },
    [],
  );
  function update(next: URLSearchParams, replace = false) {
    if (replace) window.history.replaceState(null, "", `/?${next}`);
    else router.push(`/?${next}`, { scroll: false });
  }
  function select(id: string) {
    const next = new URLSearchParams(latest.current);
    next.set("territory", id);
    update(next);
    setCollapsed(false);
    setSheetExpanded(false);
  }
  function onMove(v: Viewport) {
    if (moveTimer.current) clearTimeout(moveTimer.current);
    moveTimer.current = setTimeout(() => {
      const next = viewportParams(latest.current, v);
      if (next.toString() !== latest.current.toString()) update(next, true);
    }, 250);
  }
  const currentData = stateKey === requestKey && data?.mode === mode ? data : null;
  const currentStatus = stateKey === requestKey ? status : "loading";
  const collection = currentData?.collection ?? EMPTY;
  const feature = collection.features.find(
    (f) => f.properties.cell_id === selected,
  );
  const demo = mode === "demo";
  const detail = feature ? (
    <LocalDetail p={feature.properties} demo={demo} />
  ) : (
    <div className="stack">
      <h3>{selected ? selected : "Choisir une zone"}</h3>
      <p>
        {selected
          ? "Cette sélection n’est pas disponible dans le contexte ou l’emprise affichés."
          : "Sélectionnez une cellule sur la carte ou dans le tableau pour consulter ses données et ses sources."}
      </p>
      {selected && (
        <Button
          onClick={() => {
            const next = new URLSearchParams(params);
            next.delete("territory");
            update(next);
          }}
        >
          Effacer la sélection
        </Button>
      )}
      <Callout title="Trois lectures distinctes">
        Le risque décrit le résultat de la règle. La confiance décrit sa
        qualité. La fraîcheur décrit l’actualité des données.
      </Callout>
    </div>
  );
  return (
    <section className="observation-space" aria-label="Carte d’observation">
      <div className="observation-toolbar">
        <div>
          <span className="eyebrow">Observation · France</span>
          <h2>Distribution territoriale</h2>
          <p>
            {params.get("indicator") ?? "Indicateurs de la fixture"} · validité{" "}
            {params.get("date") ?? (demo ? "selon la fixture" : "à préciser")}
          </p>
        </div>
        <div className="observation-actions">
          <Button
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set("mode", demo ? "live" : "demo");
              update(next);
            }}
          >
            {demo ? "Utiliser les données live" : "Utiliser la démo"}
          </Button>
          <Button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(location.href);
                setShareMessage("Lien copié");
              } catch {
                setShareMessage("Copiez l’adresse depuis votre navigateur");
              }
            }}
          >
            Partager
          </Button>
        </div>
      </div>
      <span role="status">{shareMessage}</span>
      {!demo && (
        <details className="observation-live-config">
          <summary>Contexte scientifique live</summary>
          <div className="observation-rule-fields">
            {["rule", "version"].map((key) => (
              <label className="field" key={key}>
                <span>
                  {key === "rule" ? "Identifiant de règle" : "Version de règle"}
                </span>
                <input
                  key={params.get(key)}
                  defaultValue={params.get(key) ?? ""}
                  placeholder="À renseigner"
                  onBlur={(event) => {
                    const next = new URLSearchParams(latest.current);
                    if (event.target.value) next.set(key, event.target.value);
                    else next.delete(key);
                    update(next);
                  }}
                />
              </label>
            ))}
            <p>
              Aucun identifiant ou version scientifique n’est choisi
              automatiquement.
            </p>
          </div>
        </details>
      )}
      <div
        className={`observation-workspace ${collapsed ? "detail-collapsed" : ""}`}
        style={{ "--detail-width": `${panelWidth}px` } as React.CSSProperties}
      >
        <div className="observation-cartography">
          <MapCanvas
            collection={collection}
            viewport={viewport}
            selected={selected}
            riskVisible={riskVisible}
            indicator={params.get("indicator") ?? "indicateur de la fixture"}
            onMove={onMove}
            onSelect={select}
          />
          <div className="observation-map-caption">
            <strong>France métropolitaine & Corse</strong>
            <span>
              Fond de repérage simplifié · zoom {viewport.zoom.toFixed(1)}
            </span>
          </div>
          <div className="observation-layer-row">
            <Sheet title="Couches de la carte" trigger="Couches">
              <fieldset className="layers">
                <legend>Visibilité des couches</legend>
                <label>
                  <input
                    type="checkbox"
                    checked={riskVisible}
                    onChange={(e) => setRiskVisible(e.target.checked)}
                  />
                  Classes de risque fournies par la source
                </label>
                <p>
                  Fond : limites territoriales Natural Earth. Aucune couche
                  climatique, agricole ou satellitaire supplémentaire
                  disponible.
                </p>
              </fieldset>
            </Sheet>
            <Button
              className="observation-desktop-detail-toggle"
              onClick={() => setCollapsed(!collapsed)}
              aria-expanded={!collapsed}
            >
              {collapsed ? "Afficher le détail" : "Replier le détail"}
            </Button>
            <small>
              {demo
                ? "Données fictives · fixture locale"
                : "Données live · API Task 04"}
            </small>
          </div>
          <div className="observation-legend">
            <strong>
              Légende · {params.get("indicator") ?? "indicateur de la fixture"}
            </strong>
            <RiskLegend />
            <small>
              Classes fournies ; aucun seuil déduit des couleurs. Unités et
              sources dans le détail.
            </small>
          </div>
        </div>
        <aside
          className="observation-desktop-detail"
          aria-label="Détail de la zone"
          tabIndex={0}
        >
          <label className="field observation-resize">
            <span>Largeur du panneau</span>
            <input
              type="range"
              min="290"
              max="440"
              step="10"
              value={panelWidth}
              onChange={(e) => setPanelWidth(Number(e.target.value))}
            />
          </label>
          {detail}
        </aside>
      </div>
      {currentStatus !== "available" && (
        <div className="observation-data-status">
          <DataState state={currentStatus} />
          {currentStatus === "source-error" && (
            <>
              <p>{message}</p>
              <Button onClick={() => setRetry(retry + 1)}>Réessayer</Button>
            </>
          )}
        </div>
      )}
      {collection.truncated && (
        <Callout title="Résultats partiels">
          La limite API est atteinte. Zoomez pour réduire l’emprise ; le tableau
          ne décrit que les cellules reçues.
        </Callout>
      )}
      {collection.features.some((f) => f.properties.freshness === "stale") && (
        <DataState state="stale" />
      )}
      <details className="observation-table" open>
        <summary>
          Zones de l’emprise · alternative à la carte (
          {collection.features.length})
        </summary>
        <div className="observation-table-scroll" tabIndex={0} role="region" aria-label="Tableau des zones">
          <table>
            <caption>
              Classes de risque, confiance et fraîcheur —{" "}
              {demo ? "Données fictives" : "Données live"}
            </caption>
            <thead>
              <tr>
                <th scope="col">Zone</th>
                <th scope="col">Risque</th>
                <th scope="col">Confiance</th>
                <th scope="col">Fraîcheur</th>
                <th scope="col">Validité</th>
              </tr>
            </thead>
            <tbody>
              {collection.features.map(({ properties: p }) => (
                <tr key={`${p.cell_id}-${p.valid_date}`}>
                  <th scope="row">
                    <Button
                      aria-pressed={selected === p.cell_id}
                      onClick={() => select(p.cell_id)}
                    >
                      {p.cell_id}
                    </Button>
                  </th>
                  <td>{RISK_LABELS[p.risk_level]}</td>
                  <td>
                    {
                      { low: "Faible", medium: "Moyenne", high: "Élevée" }[
                        p.confidence_level
                      ]
                    }
                  </td>
                  <td>
                    {
                      {
                        fresh: "À jour",
                        stale: "Ancienne",
                        unknown: "Inconnue",
                      }[p.freshness]
                    }
                  </td>
                  <td>{p.valid_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      {selected && (
        <section
          className={`observation-bottom-sheet ${sheetExpanded ? "expanded" : ""}`}
          aria-label="Résumé local mobile"
        >
          <div className="observation-sheet-handle" aria-hidden="true" />
          <div className="row">
            <strong>{selected}</strong>
            <Button
              aria-expanded={sheetExpanded}
              onClick={() => setSheetExpanded(!sheetExpanded)}
            >
              {sheetExpanded ? "Réduire" : "Développer"}
            </Button>
            <Button
              aria-label="Fermer le résumé local"
              onClick={() => {
                const next = new URLSearchParams(params);
                next.delete("territory");
                update(next);
              }}
            >
              ×
            </Button>
          </div>
          {sheetExpanded ? (
            detail
          ) : feature ? (
            <>
              <div className="badges">
                <RiskBadge level={feature.properties.risk_level} />
                <ConfidenceBadge level={feature.properties.confidence_level} />
                <FreshnessBadge freshness={feature.properties.freshness} />
              </div>
              <small>
                Validité : {feature.properties.valid_date} ·{" "}
                {demo ? "Données fictives" : "Données live"}
              </small>
            </>
          ) : (
            <p>Sélection absente de ce contexte.</p>
          )}
        </section>
      )}
    </section>
  );
}
