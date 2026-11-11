import Ajv from "ajv";
import addFormats from "ajv-formats";
import schema from "../../../../contracts/jsonschema/editorial-briefing-1.schema.json";
import episodeSchema from "../../../../contracts/jsonschema/climate-episode-memory-1.schema.json";
import type { ClimateEpisode } from "./temporal";
import type { EditorialBriefingBundle } from "./briefing";
import { hash } from "./temporal";
const ajv = new Ajv({ strict: true });
addFormats(ajv);
const check = ajv.compile<EditorialBriefingBundle>(schema);
export class BriefingContractError extends Error {
  constructor(readonly diagnostics:{path:string;keyword:string}[]) {super("EDITORIAL_BRIEFING_CONTRACT");}
}
export function assertBriefing(
  value: unknown,
): asserts value is EditorialBriefingBundle {
  if (!check(value))
    throw new BriefingContractError((check.errors??[]).map(e=>({path:e.instancePath,keyword:e.keyword})));
  if (Buffer.byteLength(JSON.stringify(value)) > 96 * 1024)
    throw Error("EDITORIAL_BRIEFING_BUDGET");
  if (hash({ ...value, bundle_id: undefined }) !== value.bundle_id)
    throw Error("EDITORIAL_BRIEFING_CHECKSUM");
  const facts = new Set(value.national.facts.map((f) => f.id)),
    candidates = new Set(value.candidates.map((c) => c.id)),
    comparisons = new Set(value.national.comparisons.map((c) => c.id)),
    windows = new Set(value.seasonal.windows.map((w) => w.id)),
    pubs = new Set(value.documentary.publications.map((p) => p.id));
  if (
    facts.size !== value.national.facts.length ||
    candidates.size !== value.candidates.length ||
    value.candidates.some(
      (c) =>
        c.evidence_ids.some((id) => !facts.has(id)) ||
        !c.evidence_ids.length ||
        c.temporal_ids.some((id) => !comparisons.has(id)) ||
        c.seasonal_window_ids.some((id) => !windows.has(id)) ||
        c.news_ids.some((id) => !pubs.has(id)),
    ) ||
    value.contributions.some((c) => !facts.has(c.fact_id)) ||
    value.journal_proposals.headline_candidate_ids.some(
      (id) =>
        !candidates.has(id) ||
        !value.candidates.find((c) => c.id === id)?.rationale.fresh,
    ) ||
    value.documentary.links.some((l) => !pubs.has(l.publication_id))
  )
    throw Error("EDITORIAL_BRIEFING_REFERENCES");
  if (
    value.documentary.weak_matches.some(
      (l) =>
        l.relation !== "documentary-candidate" || !pubs.has(l.publication_id),
    )
  )
    throw Error("WEAK_DOCUMENTARY_REFERENCE");
  for (const c of value.candidates)
    if (c.nature === "forecast" && c.temporal_ids.length)
      throw Error("FORECAST_OBSERVED_TREND");
  for (const c of value.national.comparisons)
    if (
      (c.kind === "historical_evolution" && c.change.nature === "forecast") ||
      (c.kind === "forecast_revision" && c.change.nature !== "forecast")
    )
      throw Error("TEMPORAL_NATURE");
  for (const f of value.national.facts)
    if (
      !f.provenance.length ||
      !f.data_freshness.length ||
      f.period[0] > f.period[1]
    )
      throw Error("EDITORIAL_FACT_PROVENANCE");
}

const checkMemory = ajv.compile<{
  version: "climate-episode-memory-1";
  cutoff: string;
  episodes: ClimateEpisode[];
}>(episodeSchema);
export function assertEpisodeMemory(value: unknown): asserts value is {
  version: "climate-episode-memory-1";
  cutoff: string;
  episodes: ClimateEpisode[];
} {
  if (!checkMemory(value))
    throw Error(
      "EPISODE_MEMORY_CONTRACT: " + ajv.errorsText(checkMemory.errors),
    );
  for (const e of value.episodes)
    if (
      e.observations.length !== e.duration_days ||
      e.observations[0].date !== e.documented_start ||
      e.observations.at(-1)!.date !== e.documented_end ||
      (e.status === "ended" && e.closed_at === null)
    )
      throw Error("EPISODE_MEMORY_CONTINUITY");
}
