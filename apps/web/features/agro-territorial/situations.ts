import { almanac, getSeasonalEditorialContext, regionOptions } from "../editorial/almanac";
import type { DailyEvidence } from "../editorial/temporal";
import type { Place } from "../national-watch/model";
import { MATRIX, RULE_VERSION } from "./matrix";

export interface Profile {
  crops: { id: string; label: string; hectares: number | null; sha256: string }[];
  orientations: { id: string; label: string }[];
  sampled: boolean;
  systems_basin: number;
  otex_sha256: string;
}

export type TerritorialEvidence = Omit<DailyEvidence, "nature" | "region"> & {
  nature: "forecast" | "reanalysis";
  cycle?: string;
  archive?: string;
};

type Rule = typeof MATRIX[number];
export type Situation = NonNullable<ReturnType<typeof evaluate>["situation"]>;

const indicators = { rain: "rain", frost: "temperature_min", heat: "temperature_max" };

function evaluate(
  rule: Rule, place: Place, profile: Profile | undefined, evidence: TerritorialEvidence | undefined,
  windows: ReadonlySet<string>, date: string, nature: TerritorialEvidence["nature"],
) {
  const result = (state: string) => ({
    pra: place.id, date, nature, rule: rule.id, state, situation: null,
    evidence: state === "climate_insufficient" || !evidence ? null : {
      value: evidence.value, unit: evidence.unit, provenance: evidence.provenance,
    },
  });
  if (!evidence || evidence.detected === null || evidence.value === null ||
      !Number.isFinite(evidence.value) || !evidence.provenance.length ||
      !evidence.data_freshness.length || !evidence.signature) return result("climate_insufficient");
  if (!evidence.detected) return result("threshold_not_crossed");
  if (!windows.has(rule.window)) return result("outside_sensitivity_window");
  const relevant = new Set<string>(rule.productions);
  const crops = profile?.crops.filter(c => relevant.has(c.id)) ?? [];
  const orientations = profile?.orientations.filter(c => relevant.has(c.id)) ?? [];
  const labels = rule.id === "heat-cattle" ? orientations.map(p => p.label)
    : crops.filter(c => c.hectares !== null && c.hectares > 0).map(c => c.label);
  if (!labels.length) {
    const known = rule.id === "heat-cattle" ? profile?.sampled : crops.some(c => c.hectares !== null);
    return result(known ? "production_not_documented" : "agriculture_insufficient");
  }
  const { value, unit } = evidence;
  const params = new URLSearchParams({ pra: place.id });
  if (nature === "forecast") {
    params.set("cycle", evidence.cycle ?? "");
    params.set("phenomene", rule.phenomenon);
    params.set("jour", date);
    if (evidence.archive) params.set("archive", evidence.archive);
  } else {
    params.set("temporal", "history");
    params.set("date", date);
    params.set("indicateur", indicators[rule.phenomenon]);
    params.set("mode", "value");
  }
  const source = almanac.sources.find(s => s.id === rule.source)!;
  return { ...result("potential_sensitivity"), situation: {
    id: [rule.id, place.id, date, nature].join("/"),
    pra: place.id, place: place.name, region: place.region, productions: labels,
    phenomenon: rule.phenomenon, date, nature, value, unit,
    confidence: rule.id === "heat-cattle" ? "indicative" as const : "qualified_exposure" as const,
    mechanism: rule.mechanism, limitation: rule.limitation,
    window: rule.window, reference: source.url,
    href: `${nature === "forecast" ? "/veille" : "/"}?${params}`,
    rule_version: `${RULE_VERSION}/${evidence.rule_version}`,
    data_freshness: evidence.data_freshness,
    provenance: [...new Set([...evidence.provenance, ...crops.map(c => c.sha256),
      ...(rule.id === "heat-cattle" && profile ? [profile.otex_sha256] : [])])],
    quality_flags: [...evidence.quality_flags, "field_conditions_unverified",
      ...(rule.id === "heat-cattle" ? ["otex_sample_not_census"] : [])],
  } };
}

export function territorialDay(
  date: string, nature: TerritorialEvidence["nature"], places: readonly Place[],
  profiles: Record<string, Profile>, evidence: readonly TerritorialEvidence[],
) {
  const byKey = new Map(evidence.filter(e => e.date === date && e.nature === nature)
    .map(e => [`${e.pra}/${e.phenomenon}`, e]));
  const windows = new Map([...new Set(places.map(p => p.region))].map(region => [
    region, new Set(getSeasonalEditorialContext(date, regionOptions.includes(region) ? region : undefined, undefined, 40)
      .windows.map(w => w.id)),
  ]));
  return places.flatMap(place => MATRIX.map(rule => evaluate(rule, place, profiles[place.id],
    byKey.get(`${place.id}/${rule.phenomenon}`), windows.get(place.region)!, date, nature)));
}

export function shortlist(situations: readonly Situation[], limit = 3) {
  // Prefer the most widespread groups of qualified PRA; keep one representative PRA per group.
  const groups = new Map<string, Situation[]>();
  for (const situation of situations) {
    const key = [situation.phenomenon, situation.region, situation.nature, situation.date].join("/");
    const group = groups.get(key) ?? [];
    group.push(situation);
    groups.set(key, group);
  }
  const ranked = [...groups.values()].map(group => ({
    size: new Set(group.map(s => s.pra)).size,
    item: group.sort((a, b) => (a.phenomenon === "frost" ? a.value - b.value : b.value - a.value)
      || a.id.localeCompare(b.id))[0],
  }));
  return ranked.sort((a, b) => b.size - a.size || b.item.date.localeCompare(a.item.date) ||
    a.item.id.localeCompare(b.item.id)).slice(0, limit).map(group => group.item);
}
