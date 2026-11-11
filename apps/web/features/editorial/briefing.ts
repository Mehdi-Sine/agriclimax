import type { JournalEdition, EditorialFact } from "../journal/model";
import { assertEdition } from "../journal/validate";
import { validateContribution, type Contribution } from "../journal/registry";
import {
  getSeasonalEditorialContext,
  ALMANAC_VERSION,
  almanacReceipt,
  almanac,
  parisDate,
} from "./almanac";
import {
  hash,
  TEMPORAL_VERSION,
  type DailyEvidence,
  type ClimateEpisode,
  type TemporalComparison,
} from "./temporal";
import bridge from "../../../../config/almanach/editorial-signal-bridge.v1.json";
export const BRIEFING_VERSION = "editorial-briefing-1";
export interface DocumentaryLink {
  publication_id: string;
  event_id: string;
  axes: Record<string, "match" | "unknown" | "mismatch">;
  temporal_distance_days: number;
  relation:
    | "documentary-candidate"
    | "documentary-overlap"
    | "documentary-background";
  scientific_confirmation: false;
  limitation: string;
}
export interface DocumentaryPublication {
  id: string;
  source_id: string;
  publisher: string;
  title: string;
  original_url: string;
  published_at: string | null;
  content_type: string;
  limitations: string[];
}
export interface NewsContext {
  bundle_id: string;
  generated_at: string;
  publications: DocumentaryPublication[];
  links: DocumentaryLink[];
}
export interface BriefingInput {
  date: string;
  generated_at: string;
  history_cutoff: string;
  source_fingerprint: string;
  history: DailyEvidence[];
  episodes: ClimateEpisode[];
  comparisons: TemporalComparison[];
  episode_archive_sha256: string;
  edition?: JournalEdition;
  contributions?: Contribution[];
  news?: NewsContext;
  previous_topic_keys?: string[];
}
export function briefingEvents(
  input: Pick<BriefingInput, "episodes" | "history_cutoff" | "edition">,
) {
  const grouped = new Map<string, ClimateEpisode[]>();
  for (const e of input.episodes.filter(
    (e) => e.documented_end === input.history_cutoff,
  )) {
    const key = `${e.phenomenon}/${e.regions[0]}`;
    const list = grouped.get(key) ?? [];
    list.push(e);
    grouped.set(key, list);
  }
  const historical = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, es]) => ({
      id: hash([key, input.history_cutoff, es.map((e) => e.id).sort()]),
      phenomenon: es[0].phenomenon,
      region: es[0].regions[0],
      period: [
        es.map((e) => e.documented_start).sort()[0],
        input.history_cutoff,
      ] as [string, string],
      production_ids: [] as string[],
      provenance: es.map((e) => e.id),
      episodes: es,
    }));
  const events = input.edition
    ? [
        ...(input.edition.main_story ? [input.edition.main_story] : []),
        ...input.edition.secondary_stories,
        ...input.edition.regional_sections.flatMap((r) => r.events),
      ]
    : [];
  return {
    historical,
    forecast: [...new Map(events.map((e) => [e.id, e])).values()],
  };
}
export function buildBriefing(input: BriefingInput) {
  const seasonal = getSeasonalEditorialContext(
      input.date,
      undefined,
      undefined,
      40,
    ),
    events = briefingEvents(input);
  if (input.edition) assertEdition(input.edition);
  const generatedMs = Date.parse(input.generated_at);
  if (
    !Number.isFinite(generatedMs) ||
    input.history_cutoff > input.date ||
    input.history.some((e) => e.date > input.history_cutoff)
  )
    throw Error("BRIEFING_DATE");
  const contributions = (
    input.contributions ??
    input.edition?.production_sections ??
    []
  ).map(validateContribution);
  const selectedIndicators = contributions
    .flatMap((c) =>
      c.indicators
        .filter(
          (i) =>
            i.status === "available" &&
            i.qualified &&
            i.publishable &&
            i.provenance.length &&
            i.facts?.length,
        )
        .flatMap((i) =>
          i.facts!.map((f) => ({ production: c.id, indicator: i.id, fact: f })),
        ),
    )
    .slice(0, 20);
  const facts: EditorialFact[] = events.historical.map((e) => {
    const es = e.episodes,
      phenomenon = es[0].phenomenon,
      days = Math.max(...es.map((v) => v.duration_days));
    const value =
      phenomenon === "dry"
        ? days
        : phenomenon === "frost"
          ? Math.min(...es.map((v) => v.value))
          : Math.max(...es.map((v) => v.value));
    return {
      id: `fact-${e.id}`,
      text: `${e.region} : ${es.length} PRA avec ${phenomenon === "dry" ? "au moins trois jours consécutifs < 1 mm/j" : phenomenon === "frost" ? "Tmin < 0 °C" : phenomenon === "heat" ? "Tmax > 25 °C" : "pluie > 20 mm/j"}, en réanalyse au ${input.history_cutoff}. Durée documentée maximale : ${days} jours.`,
      value,
      unit: es[0].unit,
      period: e.period,
      source: "era5-land",
      rule_version: es[0].rule_version,
      provenance: [input.source_fingerprint, input.episode_archive_sha256],
      quality_flags: [
        "complete_native_support_only",
        "pra_count_not_agricultural_area",
      ],
      data_freshness: [...new Set(es.flatMap((v) => v.data_freshness))]
        .sort()
        .slice(-1),
      href: "/",
    };
  });
  const forecastFacts = input.edition?.evidence.facts ?? [];
  const allFacts = [
    ...facts,
    ...forecastFacts,
    ...selectedIndicators.map((i) => i.fact),
  ];
  const factMap = new Map(allFacts.map((f) => [f.id, f]));
  const usedPublications = new Set<string>();
  const topicRows = [
    ...events.historical.map((e) => ({
      id: e.id,
      phenomenon: e.phenomenon,
      region: e.region,
      period: e.period,
      nature: "reanalysis" as const,
      fact_ids: [`fact-${e.id}`],
      breadth: e.episodes.length,
      duration: Math.max(...e.episodes.map((v) => v.duration_days)),
      production_ids: e.production_ids,
    })),
    ...events.forecast.map((e) => ({
      id: e.id,
      phenomenon: e.phenomenon,
      region: e.region,
      period: e.period,
      nature: "forecast" as const,
      fact_ids: e.facts,
      breadth: e.pra_ids.length,
      duration: 0,
      production_ids: e.production_ids,
    })),
  ];
  const ranked = topicRows
    .map((e) => {
      const key = `${e.nature}/${e.phenomenon}/${e.region}`;
      const signals =
        (bridge.mapping as Record<string, string[]>)[e.phenomenon] ?? [];
      const windows = seasonal.windows
        .filter((w) => w.signal_ids.some((s) => signals.includes(s)))
        .slice(0, 3);
      const changes = input.comparisons.filter(
        (c) =>
          e.nature === "reanalysis" &&
          c.region === e.region &&
          c.phenomenon === e.phenomenon &&
          c.kind === "historical_evolution",
      );
      const links = (input.news?.links ?? []).filter(
        (l) =>
          l.event_id === e.id &&
          l.relation === "documentary-overlap" &&
          input.news?.publications.some(
            (p) =>
              p.id === l.publication_id &&
              p.published_at !== null &&
              parisDate(p.published_at) <= input.date,
          ),
      );
      links.forEach((l) => usedPublications.add(l.publication_id));
      const stale =
        e.period[1] < input.date ||
        (e.nature === "forecast" && input.edition?.data_freshness !== "fresh");
      return {
        id: hash([key, e.id, input.date]),
        topic_key: key,
        title: `${e.nature === "forecast" ? "Prévisions" : "Réanalyse historique"} : ${e.phenomenon} en ${e.region}`,
        question:
          windows[0]?.question ??
          "Que montrent les données qualifiées sur ce territoire ?",
        phenomenon: e.phenomenon,
        regions: [e.region],
        productions: e.production_ids,
        production_context: [...new Set(windows.flatMap((w) => w.productions))],
        production_context_status: "seasonal_hypothesis_not_presence",
        nature: e.nature,
        period: e.period,
        evidence_ids: e.fact_ids,
        temporal_ids: changes.slice(-1).map((c) => c.id),
        seasonal_window_ids: windows.map((w) => w.id),
        news_ids: links.map((l) => l.publication_id),
        qualification: "proposal_requires_editorial_review",
        missing: ["Stades et observations de terrain non fournis."],
        limitations: [
          stale
            ? "Archive historique : ne décrit pas la situation actuelle."
            : "Contexte agricole à vérifier.",
          bridge.limitation,
        ],
        rationale: {
          fresh: !stale,
          qualified_evidence: true,
          temporal: changes.length > 0,
          affected_pra: e.breadth,
          duration_days: e.duration,
          seasonal_match: windows.length > 0,
          documentary_matches: links.length,
          novel: !(input.previous_topic_keys ?? []).includes(key),
        },
        publication_eligible: false as const,
      };
    })
    .sort(
      (a, b) =>
        Number(b.rationale.fresh) - Number(a.rationale.fresh) ||
        Number(b.rationale.temporal) - Number(a.rationale.temporal) ||
        b.rationale.affected_pra - a.rationale.affected_pra ||
        b.rationale.duration_days - a.rationale.duration_days ||
        Number(b.rationale.seasonal_match) -
          Number(a.rationale.seasonal_match) ||
        b.rationale.documentary_matches - a.rationale.documentary_matches ||
        Number(b.rationale.novel) - Number(a.rationale.novel) ||
        a.id.localeCompare(b.id),
    );
  // Diversity is a deterministic second pass; no summed physical or agronomic score.
  const byPhenomenon = ranked.filter(
    (r, i) => ranked.findIndex((v) => v.phenomenon === r.phenomenon) === i,
  );
  const byRegion = ranked.filter(
    (r, i) => ranked.findIndex((v) => v.regions[0] === r.regions[0]) === i,
  );
  const candidates = [
    ...new Set([...byPhenomenon, ...byRegion, ...ranked]),
  ].slice(0, 12);
  const weakMatches = (input.news?.links ?? [])
    .filter(
      (l) =>
        l.relation === "documentary-candidate" &&
        input.news?.publications.some(
          (p) =>
            p.id === l.publication_id &&
            p.published_at !== null &&
            parisDate(p.published_at) <= input.date,
        ),
    )
    .slice(0, 20);
  weakMatches.forEach((l) => usedPublications.add(l.publication_id));
  const seasonalSources = new Set(
    seasonal.windows
      .filter((w) =>
        candidates.some((c) => c.seasonal_window_ids.includes(w.id)),
      )
      .flatMap((w) => w.source_ids),
  );
  const neededFacts = new Set([
    ...candidates.flatMap((c) => c.evidence_ids),
    ...selectedIndicators.map((i) => i.fact.id),
  ]);
  const bundleFacts = [...factMap.values()].filter((f) =>
    neededFacts.has(f.id),
  );
  const sourceDates = [...new Set(input.history.map((e) => e.date))].sort();
  const completeAtCutoff = new Map<string, number>();
  for (const e of input.history.filter(
    (e) => e.date === input.history_cutoff && e.value !== null,
  ))
    completeAtCutoff.set(e.pra, (completeAtCutoff.get(e.pra) ?? 0) + 1);
  const cutoffAge = Math.floor(
    (Date.parse(input.date) - Date.parse(input.history_cutoff)) / 86400000,
  );
  const neededComparisons = new Set(candidates.flatMap((c) => c.temporal_ids));
  const comparisonSummary = input.comparisons
    .filter(
      (c) =>
        neededComparisons.has(c.id) ||
        (c.horizon === 30 &&
          c.region === candidates[0]?.regions[0] &&
          c.phenomenon === candidates[0]?.phenomenon),
    )
    .map(({ provenance, ...c }) => ({
      ...c,
      provenance_sha256: hash(provenance),
    }));
  const result = {
    version: BRIEFING_VERSION,
    bundle_id: "",
    edition_date: seasonal.date,
    time_zone: "Europe/Paris",
    generated_at: input.generated_at,
    status: sourceDates.length ? "preview" : "insufficient_data",
    identity: {
      engine: TEMPORAL_VERSION,
      almanac_version: ALMANAC_VERSION,
      almanac_sha256: almanacReceipt.sha256,
      climate_fingerprint: input.source_fingerprint,
      episode_archive_sha256: input.episode_archive_sha256,
      forecast_edition_id: input.edition?.edition_id ?? null,
      news_bundle_id: input.news?.bundle_id ?? null,
      signal_bridge_version: bridge.version,
      contribution_fingerprint: hash(contributions),
      previous_topics_sha256: hash(input.previous_topic_keys ?? []),
    },
    validity: {
      history_start: sourceDates[0] ?? null,
      history_cutoff: input.history_cutoff,
      history_age_days: cutoffAge,
      forecast_period: input.edition?.main_story?.period ?? null,
      data_freshness: cutoffAge > 2 ? "stale" : "fresh",
    },
    national: {
      facts: bundleFacts,
      comparisons: comparisonSummary,
      horizon_diagnostics: ([3, 7, 14, 30] as const).map((horizon) => ({
        horizon,
        comparable: input.comparisons.filter(
          (c) => c.horizon === horizon && c.kind === "historical_evolution",
        ).length,
        not_comparable: input.comparisons.filter(
          (c) => c.horizon === horizon && c.kind === "not_comparable",
        ).length,
        insufficient_history: input.comparisons.filter(
          (c) => c.horizon === horizon && c.kind === "insufficient_history",
        ).length,
      })),
      episodes: {
        archive_sha256: input.episode_archive_sha256,
        total: input.episodes.length,
        active_at_historical_cutoff: input.episodes.filter(
          (e) => e.status === "ongoing_at_cutoff",
        ).length,
        sample_ids: input.episodes.slice(0, 16).map((e) => e.id),
      },
      coverage: {
        total_pra: 713,
        complete_pra_at_cutoff: [...completeAtCutoff.values()].filter(
          (n) => n === 4,
        ).length,
        nature: "reanalysis",
        basis: "native_support_per_variable",
        proportions_are: "PRA_counts_not_agricultural_area",
      },
    },
    candidates,
    contributions: selectedIndicators.map((i) => ({
      production: i.production,
      indicator: i.indicator,
      fact_id: i.fact.id,
    })),
    seasonal: {
      version: seasonal.version,
      date: seasonal.date,
      windows: seasonal.windows.filter((w) =>
        candidates.some((c) => c.seasonal_window_ids.includes(w.id)),
      ),
      sources: almanac.sources.filter((s) => seasonalSources.has(s.id)),
      markers: seasonal.markers.map((m) => ({
        id: m.id,
        title: m.titre,
        qualification: "cultural_or_documentary_not_predictive",
      })),
      unresolved_mobile_events: seasonal.mobile_events
        .filter((m) => m.date === null)
        .map((m) => m.name),
      background_questions: ranked.length
        ? []
        : seasonal.windows.slice(0, 2).map((w) => ({
            window_id: w.id,
            question: w.question,
            publication_eligible: false,
          })),
    },
    documentary: {
      bundle_id: input.news?.bundle_id ?? null,
      weak_matches: weakMatches,
      publications: (input.news?.publications ?? [])
        .filter((p) => usedPublications.has(p.id))
        .slice(0, 20)
        .map(({id,source_id,publisher,title,original_url,published_at,content_type,limitations})=>({id,source_id,publisher,title,original_url,published_at,content_type,limitations})),
      links: (input.news?.links ?? [])
        .filter((l) =>
          candidates.some(
            (c) =>
              c.news_ids.includes(l.publication_id) &&
              topicRows.some(
                (t) =>
                  t.id === l.event_id &&
                  c.evidence_ids.some((id) => t.fact_ids.includes(id)),
              ),
          ),
        )
        .slice(0, 40),
      scientific_confirmation: false,
    },
    journal_proposals: {
      headline_candidate_ids: candidates
        .filter((c) => c.rationale.fresh)
        .slice(0, 3)
        .map((c) => c.id),
      regional_candidate_ids: candidates.map((c) => c.id),
      production_fact_ids: selectedIndicators.map((i) => i.fact.id),
      visualizations: candidates
        .filter((c) => c.nature === "forecast")
        .slice(0, 3)
        .map((c) => ({
          kind: "existing_watch_map",
          href: "/veille",
          evidence_ids: c.evidence_ids,
        })),
      verify_before_writing: [
        "Fraîcheur, couverture et provenance des preuves.",
        "Présence réelle des productions et stades : données de terrain nécessaires.",
        "Publications externes : contexte documentaire, jamais confirmation scientifique.",
      ],
    },
    limitations: [
      "Dossier préparatoire déterministe ; aucun article ni alerte généré.",
      "Aucune moyenne non pondérée, aucun dommage, rendement ni sécheresse agricole inféré.",
      "Épisodes à la maille PRA ; narration régionale indicative.",
      "Deux fenêtres indépendantes de 30 jours exigent 60 journées compatibles.",
      "Les états partiels et dates manquantes interrompent la continuité.",
      ...(cutoffAge > 2
        ? ["Historique ancien au regard de la date éditoriale."]
        : []),
    ],
  };
  result.bundle_id = hash({ ...result, bundle_id: undefined });
  return result;
}
export type EditorialBriefingBundle = ReturnType<typeof buildBriefing>;
