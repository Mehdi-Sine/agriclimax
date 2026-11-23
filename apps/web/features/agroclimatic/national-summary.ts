import { classIndex, classLabel, semanticPalette } from "../cartography/registry";
import type { AgroResult } from "./calculate";
import type { Rule } from "./catalogue";
import type { AgroPayload } from "../../lib/server/agroclimatic";

interface Place {
  id: string;
  name: string;
  region: string;
}
export interface DocumentedProduction {
  label: string;
  source: string;
  year: number;
  declaredHectares: number;
}

export function fieldSummary(
  rule: Rule,
  period: { start: string; end: string; timezone: string },
  sourceVersion: string,
  results: AgroResult[],
  places: Place[],
  productions: Record<string, DocumentedProduction[]>,
) {
  const days = (Date.parse(period.end) - Date.parse(period.start)) / 86400000 + 1;
  const palette = semanticPalette(rule.id, rule.unit, days);
  const byId = new Map(results.map(result => [result.territoryId, result]));
  if (!rule.priority || results.length !== places.length || byId.size !== places.length ||
      new Set(places.map(place => place.id)).size !== places.length ||
      places.some(place => !byId.has(place.id))) {
    throw new Error("FIELD_SUMMARY_PRA_REFERENCE");
  }
  const evaluable = places.flatMap(place => {
    const result = byId.get(place.id)!;
    return result.value !== null && result.quality?.journal_eligible
      ? [{ ...place, value: result.value, result }]
      : [];
  });
  const sorted = [...evaluable].sort((a, b) => a.value - b.value || a.id.localeCompare(b.id));
  const distribution = (values: typeof evaluable) => {
    const counts = palette.bounds.map(() => 0);
    for (const { value } of values) counts[classIndex(value, palette)]++;
    return counts.map((count, index) => ({ class: classLabel(palette, index), count }));
  };
  const remarkable = (items: typeof evaluable) => items.map(({ id, name, region, value, result }) => ({
    id, name, region, value, productions: productions[id] ?? [],
    data_freshness: result.data_freshness,
    provenance: result.provenance,
    quality_flags: result.quality_flags,
  }));
  const maximum = sorted.at(-1)?.value;
  const minimum = sorted[0]?.value;
  const abstentions: Record<string, number> = {};
  const evaluatedIds = new Set(evaluable.map(place => place.id));
  for (const result of results) {
    if (!evaluatedIds.has(result.territoryId)) {
      const reason = result.reason ?? "journal_support_unqualified";
      abstentions[reason] = (abstentions[reason] ?? 0) + 1;
    }
  }
  // Freshness strings begin with the UTC source date. Keep the bounds of the
  // retained inputs; individual timestamps can differ for every PRA and day.
  const freshness = [...new Set(evaluable.flatMap(row => row.result.data_freshness))].sort();
  return {
    version: "agro-field-summary-1",
    indicator: rule.id,
    rule_version: rule.version,
    label: rule.label,
    question: rule.description,
    kind: rule.priority.kind,
    unit: rule.unit,
    threshold: rule.threshold,
    period,
    source: { label: rule.meteorological_source, version: sourceVersion },
    technical_reference: rule.source,
    data_freshness: freshness.length > 1 ? [freshness[0], freshness.at(-1)!] : freshness,
    provenance: [`${rule.meteorological_source}/${sourceVersion}`],
    quality_flags: [...new Set(results.flatMap(row => row.quality_flags))].sort(),
    total_pra: places.length,
    evaluable_pra: evaluable.length,
    distribution: distribution(evaluable),
    regions: [...new Set(places.map(place => place.region))].sort().map(region => {
      const values = evaluable.filter(place => place.region === region);
      return {
        region,
        total_pra: places.filter(place => place.region === region).length,
        evaluable_pra: values.length,
        distribution: distribution(values),
      };
    }),
    remarkable: {
      minimum: minimum ?? null,
      maximum: maximum ?? null,
      lowest: minimum !== maximum ? remarkable(sorted.filter(row => row.value === minimum).slice(0, 3)) : [],
      highest: minimum !== maximum ? remarkable(sorted.filter(row => row.value === maximum).slice(0, 3)) : [],
      minimum_count: sorted.filter(row => row.value === minimum).length,
      maximum_count: sorted.filter(row => row.value === maximum).length,
    },
    anomaly: { value: null, reason: "no_qualified_homologous_reference_for_this_indicator" },
    abstentions,
    limitations: [
      rule.limits,
      "Distribution non pondérée, une valeur par PRA évaluable. Les classes sont cartographiques.",
      "Les productions indiquent une surface déclarée au RPG 2025. Stade, présence pendant la fenêtre et dommages restent inconnus.",
    ],
  };
}

type ComparablePeriod = Pick<AgroPayload, "history_series" | "period" | "data" | "source_version" | "rule">;

export function compareFieldPeriods(current: ComparablePeriod, previous?: ComparablePeriod | null) {
  if (!previous) return { value: null, reason: previous === null ? "previous_period_unavailable" : "comparison_not_requested" };
  const duration = (period: ComparablePeriod["period"]) => Date.parse(period.end) - Date.parse(period.start);
  if (!current.history_series || current.history_series !== previous.history_series ||
      current.rule.id !== previous.rule.id || current.rule.version !== previous.rule.version ||
      current.period.timezone !== previous.period.timezone || duration(current.period) !== duration(previous.period) ||
      Date.parse(current.period.start) - Date.parse(previous.period.end) !== 86400000) {
    return { value: null, reason: "previous_period_not_homologous" };
  }
  const prior = new Map(previous.data.map(row => [row.territoryId, row]));
  const deltas = current.data.flatMap(row => {
    const before = prior.get(row.territoryId);
    return before?.quality?.journal_eligible && row.quality?.journal_eligible &&
      row.support_id && row.support_id === before.support_id &&
      row.spatial_coverage === before.spatial_coverage &&
      row.value !== null && before.value !== null
      ? [row.value - before.value]
      : [];
  }).sort((a, b) => a - b);
  const count = deltas.length;
  if (!count) return { value: null, reason: "no_paired_pra_with_homologous_support" };
  return {
    value: (deltas[Math.floor((count - 1) / 2)] + deltas[Math.floor(count / 2)]) / 2,
    statistic: "median_paired_delta",
    unit: current.rule.unit,
    paired_pra: count,
    previous_period: previous.period,
    previous_source_version: previous.source_version,
    interpretation: "Écart entre deux fenêtres successives de même durée sur les seules PRA comparables. Les cumuls et séquences redémarrent à chaque début de fenêtre.",
  };
}
