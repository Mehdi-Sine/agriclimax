import { createHash } from "node:crypto";
import { compare, type Snapshot, type Change } from "../journal/history";
import { PHENOMENA, type Place } from "../national-watch/model";
import type { ArchivedDaily } from "../../lib/server/weather-archives";
import { isCalendarDate } from "../national/daily-availability";
import { NATIONAL } from "../national/model";
export const TEMPORAL_VERSION = "editorial-temporal-1";
export const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const shift = (date: string, days: number) =>
  new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
export const dateRange = (a: string, b: string) => {
  if (!isCalendarDate(a) || !isCalendarDate(b) || a > b)
    throw Error("TEMPORAL_PERIOD");
  const out: string[] = [];
  for (let d = a; d <= b; d = shift(d, 1)) {
    out.push(d);
    if (out.length > 60) throw Error("TEMPORAL_BUDGET");
  }
  return out;
};
export const descriptors = PHENOMENA.filter((p) => p.id !== "thi").map((p) => ({
  id: p.id,
  unit: p.id === "dry" ? "jours" : p.unit,
  field:
    p.id === "heat"
      ? "temperature_max"
      : p.id === "frost"
        ? "temperature_min"
        : "precipitation",
  index: p.id === "heat" ? 2 : p.id === "frost" ? 1 : 3,
  threshold: p.threshold,
  rule_version: `${TEMPORAL_VERSION}/${p.rule}/1`,
  criterion: p.comparison,
}));
export type Descriptor = (typeof descriptors)[number];
export interface DailyEvidence {
  date: string;
  pra: string;
  region: string;
  phenomenon: string;
  value: number | null;
  detected: boolean | null;
  signature: string;
  rule_version: string;
  unit: string;
  nature: "reanalysis";
  provenance: string[];
  data_freshness: string[];
  quality_flags: string[];
}
export function adaptHistory(
  rows: ArchivedDaily[],
  places: Place[],
  series: string,
): DailyEvidence[] {
  const regions = new Map(places.map((p) => [p.id, p.region])),
    keys = new Set<string>();
  const result: DailyEvidence[] = [];
  for (const r of rows) {
    if (
      !isCalendarDate(r.valid_date) ||
      !regions.has(r.pra_id) ||
      !Number.isFinite(Date.parse(r.computed_at))
    )
      throw Error("TEMPORAL_INPUT");
    const key = `${r.pra_id}/${r.valid_date}`;
    if (keys.has(key)) throw Error("TEMPORAL_DUPLICATE");
    keys.add(key);
    for (const p of descriptors) {
      const raw =
        r[p.field as "temperature_min" | "temperature_max" | "precipitation"];
      const full =
        r.status === "available" &&
        r.coverage.length === 4 &&
        r.coverage[p.index] >= 0.9999 &&
        r.expected_cells > 0 &&
        r.valid_counts[p.index] === r.expected_cells &&
        raw !== null &&
        Number.isFinite(raw);
      const identity = r.identity;
      const dataset = identity.dataset;
      if (
        !dataset ||
        typeof dataset !== "object" ||
        Array.isArray(dataset) ||
        !("source_id" in dataset) ||
        dataset.source_id !== "era5-land" ||
        !("dataset_version" in dataset) ||
        dataset.dataset_version !== NATIONAL.dataset ||
        identity.method !== "pra-native-1"
      )
        throw Error("TEMPORAL_SOURCE_NATURE");
      const identityComplete = [
        "dataset",
        "method",
        "weights_sha256",
        "reference_geometry_sha256",
      ].every((k) => identity[k] !== undefined);
      const signature = hash([
        series,
        identity.dataset,
        identity.method,
        identity.weights_sha256,
        identity.reference_geometry_sha256,
        identity.parameters ?? null,
        r.expected_cells,
        p.field,
        p.unit,
        p.rule_version,
      ]);
      const value = full && identityComplete ? raw : null;
      result.push({
        date: r.valid_date,
        pra: r.pra_id,
        region: regions.get(r.pra_id)!,
        phenomenon: p.id,
        value,
        detected:
          value === null
            ? null
            : p.id === "frost" || p.id === "dry"
              ? value < p.threshold
              : value > p.threshold,
        signature,
        rule_version: p.rule_version,
        unit: p.unit,
        nature: "reanalysis",
        provenance: [r.batch_key, signature],
        data_freshness: [r.computed_at],
        quality_flags: [
          ...r.quality_flags,
          ...(value === null ? ["partial_or_missing_native_support"] : []),
        ],
      });
    }
  }
  return result.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.pra.localeCompare(b.pra) ||
      a.phenomenon.localeCompare(b.phenomenon),
  );
}
export interface TemporalComparison {
  id: string;
  region: string;
  phenomenon: string;
  horizon: 3 | 7 | 14 | 30;
  kind:
    | "historical_evolution"
    | "forecast_revision"
    | "not_comparable"
    | "insufficient_history";
  change: Change;
  support_count: number;
  excluded_count: number;
  support_sha256: string;
  period: [string, string];
  previous_period: [string, string];
  provenance: string[];
}
/** Wrap the T31 comparator, preserving its scientific compatibility gates. */
export function qualifiedCompare(
  current: Snapshot,
  previous: Snapshot | undefined,
  horizon: Change["horizon"],
) {
  const change = compare(current, previous, horizon);
  const kind: TemporalComparison["kind"] =
    change.status === "insufficient_history"
      ? "insufficient_history"
      : change.status === "unknown"
        ? "not_comparable"
        : current.nature === "forecast"
          ? "forecast_revision"
          : "historical_evolution";
  return {
    kind,
    change:
      kind === "forecast_revision"
        ? {
            ...change,
            reason: `Révision des prévisions uniquement ; aucune évolution observée. ${change.reason}`,
          }
        : change,
  };
}
export function compareHistory(
  evidence: DailyEvidence[],
  end: string,
  places: Place[],
): TemporalComparison[] {
  const indexed = new Map(
    evidence.map((e) => [`${e.date}/${e.pra}/${e.phenomenon}`, e]),
  );
  const availableDates = new Set(evidence.map((e) => e.date));
  const output: TemporalComparison[] = [];
  for (const region of [...new Set(places.map((p) => p.region))].sort())
    for (const p of descriptors)
      for (const h of [3, 7, 14, 30] as const) {
        const all = places
            .filter((v) => v.region === region)
            .map((v) => v.id)
            .sort(),
          start = shift(end, -2 * h + 1),
          dates = dateRange(start, end),
          prevEnd = shift(end, -h),
          currentStart = shift(end, -h + 1);
        const exists = dates.every((d) => availableDates.has(d));
        const support = all.filter((id) => {
          const rows = dates.map((d) => indexed.get(`${d}/${id}/${p.id}`));
          return (
            rows.every((r) => r?.value !== null && r?.value !== undefined) &&
            new Set(rows.map((r) => r!.signature)).size === 1
          );
        });
        const support_sha256 = hash(
          support.map((id) => [
            id,
            indexed.get(`${end}/${id}/${p.id}`)?.signature,
          ]),
        );
        function snapshot(a: string, b: string): Snapshot {
          const ds = dateRange(a, b),
            affected: string[] = [],
            magnitudes: number[] = [];
          for (const id of support) {
            const rows = ds.map((d) => indexed.get(`${d}/${id}/${p.id}`)!);
            let longest = 0,
              streak = 0;
            for (const r of rows) {
              streak = r.detected ? streak + 1 : 0;
              longest = Math.max(longest, streak);
            }
            const detected =
              p.id === "dry" ? longest >= 3 : rows.some((r) => r.detected);
            if (detected) affected.push(id);
            if (p.id === "dry") magnitudes.push(longest);
            else
              magnitudes.push(
                Math.max(
                  ...rows.map((r) => (p.id === "frost" ? -r.value! : r.value!)),
                ),
              );
          }
          return {
            nature: "reanalysis",
            source: "era5-land",
            model: support_sha256,
            version: p.rule_version,
            unit: p.unit,
            period: [a, b],
            date: b,
            complete: support.length > 0,
            pra_ids: affected,
            evaluated_ids: support,
            magnitude: magnitudes.length ? Math.max(...magnitudes) : 0,
            episode_id: `${region}/${p.id}`,
          };
        }
        const current = snapshot(currentStart, end),
          previous = exists ? snapshot(start, prevEnd) : undefined;
        const comparison = qualifiedCompare(current, previous, h);
        output.push({
          id: hash([region, p.id, h, end, support_sha256]),
          region,
          phenomenon: p.id,
          horizon: h,
          ...comparison,
          support_count: support.length,
          excluded_count: all.length - support.length,
          support_sha256,
          period: current.period,
          previous_period: [start, prevEnd],
          provenance: [
            ...new Set(
              dates.flatMap((d) =>
                support.flatMap(
                  (id) => indexed.get(`${d}/${id}/${p.id}`)?.provenance ?? [],
                ),
              ),
            ),
          ].sort(),
        });
      }
  return output;
}
export interface ClimateEpisode {
  id: string;
  phenomenon: string;
  nature: "reanalysis";
  pra_ids: string[];
  regions: string[];
  documented_start: string;
  documented_end: string;
  closed_at: string | null;
  status: "ongoing_at_cutoff" | "ended" | "continuity_unconfirmed";
  left_censored: boolean;
  duration_days: number;
  value: number;
  unit: string;
  signature: string;
  rule_version: string;
  data_freshness: string[];
  provenance: string[];
  quality_flags: string[];
  observations: { date: string; value: number; fact_id: string }[];
  limitations: string[];
  algorithm_version: string;
}
export function reconstructEpisodes(
  evidence: DailyEvidence[],
  cutoff: string,
): ClimateEpisode[] {
  const grouped = new Map<string, DailyEvidence[]>();
  for (const e of evidence.filter((e) => e.date <= cutoff)) {
    const key = `${e.pra}/${e.phenomenon}`;
    const list = grouped.get(key) ?? [];
    list.push(e);
    grouped.set(key, list);
  }
  const output: ClimateEpisode[] = [];
  for (const rows of grouped.values()) {
    rows.sort((a, b) => a.date.localeCompare(b.date));
    let active: DailyEvidence[] = [];
    const flush = (next?: DailyEvidence) => {
      if (!active.length) return;
      const first = active[0],
        last = active.at(-1)!;
      if (first.phenomenon !== "dry" || active.length >= 3) {
        const before = rows.find((r) => r.date === shift(first.date, -1)),
          closed =
            next?.date === shift(last.date, 1) &&
            next.signature === last.signature &&
            next.detected === false;
        output.push({
          id: hash([first.pra, first.phenomenon, first.date, first.signature]),
          phenomenon: first.phenomenon,
          nature: "reanalysis",
          pra_ids: [first.pra],
          regions: [first.region],
          documented_start: first.date,
          documented_end: last.date,
          closed_at: closed ? next!.date : null,
          status: closed
            ? "ended"
            : last.date === cutoff
              ? "ongoing_at_cutoff"
              : "continuity_unconfirmed",
          left_censored:
            !before ||
            before.detected === null ||
            before.signature !== first.signature,
          duration_days: active.length,
          value:
            first.phenomenon === "dry"
              ? active.length
              : first.phenomenon === "frost"
                ? Math.min(...active.map((r) => r.value!))
                : Math.max(...active.map((r) => r.value!)),
          unit: first.unit,
          signature: first.signature,
          rule_version: first.rule_version,
          data_freshness: [
            ...new Set(active.flatMap((r) => r.data_freshness)),
          ].sort(),
          provenance: [...new Set(active.flatMap((r) => r.provenance))].sort(),
          quality_flags: [
            ...new Set(active.flatMap((r) => r.quality_flags)),
          ].sort(),
          observations: active.map((r) => ({
            date: r.date,
            value: r.value!,
            fact_id: hash([r.date, r.pra, r.phenomenon, r.signature, r.value]),
          })),
          limitations: [
            "Durée documentée minimale ; bornes de l’archive et interruptions conservées.",
            "Pas de sécheresse agricole, stade, dommage ou surface agricole déduits.",
          ],
          algorithm_version: TEMPORAL_VERSION,
        });
      }
      active = [];
    };
    for (const r of rows) {
      const last = active.at(-1);
      if (
        last &&
        (r.date !== shift(last.date, 1) ||
          r.signature !== last.signature ||
          r.detected !== true)
      )
        flush(r);
      if (r.detected === true) active.push(r);
    }
    flush();
  }
  return output.sort((a, b) => a.id.localeCompare(b.id));
}
/** Explicit append-only association for successive qualified batches at the same PRA. */
export function extendEpisode(
  previous: ClimateEpisode,
  next: ClimateEpisode,
): ClimateEpisode {
  if (
    previous.status === "ended" ||
    previous.signature !== next.signature ||
    previous.phenomenon !== next.phenomenon ||
    previous.nature !== next.nature ||
    previous.pra_ids.join() !== next.pra_ids.join() ||
    next.documented_start < previous.documented_start ||
    next.documented_end < previous.documented_end ||
    next.documented_start > shift(previous.documented_end, 1)
  )
    throw Error("EPISODE_LINK_INCOMPATIBLE");
  const observations = new Map(previous.observations.map((o) => [o.date, o]));
  for (const o of next.observations) {
    const old = observations.get(o.date);
    if (old && hash(old) !== hash(o)) throw Error("EPISODE_REVISION_CONFLICT");
    observations.set(o.date, o);
  }
  const merged = [...observations.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  if (dateRange(merged[0].date, merged.at(-1)!.date).length !== merged.length)
    throw Error("EPISODE_GAP");
  return {
    ...next,
    id: previous.id,
    documented_start: previous.documented_start,
    left_censored: previous.left_censored,
    documented_end: merged.at(-1)!.date,
    duration_days: merged.length,
    observations: merged,
    value:
      previous.phenomenon === "dry"
        ? merged.length
        : previous.phenomenon === "frost"
          ? Math.min(...merged.map((o) => o.value))
          : Math.max(...merged.map((o) => o.value)),
    provenance: [
      ...new Set([...previous.provenance, ...next.provenance]),
    ].sort(),
    data_freshness: [
      ...new Set([...previous.data_freshness, ...next.data_freshness]),
    ].sort(),
    quality_flags: [
      ...new Set([...previous.quality_flags, ...next.quality_flags]),
    ].sort(),
  };
}
