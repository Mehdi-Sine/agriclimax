import type { EditorialBriefingBundle } from "../editorial/briefing";
import type { Archive } from "./model";
export const DAILY_TARGET = {
  hour: 6,
  minute: 30,
  time_zone: "Europe/Paris",
} as const;
/** T36 chooses the UTC cutoff from its Europe/Paris scheduler, including DST.
 * No implicit assumption that observations for J-1 exist at the cutoff. */
export function dailyPlan(
  briefing: EditorialBriefingBundle,
  cutoffAt: string,
  previous: Archive[],
) {
  const cutoff = Date.parse(cutoffAt);
  if (!Number.isFinite(cutoff) || !/(Z|\+00:00)$/.test(cutoffAt))
    throw Error("BATCH_UTC_CUTOFF_REQUIRED");
  const fallback =
    previous
      .filter(
        (a) =>
          a.date <= briefing.edition_date && a.validation.status !== "rejected",
      )
      .sort(
        (a, b) => b.date.localeCompare(a.date) || b.revision - a.revision,
      )[0] ?? null;
  const future = Date.parse(briefing.generated_at) > cutoff;
  const insufficient = !briefing.national.facts.length;
  return {
    target: DAILY_TARGET,
    edition_date: briefing.edition_date,
    cutoff_at: cutoffAt,
    status: future
      ? "after_cutoff"
      : insufficient
        ? "insufficient_data"
        : briefing.validity.data_freshness === "stale"
          ? "degraded"
          : "ready",
    can_generate: !future && !insufficient,
    freshness: briefing.validity.data_freshness,
    observed_cutoff: briefing.validity.history_cutoff,
    forecast_period: briefing.validity.forecast_period,
    fallback_edition_id: fallback?.edition_id ?? null,
    publication_enabled: false as const,
  };
}
