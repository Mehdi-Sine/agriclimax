import { createHash } from "node:crypto";
import type {
  Contribution,
  Contributor,
  IndicatorFact,
} from "../journal/registry";
import { qualifiedCompare } from "../editorial/temporal";
import type { Snapshot, Change } from "../journal/history";
import type { Measurement } from "./engine";
import { PRODUCTIONS, RECIPES, VERSION } from "./registry";
const hash = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
export function publishable(m: Measurement) {
  const p = PRODUCTIONS.find((p) => p.id === m.production),
    r = RECIPES.find((r) => r.id === m.indicator),
    v = m.result;
  return (
    !!p?.indicators.includes(m.indicator) &&
    !!r &&
    m.version === VERSION &&
    v.rule_version === VERSION &&
    v.unit === r.kernel.unit &&
    v.parameters.threshold === r.kernel.threshold &&
    !!v.quality?.journal_eligible &&
    v.value !== null &&
    Number.isFinite(v.value) &&
    v.temporal_coverage === 1 &&
    v.provenance.length > 0 &&
    v.data_freshness.length > 0 &&
    m.signature.length > 0 &&
    r.natures.some((n) => n === m.nature)
  );
}
export function compareMeasurements(
  current: Measurement,
  previous: Measurement | undefined,
  horizon: Change["horizon"],
) {
  const snapshot = (m: Measurement): Snapshot => ({
    nature: m.nature as Snapshot["nature"],
    source: m.signature,
    model: m.signature,
    version: VERSION,
    unit: m.result.unit,
    period: m.period,
    date: m.period[1],
    complete: publishable(m),
    pra_ids: [m.result.territoryId],
    evaluated_ids: [m.result.territoryId],
    magnitude: m.result.value ?? 0,
    episode_id: `${m.production}/${m.indicator}/${m.result.territoryId}`,
  });
  const comparison = qualifiedCompare(
    snapshot(current),
    previous ? snapshot(previous) : undefined,
    horizon,
  );
  return {
    ...comparison,
    delta:
      comparison.kind === "historical_evolution" &&
      current.result.value !== null &&
      previous?.result.value != null
        ? current.result.value - previous.result.value
        : null,
  };
}
export interface ProductionFact extends IndicatorFact {
  production: string;
  indicator: string;
  nature: string;
  pra_ids: string[];
  regions: string[];
  quality: AgroQuality;
  comparison: ReturnType<typeof compareMeasurements> | null;
  limits: string;
  origins: Measurement["origins"];
}
type AgroQuality = Measurement["result"]["quality"];
export interface Geography {
  id: string;
  name: string;
  region: string;
}
/** Prepared for JOUR-02; no registration in the live Journal or AI prompt. */
export function createContributors(
  measurements: Measurement[],
  places: readonly Geography[],
  comparison?: { previous: Measurement[]; horizon: Change["horizon"] },
): Contributor[] {
  if (
    new Set(places.map((p) => p.id)).size !== places.length ||
    places.some((p) => !p.name || !p.region) ||
    measurements.some(
      (m) => !places.some((p) => p.id === m.result.territoryId),
    ) ||
    new Set(
      measurements.map((m) =>
        JSON.stringify([
          m.production,
          m.indicator,
          m.result.territoryId,
          m.period,
        ]),
      ),
    ).size !== measurements.length
  )
    throw Error("INVALID_MULTIPRODUCTION_CONTRIBUTIONS");
  const periods = new Set(measurements.map((m) => JSON.stringify(m.period)));
  const natures = new Set(
    measurements.flatMap((m) => (m.nature ? [m.nature] : [])),
  );
  if (periods.size > 1 || natures.size > 1)
    throw Error("EDITORIAL_BATCH_REQUIRES_ONE_PERIOD_AND_NATURE");
  return PRODUCTIONS.map((p) => ({
    id: p.id,
    version: VERSION,
    contribute: (): Contribution => ({
      id: p.id,
      label: p.label,
      family: p.family,
      declared_pra_count: null,
      source: VERSION,
      year: null,
      event_ids: [],
      href: `/analyse?production=${p.id}`,
      limits: p.limits,
      indicators: p.indicators.flatMap((id) => {
        const selected = measurements.filter(
          (m) => m.production === p.id && m.indicator === id,
        );
        if (!selected.length) return [];
        const m = selected[0];
        const recipe = RECIPES.find((r) => r.id === m.indicator);
        if (!recipe) throw Error("UNKNOWN_EDITORIAL_RECIPE");
        const facts: ProductionFact[] = selected.flatMap((m) => {
          const place = places.find((p) => p.id === m.result.territoryId)!;
          return publishable(m)
            ? [
                {
                  id: hash([
                    m.production,
                    m.indicator,
                    m.period,
                    m.signature,
                    m.result.territoryId,
                  ]),
                  text: `${p.label}, ${place.name} : ${recipe.kernel.label}, ${m.result.value} ${m.result.unit}. ${m.nature} descriptive ; aucun impact agricole déduit.`,
                  value: m.result.value!,
                  unit: m.result.unit,
                  period: m.period,
                  source: [...new Set(m.origins.map((o) => o.source))].join(
                    "|",
                  ),
                  rule_version: VERSION,
                  provenance: [...m.result.provenance],
                  quality_flags: [...m.result.quality_flags],
                  data_freshness: [...m.result.data_freshness],
                  href: `/analyse?production=${p.id}`,
                  production: p.id,
                  indicator: m.indicator,
                  nature: m.nature!,
                  pra_ids: [place.id],
                  regions: [place.region],
                  quality: m.result.quality,
                  comparison: (() => {
                    if (!comparison) return null;
                    const previous = comparison.previous.find(
                      (p) =>
                        p.production === m.production &&
                        p.indicator === m.indicator &&
                        p.result.territoryId === m.result.territoryId,
                    );
                    const compared = compareMeasurements(
                      m,
                      previous,
                      comparison.horizon,
                    );
                    return [
                      "historical_evolution",
                      "forecast_revision",
                    ].includes(compared.kind)
                      ? compared
                      : null;
                  })(),
                  limits: p.limits + " " + recipe.kernel.limits,
                  origins: m.origins,
                },
              ]
            : [];
        });
        const qualified = facts.length > 0;
        return [
          {
            id: m.indicator,
            version: VERSION,
            period: m.period,
            scale: "pra",
            quality: [
              ...new Set(
                selected.map((m) => m.result.quality?.state ?? "unknown"),
              ),
            ]
              .sort()
              .join("|"),
            status: qualified ? "available" : "unavailable",
            qualified,
            publishable: qualified,
            provenance: [
              ...new Set(selected.flatMap((m) => m.result.provenance)),
            ],
            limits: p.limits + " " + recipe.kernel.limits,
            facts,
          },
        ];
      }),
    }),
  }));
}

