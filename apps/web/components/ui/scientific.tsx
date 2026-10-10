import type { ReactNode } from "react";
import type { RiskLevel, ConfidenceLevel, Freshness } from "../../lib/domain";
import { Badge, Skeleton } from "./primitives";

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Faible",
  moderate: "Modéré",
  high: "Élevé",
  critical: "Critique",
  unavailable: "Indisponible",
};
export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <Badge className={`risk risk-${level}`}>
      <span aria-hidden="true">●</span> Risque : {RISK_LABELS[level]}
    </Badge>
  );
}
export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  return (
    <Badge>
      Confiance : {{ low: "faible", medium: "moyenne", high: "élevée" }[level]}
    </Badge>
  );
}
export function FreshnessBadge({ freshness }: { freshness: Freshness }) {
  return (
    <Badge className={freshness === "stale" ? "stale" : ""}>
      {
        {
          fresh: "Donnée à jour",
          stale: "Donnée ancienne",
          unknown: "Fraîcheur inconnue",
        }[freshness]
      }
    </Badge>
  );
}
export const DATA_STATES = {
  loading: ["Chargement", "Récupération des données en cours."],
  processing: ["Analyse en cours", "Le résultat n’est pas encore disponible."],
  missing: ["Données absentes", "Aucune donnée disponible pour ce contexte."],
  insufficient: [
    "Données insuffisantes",
    "La couverture ne permet pas de conclure.",
  ],
  "no-risk": [
    "Risque non identifié",
    "Aucun risque identifié par la règle utilisée ; cela ne signifie pas une absence de données.",
  ],
  risk: ["Risque identifié", "Consultez la règle, les sources et les limites."],
  stale: [
    "Données anciennes",
    "Vérifiez la période de validité avant utilisation.",
  ],
  "calculation-error": [
    "Erreur de calcul",
    "Le calcul n’a pas abouti. Aucun niveau de risque déduit.",
  ],
  "source-error": [
    "Source indisponible",
    "La récupération a échoué. Réessayez ultérieurement.",
  ],
  demo: [
    "Données fictives",
    "Démonstration uniquement, sans validation scientifique.",
  ],
} as const;
export function DataState({
  state,
  action,
}: {
  state: keyof typeof DATA_STATES;
  action?: ReactNode;
}) {
  const [title, description] = DATA_STATES[state];
  return (
    <div
      className={`data-state state-${state}`}
      role={state.endsWith("error") ? "alert" : "status"}
      data-demo={state === "demo" || undefined}
    >
      <strong>{title}</strong>
      <p>{description}</p>
      {state === "loading" && <Skeleton />}
      {action}
    </div>
  );
}
export function Metric({
  label,
  value,
  unit,
  kind = "Indicateur calculé",
}: {
  label: string;
  value: number | null;
  unit: string;
  kind?: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className="metric-number">
        {value === null ? "—" : new Intl.NumberFormat("fr-FR").format(value)}{" "}
        <small>{unit}</small>
      </strong>
      <small>{kind}</small>
    </div>
  );
}
export function SourceChip({ source }: { source: string }) {
  return <Badge>{source}</Badge>;
}
export function EvidenceList({ items }: { items: readonly string[] }) {
  return (
    <ul className="evidence-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
export function RiskLegend() {
  return (
    <div
      className="legend"
      role="group"
      aria-label="Classes de risque, sans seuil scientifique"
    >
      {(Object.keys(RISK_LABELS) as RiskLevel[]).map((level) => (
        <RiskBadge key={level} level={level} />
      ))}
    </div>
  );
}
export function ScientificMethodCard({
  version,
  children,
}: {
  version: string;
  children: ReactNode;
}) {
  return (
    <section className="scientific-card">
      <h3>Méthode & limites</h3>
      <Badge>Exploratoire · règle {version}</Badge>
      {children}
    </section>
  );
}
export function TerritorySummary({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  return (
    <section className="scientific-card">
      <span className="eyebrow">Territoire fictif</span>
      <h3>{name}</h3>
      {children}
    </section>
  );
}
export function SignalCard({
  title,
  level,
  children,
  action,
}: {
  title: string;
  level: RiskLevel;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <article className="signal-card" data-demo="true">
      <div className="row">
        <span className="eyebrow">Signal fictif · 01 juillet 2026</span>
        <span aria-hidden="true">→</span>
      </div>
      <h3>{title}</h3>
      <RiskBadge level={level} />
      {children}
      <footer>{action}</footer>
    </article>
  );
}
export function IndicatorSparkline({ values }: { values: readonly number[] }) {
  if (values.length < 2 || values.some((value) => !Number.isFinite(value)))
    return <DataState state="insufficient" />;
  const min = Math.min(...values),
    range = Math.max(...values) - min || 1;
  const points = values
    .map(
      (value, i) =>
        `${(i * 180) / (values.length - 1)},${45 - ((value - min) * 40) / range}`,
    )
    .join(" ");
  return (
    <figure className="sparkline">
      <svg
        viewBox="0 0 180 50"
        role="img"
        aria-label={`Série fictive : ${values.join(", ")}`}
      >
        <polyline points={points} />
      </svg>
      <figcaption>Série fictive · sans seuil ni prévision</figcaption>
    </figure>
  );
}
export function MapLayerControl({
  layers,
  onChange,
}: {
  layers: readonly { id: string; label: string; checked: boolean }[];
  onChange: (id: string, checked: boolean) => void;
}) {
  return (
    <fieldset className="layers">
      <legend>Couches de démonstration</legend>
      {layers.map((layer) => (
        <label key={layer.id}>
          <input
            type="checkbox"
            checked={layer.checked}
            onChange={(event) => onChange(layer.id, event.target.checked)}
          />
          {layer.label}
        </label>
      ))}
    </fieldset>
  );
}
