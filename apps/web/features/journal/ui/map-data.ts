import {
  PHENOMENA,
  watchMapReading,
  type Phenomenon,
  type WatchSummary,
  type WatchEvidence,
} from "../../national-watch/model";
import { semanticPalette } from "../../cartography/registry";
export function mapTheme(phenomenon: string) {
  if (!PHENOMENA.some((p) => p.id === phenomenon))
    throw Error("UNSUPPORTED_JOURNAL_THEME");
  const themes = {
    frost: {
      title: "Températures minimales prévues",
      indicator: "frost_min",
      unit: "°C",
    },
    heat: {
      title: "Températures maximales prévues",
      indicator: "temperature_max",
      unit: "°C",
    },
    rain: {
      title: "Maximum quotidien de précipitations prévu",
      indicator: "rain",
      unit: "mm/j",
    },
    dry: {
      title: "Plus longue séquence sans pluie significative",
      indicator: "dry_sequence",
      unit: "jours",
    },
    thi: {
      title: "Maximum de THI synthétique prévu · exploratoire",
      indicator: "thi",
      unit: "THI",
    },
  };
  return themes[phenomenon as Phenomenon];
}
export function mapPalette(phenomenon: string) {
  const theme = mapTheme(phenomenon);
  return {
    ...semanticPalette(
      theme.indicator,
      phenomenon === "rain" ? "mm" : theme.unit,
      1,
    ),
    unit: theme.unit,
  };
}
export interface JournalMapData {
  run: string;
  period: [string, string];
  phenomenon: string;
  identity: string;
  source: string;
  rule_version: string;
  rows: {
    id: string;
    name: string;
    region: string;
    value: number | null;
    quality?: import("../../climate-quality/policy").CoverageQuality;
    status: "available" | "partial" | "unavailable";
    state: string;
    evidence_id: string;
  }[];
  evidence: Record<string, WatchEvidence>;
  quality?: import("../../national-watch/model").WatchSummary["quality"];
}
export function journalMapData(
  summary: WatchSummary,
  phenomenon: string,
): JournalMapData {
  mapTheme(phenomenon);
  const metrics = summary.metrics.filter((m) => m.phenomenon === phenomenon),
    byId = new Map(metrics.map((m) => [m.pra, m]));
  if (
    summary.places.length !== 713 ||
    byId.size !== 713 ||
    new Set(summary.places.map((p) => p.id)).size !== 713
  )
    throw Error("JOURNAL_MAP_COVERAGE");
  const evidence: Record<string, WatchEvidence> = {};
  const rows = summary.places.map((p) => {
    const m = byId.get(p.id);
    if (!m || !summary.evidence[m.evidence_id])
      throw Error("JOURNAL_MAP_EVIDENCE");
    const e = summary.evidence[m.evidence_id];
    const reading = watchMapReading(m, e, summary.quality);
    evidence[m.evidence_id] = e;
    return {
      id: p.id,
      name: p.name,
      region: p.region,
      ...reading,
      state: m.state,
      evidence_id: m.evidence_id,
    };
  });
  return {
    run: summary.run,
    period: summary.period,
    phenomenon,
    identity: summary.identity,
    source: summary.source_version,
    rule_version: summary.version,
    rows,
    evidence,
    ...(summary.quality ? {quality: summary.quality} : {}),
  };
}
export function sameMapContext(
  data: JournalMapData,
  run: string,
  phenomenon: string,
  period: [string, string],
  source: string,
) {
  return (
    Date.parse(data.run) === Date.parse(run) &&
    data.phenomenon === phenomenon &&
    data.period[0] === period[0] &&
    data.period[1] === period[1] &&
    data.source === source &&
    data.rows.length === 713 &&
    new Set(data.rows.map((r) => r.id)).size === 713
  );
}
export function explorerHref(run: string, phenomenon: string, pra?: string) {
  const params = new URLSearchParams({ cycle: run, phenomene: phenomenon });
  if (pra) params.set("pra", pra);
  return `/veille?${params}`;
}
