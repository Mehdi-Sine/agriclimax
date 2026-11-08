import type { JournalEdition, EditorialEvent } from "../model";
import type { WatchSummary } from "../../national-watch/model";
import { PHENOMENA } from "../../national-watch/model";
import { frenchPeriod } from "./editorial-dates";
export interface KeyFigure {
  id: string;
  value: number;
  denominator: number;
  region: string;
  phenomenon: string;
  label: string;
  period: string;
  href: string;
  factId: string;
}
// Existing ingestion physical checks: normalize.py (absolute zero / nonnegative rain).
// Sequence length is bounded by the already selected calendar window, not a new hazard threshold.
export function validFigureValue(
  phenomenon: string,
  value: number | null,
  days: number,
) {
  return (
    value !== null &&
    Number.isFinite(value) &&
    (!["heat", "frost"].includes(phenomenon) || value >= -273.15) &&
    (phenomenon !== "rain" || value >= 0) &&
    (phenomenon !== "dry" ||
      (Number.isInteger(value) && value >= 0 && value <= days))
  );
}
// Breadth and diversity from the edition's own selection. Never promote a territorial
// extreme to a regional statistic; no new physical thresholds or risk score here.
export function selectKeyFigures(
  edition: JournalEdition,
  summary?: WatchSummary,
): KeyFigure[] {
  if (
    !summary ||
    !edition.source_cycles.some(
      (r) => Date.parse(r) === Date.parse(summary.run),
    ) ||
    edition.provenance[0] !== summary.source_version
  )
    return [];
  const candidates = [edition.main_story, ...edition.secondary_stories].filter(
    (s): s is EditorialEvent => s !== null,
  );
  const ordered = [
    ...candidates.filter(
      (s, i) =>
        candidates.findIndex((c) => c.phenomenon === s.phenomenon) === i,
    ),
    ...candidates.filter(
      (s, i) =>
        candidates.findIndex((c) => c.phenomenon === s.phenomenon) !== i,
    ),
  ];
  return ordered
    .flatMap((story) => {
      const fact = edition.evidence.facts.find((f) =>
          story.facts.includes(f.id),
        ),
        event = summary.events.find(
          (e) =>
            e.phenomenon === story.phenomenon &&
            e.region === story.region &&
            e.start === story.period[0] &&
            e.end === story.period[1],
        );
      if (
        !fact ||
        !event ||
        !Number.isFinite(fact.value) ||
        fact.value !== event.value ||
        fact.unit !== event.unit ||
        event.unit !== PHENOMENA.find((p) => p.id === story.phenomenon)?.unit ||
        fact.source !== summary.source_version ||
        story.nature !== summary.source_nature ||
        JSON.stringify(fact.quality_flags) !==
          JSON.stringify(event.quality_flags) ||
        JSON.stringify(fact.data_freshness) !==
          JSON.stringify(event.data_freshness) ||
        fact.rule_version !== event.rule_version ||
        JSON.stringify(fact.period) !== JSON.stringify(summary.period) ||
        JSON.stringify(fact.provenance) !== JSON.stringify(event.provenance) ||
        !fact.provenance.length ||
        JSON.stringify(story.pra_ids) !== JSON.stringify(event.pra_ids)
      )
        return [];
      const ids = new Set(
          summary.places
            .filter((p) => p.region === story.region)
            .map((p) => p.id),
        ),
        metrics = summary.metrics.filter(
          (m) => m.phenomenon === story.phenomenon && ids.has(m.pra),
        ),
        evaluated = metrics.filter((m) => m.detected !== null),
        affected = evaluated.filter((m) => m.detected === true);
      if (
        !affected.length ||
        evaluated.length !== event.evaluated ||
        affected.length !== event.pra_ids.length ||
        evaluated.some(
          (m) =>
            !validFigureValue(
              story.phenomenon,
              m.value,
              Math.round(
                (Date.parse(summary.period[1]) -
                  Date.parse(summary.period[0])) /
                  86400000,
              ) + 1,
            ) ||
            !summary.evidence[m.evidence_id]?.provenance.length ||
            !summary.evidence[m.evidence_id].sources.length ||
            !summary.evidence[m.evidence_id].rule_version.startsWith(
              summary.version + "/",
            ) ||
            summary.evidence[m.evidence_id].quality_flags.some((f) =>
              [
                "incomplete_or_incompatible_7day_window",
                "partial_spatial_support_not_evaluated",
                "invalid_physical_value",
                "temperature_min_exceeds_max",
              ].includes(f),
            ),
        )
      )
        return [];
      return [
        {
          id: story.id,
          value: affected.length,
          denominator: evaluated.length,
          region: story.region,
          phenomenon: story.phenomenon,
          label:
            PHENOMENA.find((p) => p.id === story.phenomenon)?.label ??
            story.phenomenon,
          period: frenchPeriod(...story.period),
          href: story.href,
          factId: fact.id,
        },
      ];
    })
    .slice(0, 3);
}
