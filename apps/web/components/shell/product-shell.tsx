"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AppContext } from "../../lib/domain";
import { parseContext, serializeContext } from "../../lib/url-state";
import type { ShellData } from "../../lib/shell-data";
import riskFixture from "../../../../fixtures/contracts/risk-result.json";
import watchFixture from "../../../../fixtures/contracts/watch-signal.json";
import { BRAND } from "../../lib/brand";
import { BrandLockup, BrandSymbol } from "./brand";
import { ThemeToggle } from "./theme-toggle";
import { ObservationSpace } from "../../features/observation/observation-space";
import { ScientificDiagnostic } from "../diagnostic/scientific-diagnostic";
import { diagnosticHref } from "../../lib/diagnostic";
import { sharedContext } from "../../lib/integration-context";
import {
  Button,
  Select,
  Panel,
  Tabs,
  Sheet,
  Drawer,
  Callout,
} from "../ui/primitives";
import {
  ConfidenceBadge,
  FreshnessBadge,
  RiskLegend,
  Metric,
  SignalCard,
  SourceChip,
  DataState,
  TerritorySummary,
} from "../ui/scientific";

export function ProductShell({
  context,
  data,
  liveContext = {},
}: {
  context: AppContext;
  data: ShellData;
  liveContext?: Record<string, string>;
}) {
  const router = useRouter();
  const [space, setSpace] = useState<"observation" | "watch" | "diagnostic">(
    "observation",
  );
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const sync = () => {
      const view = new URLSearchParams(location.search).get("view");
      setSpace(
        view === "watch" || view === "diagnostic" ? view : "observation",
      );
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  function withLiveContext(params: URLSearchParams) {
    for (const [key, value] of Object.entries(liveContext))
      params.set(key, value);
    if (typeof window !== "undefined")
      for (const key of ["mode", "rule", "version", "bbox", "zoom", "limit"]) {
        const value = new URLSearchParams(window.location.search).get(key);
        if (value) params.set(key, value);
      }
    return params;
  }
  function navigate(next: typeof space) {
    const params = sharedContext(new URLSearchParams(window.location.search));
    if (next === "watch") {
      router.push(`/watch?${params}`, { scroll: false });
      return;
    }
    if (next === "diagnostic") {
      const cell = params.get("territory");
      const result = data.mode === "demo" && data.collection.features.length > 0
        ? data.diagnostic
        : data.mode === "live" && data.state === "available"
          ? data.results?.find(result => result.cell_id === cell)
          : undefined;
      if (result && (!cell || result.cell_id === cell)) {
        router.push(diagnosticHref(result, data.mode, params));
      } else {
        if (cell) params.set("cell", cell);
        router.push(`/diagnostic?${params}`);
      }
      return;
    }
    setSpace(next);
    if (next !== "observation") params.set("view", next);
    router.push(`/?${params}`, { scroll: false });
  }
  function update(field: keyof AppContext, value: string) {
    const next = parseContext(
      serializeContext({ ...context, [field]: value || null }),
    );
    const params = withLiveContext(serializeContext(next));
    if (space !== "observation") params.set("view", space);
    router.push(`/?${params}`, { scroll: false });
  }
  const filters = (
    <div className="filters">
      <Select
        label="Production"
        value={context.productionId ?? ""}
        onChange={(event) => update("productionId", event.target.value)}
      >
        <option value="">Toutes les productions</option>
        <option value="wheat_soft">Blé tendre</option>
        <option value="dairy_cattle">Bovin lait</option>
      </Select>
      <Select
        label="Indicateur"
        value={context.indicatorId ?? ""}
        onChange={(event) => update("indicatorId", event.target.value)}
      >
        <option value="">Tous les indicateurs</option>
        <option value="tmax_days_above">Jours de chaleur · d</option>
      </Select>
      <Select
        label="Territoire"
        value={context.territoryId ?? ""}
        onChange={(event) => update("territoryId", event.target.value)}
      >
        <option value="">Tous les territoires</option>
        {data.mode === "demo" && (
          <option value="demo-001">Territoire démo 001</option>
        )}
      </Select>
      <label className="field">
        <span>Date de validité</span>
        <input
          type="date"
          value={context.date ?? ""}
          onChange={(event) => update("date", event.target.value)}
        />
      </label>
      <Button
        onClick={() => {
          const params = withLiveContext(new URLSearchParams());
          if (space !== "observation") params.set("view", space);
          router.push(`/?${params}`);
        }}
      >
        Réinitialiser
      </Button>
    </div>
  );
  const demo = data.mode === "demo";
  const available = demo && data.collection.features.length > 0;
  const properties = demo ? data.collection.features[0]?.properties : undefined;
  const emptyState =
    data.mode === "live" && data.state === "source-error"
      ? "source-error"
      : "missing";
  const liveStatus =
    data.mode === "live" && data.state === "available" ? (
      <Callout title="Données live disponibles">
        {data.count} résultat(s) reçus. Consultez la carte ou le diagnostic.
        {data.results?.map((result) => <p key={`${result.cell_id}:${result.valid_date}`}>
          <a className="button button-secondary" href={diagnosticHref(result, "live", withLiveContext(serializeContext(context)))}>Diagnostic · {result.cell_id} · {result.valid_date}</a>
        </p>)}
      </Callout>
    ) : (
      <DataState state={emptyState} />
    );
  const diagnosticContext = withLiveContext(serializeContext(context));
  const diagnostic = available && data.mode === "demo" ? (
    <ScientificDiagnostic data={{ mode: "demo", state: "available", result: data.diagnostic, series: [data.diagnostic] }} />
  ) : data.mode === "live" && data.state === "available" ? (
    <div className="stack">{liveStatus}</div>
  ) : <DataState state={emptyState} />;
  const detail = (
    <Drawer title="Diagnostic scientifique" trigger="Voir le diagnostic">
      {available && data.mode === "demo" && <p><a className="button button-secondary" href={diagnosticHref(data.diagnostic, "demo", diagnosticContext)}>Ouvrir le diagnostic partageable</a></p>}
      {diagnostic}
    </Drawer>
  );
  return (
    <>
      <a href="#main" className="skip-link">
        Aller au contenu
      </a>
      <header className="app-header">
        <BrandLockup />
        <nav className="desktop-only" aria-label="Espaces produit">
          <Tabs
            label="Navigation"
            value={space}
            onChange={navigate}
            options={[
              { value: "observation", label: "Observation" },
              { value: "watch", label: "Veille" },
              { value: "diagnostic", label: "Diagnostic" },
            ]}
          />
        </nav>
        <div className="header-actions">
          <a className="desktop-only" href="/design-system">
            Design system
          </a>
          <ThemeToggle />
        </div>
      </header>
      <div className="demo-banner" data-demo={demo || undefined}>
        {demo ? (
          <>
            <strong>Données fictives</strong> · Démonstration de l’interface ·
            Aucune validation scientifique
          </>
        ) : (
          <>
            <strong>Données live</strong> · Source Supabase · Aucun remplacement
            par des fixtures
          </>
        )}
      </div>
      <main
        id="main"
        className={`app-main ${space === "observation" ? "observation-active" : ""} ${space === "watch" ? "mobile-watch" : "mobile-map"}`}
        tabIndex={-1}
      >
        <div className="page-intro row">
          <div>
            <span className="eyebrow">{BRAND.descriptor}</span>
            <h1>
              {space === "watch"
                ? "Veille climatique"
                : space === "diagnostic"
                  ? "Comprendre les indicateurs"
                  : "Observer les territoires"}
            </h1>
            <p>
              {space === "observation"
                ? "Un contexte partagé. Des informations traçables."
                : "Des sources, des méthodes et des limites explicites."}
            </p>
          </div>
          <Button
            className={`tablet-toggle ${space === "observation" ? "observation-hidden" : ""}`}
            onClick={() => setCollapsed(!collapsed)}
            aria-expanded={!collapsed}
          >
            {collapsed ? "Afficher la veille" : "Replier la veille"}
          </Button>
        </div>
        <div className="context-bar">
          <div className="desktop-only">{filters}</div>
          <div className="mobile-only compact-context">
            <div>
              <strong>
                {context.productionId === "dairy_cattle"
                  ? "Bovin lait"
                  : context.productionId === "wheat_soft"
                    ? "Blé tendre"
                    : "Toutes productions"}
              </strong>
              <small>
                {context.date ?? "Toutes dates"} ·{" "}
                {context.territoryId ?? "Tous territoires"}
              </small>
            </div>
            <Sheet title="Filtrer le contexte" trigger="Filtres">
              {filters}
            </Sheet>
          </div>
        </div>
        {space !== "observation" && data.mode === "live" && data.state === "source-error" && (
          <Callout title="Lecture live">{data.message}</Callout>
        )}
        {space === "observation" ? (
          <ObservationSpace initialData={data} />
        ) : space === "diagnostic" ? (
          <Panel
            title={
              demo
                ? "Diagnostic scientifique — données fictives"
                : "Diagnostic scientifique — état des données"
            }
          >
            {diagnostic}
          </Panel>
        ) : (
          <>
            <div className={`workspace ${collapsed ? "collapsed" : ""}`}>
              <Panel
                title="Observation territoriale"
                className={`observation-panel ${space === "watch" ? "desktop-only" : ""}`}
              >
                <div className="row">
                  <span className="muted">
                    {demo
                      ? "Contexte fictif · 01 juillet 2026"
                      : `Contexte live · ${context.date ?? "date à préciser"}`}
                  </span>
                  <Sheet title="À propos de cette vue" trigger="À propos">
                    <Callout title="Emplacement de la future carte">
                      Cette zone illustre la composition du shell. La carte
                      interactive sera construite dans Task 06.
                    </Callout>
                  </Sheet>
                </div>
                <div className="observation-placeholder">
                  <div>
                    <BrandSymbol />
                    <h3>Le territoire comme point de départ</h3>
                    <p className="muted">
                      Emplacement de la future carte.
                      <br />
                      Aucune couche géographique réelle.
                    </p>
                    {available ? (
                      <>
                        <SourceChip source="demo-fiction" />
                        <p>
                          {demo ? data.collection.features.length : 0}{" "}
                          territoire fictif disponible
                        </p>
                        {detail}
                      </>
                    ) : demo ? (
                      <DataState state="missing" />
                    ) : (
                      liveStatus
                    )}
                  </div>
                </div>
                {demo && <RiskLegend />}
                <p className="muted">
                  <small>
                    Classes de présentation · aucun seuil scientifique associé
                    aux couleurs
                  </small>
                </p>
              </Panel>
              <Panel title="À suivre dans ce contexte" className="watch-panel">
                <div className="badges">
                  <SourceChip source={demo ? "Fixture locale" : "Supabase"} />
                  <span className="badge">
                    {demo ? "Données fictives" : "Données live"}
                  </span>
                </div>
                {available && properties ? (
                  <SignalCard
                    title="Chaleur · blé tendre"
                    level={properties.risk_level}
                    action={detail}
                  >
                    <p>
                      Territoire démo 001 · validité au 01 juillet 2026. Exemple
                      d’affichage issu d’une fixture, sans calcul de veille.
                    </p>
                    <div className="badges">
                      <ConfidenceBadge level={properties.confidence_level} />
                      <FreshnessBadge freshness={properties.freshness} />
                    </div>
                    <p>
                      Synthèse : {watchFixture.summary ?? "non disponible"} ·
                      Assistance IA : non
                    </p>
                    <SourceChip source="demo-fiction" />
                  </SignalCard>
                ) : demo ? (
                  <DataState state="missing" />
                ) : (
                  liveStatus
                )}
                <Callout title="Vérifier avant d’interpréter">
                  La classe de risque, la confiance et la fraîcheur décrivent
                  trois informations différentes.
                </Callout>
              </Panel>
            </div>
            {available && properties && (
              <div className="metric-grid">
                <TerritorySummary name="Aléa climatique">
                  <Metric
                    label="Jours de chaleur"
                    value={properties.hazard_value ?? null}
                    unit="d"
                    kind="Valeur fictive · pas une prévision"
                  />
                </TerritorySummary>
                <TerritorySummary name="Confiance scientifique">
                  <ConfidenceBadge level={properties.confidence_level} />
                  <p className="muted">
                    Règle {riskFixture.rule.version} · exploratoire
                  </p>
                </TerritorySummary>
                <TerritorySummary name="Traçabilité">
                  <SourceChip source="demo-fiction" />
                  <p className="muted">Observation : date inconnue</p>
                </TerritorySummary>
              </div>
            )}
          </>
        )}
        <p className="footer-note">
          {BRAND.signature}{" "}
          <span className="mobile-only">
            <a href="/design-system">Catalogue des composants</a>
          </span>
        </p>
      </main>
      <nav className="mobile-nav mobile-only" aria-label="Navigation mobile">
        <Tabs
          label="Carte ou Veille"
          value={space === "watch" ? "watch" : "observation"}
          onChange={navigate}
          options={[
            { value: "observation", label: "Carte" },
            { value: "watch", label: "Veille" },
          ]}
        />
      </nav>
    </>
  );
}