/** Reuse T33 episode boundaries/censoring for qualified daily reanalyses.
 * Forecast windows retain the kernel's counts, never an observed continuity claim.
 */
export function dailyEpisodeEvidence(
  measurements: Measurement[],
  places: readonly Geography[],
) {
  return measurements.flatMap((m) => {
    const recipe = RECIPES.find((r) => r.id === m.indicator),
      place = places.find((p) => p.id === m.result.territoryId);
    if (
      !recipe ||
      !place ||
      m.nature !== "reanalysis" ||
      m.period[0] !== m.period[1] ||
      ![
        "above",
        "below",
        "longestAbove",
        "longestBelow",
        "thiAbove",
        "thiLongest",
      ].includes(recipe.kernel.operator)
    )
      return [];
    const value = m.result.quality?.indicator_eligible
      ? (m.result.value ?? m.result.observed_value ?? null)
      : null;
    return [
      {
        date: m.period[0],
        pra: m.result.territoryId,
        region: place.region,
        phenomenon: `${m.production}/${m.indicator}`,
        value,
        detected: value === null ? null : value > 0,
        signature: hash(m.signature),
        rule_version: VERSION,
        unit: "jours",
        nature: "reanalysis" as const,
        provenance: [...m.result.provenance],
        data_freshness: [...m.result.data_freshness],
        quality_flags: [...m.result.quality_flags],
      },
    ];
  });
}
