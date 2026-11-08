import Ajv from "ajv";
import schema from "../../../../contracts/jsonschema/editorial-draft-1.schema.json";
import places from "../../data/operational/pra-watch-places.json";
import { assertBriefing } from "../editorial/validate";
import { hash } from "../editorial/temporal";
import {
  allBlocks,
  type EditorialDraft,
  type Illustration,
  type Validation,
} from "./model";
import type { EditorialBriefingBundle } from "../editorial/briefing";
const check = new Ajv({ strict: true }).compile<EditorialDraft>(schema);
export function assertDraft(value: unknown): asserts value is EditorialDraft {
  if (!check(value))
    throw Error("DRAFT_CONTRACT: " + JSON.stringify(check.errors));
}
export function validateDraft(
  value: unknown,
  b: EditorialBriefingBundle,
  assets: Illustration[] = [],
): Validation {
  assertBriefing(b);
  try {
    assertDraft(value);
  } catch {
    return { status: "rejected", errors: ["DRAFT_CONTRACT"], review: [] };
  }
  const d = value,
    errors: string[] = [],
    review = new Set<string>();
  const facts = new Map(b.national.facts.map((f) => [f.id, f])),
    candidates = new Map(b.candidates.map((c) => [c.id, c]));
  const regions = new Set(places.places.map((p) => p.region)),
    windows = new Set(b.seasonal.windows.map((w) => w.id));
  const selected = [d.main_candidate_id, ...d.secondary_candidate_ids].filter(
    (x): x is string => x !== null,
  );
  if (d.bundle_id !== b.bundle_id || d.edition_date !== b.edition_date)
    errors.push("DRAFT_IDENTITY");
  if (
    selected.some((id) => !candidates.has(id)) ||
    d.alternatives.some((a) => !candidates.has(a.candidate_id))
  )
    errors.push("CANDIDATE_REFERENCE");
  const eligibleNews = new Set(
    selected.flatMap((id) => candidates.get(id)?.news_ids ?? []),
  );
  if (
    d.news_ids.some(
      (id) =>
        !eligibleNews.has(id) ||
        !b.documentary.links.some(
          (l) =>
            l.publication_id === id &&
            l.relation === "documentary-overlap" &&
            l.scientific_confirmation === false,
        ),
    )
  )
    errors.push("DOCUMENTARY_REFERENCE");
  if (
    d.regions.some(
      (r) =>
        !regions.has(r.region) ||
        !b.candidates.some((c) => c.regions.includes(r.region)),
    )
  )
    errors.push("REGION_REFERENCE");
  if (
    d.productions.some(
      (p) => !b.contributions.some((c) => c.production === p.production_id),
    )
  )
    errors.push("PRODUCTION_REFERENCE");
  for (const f of d.key_figures) {
    const source = facts.get(f.fact_id),
      related = b.candidates.filter((c) => c.evidence_ids.includes(f.fact_id));
    if (
      !source ||
      f.value !== source.value ||
      f.unit !== source.unit ||
      JSON.stringify(f.period) !== JSON.stringify(source.period)
    )
      errors.push("FIGURE_MISMATCH");
    if (
      f.region !== null &&
      (!regions.has(f.region) ||
        !related.some((c) => c.regions.includes(f.region!)))
    )
      errors.push("FIGURE_REGION");
    if (f.pra_id !== null) {
      const p = places.places.find((p) => p.id === f.pra_id);
      if (!p || p.region !== f.region || !source?.provenance.includes(f.pra_id))
        errors.push("PRA_ATTRIBUTION");
    }
    if (f.scope === "pra" && f.pra_id === null) errors.push("FIGURE_SCOPE");
    if (
      (related.length &&
        (f.region === null || f.scope === "national_sample")) ||
      (f.scope === "regional_sample" && f.region === null)
    )
      errors.push("FIGURE_SCOPE");
    if (related.length && !related.some((c) => c.nature === f.nature))
      errors.push("FIGURE_NATURE");
    if (!related.length && f.nature !== "descriptive")
      errors.push("FIGURE_NATURE");
    if (source?.quality_flags.some((q) => /partial/i.test(q)))
      review.add("PARTIAL_SUPPORT");
  }
  for (const block of allBlocks(d)) {
    const fs = block.evidence_ids.map((id) => facts.get(id));
    if (fs.some((f) => !f) || block.seasonal_ids.some((id) => !windows.has(id)))
      errors.push("BLOCK_REFERENCE");
    if (block.kind === "fact" && !block.evidence_ids.length)
      errors.push("UNSUPPORTED_ASSERTION");
    if (
      block.kind === "context" &&
      !block.seasonal_ids.length &&
      !block.evidence_ids.length
    )
      errors.push("UNSUPPORTED_CONTEXT");
    if (fs.some((f) => f?.text === block.text)) continue;
    const text = block.text,
      normalized = text.replace(/,/g, ".");
    const allowed = fs
      .filter((f) => f !== undefined)
      .map((f) => `${f.text} ${f.value} ${f.period.join(" ")}`)
      .join(" ")
      .replace(/,/g, ".");
    const numbers = normalized.match(/-?\d+(?:\.\d+)?/g) ?? [];
    const allowedNumbers = new Set(allowed.match(/-?\d+(?:\.\d+)?/g) ?? []);
    if (numbers.some((n) => !allowedNumbers.has(n)))
      errors.push("TEXT_NUMBER_OR_DATE");
    const citedCandidates = b.candidates.filter((c) =>
      c.evidence_ids.some((id) => block.evidence_ids.includes(id)),
    );
    const allowedRegions = new Set(citedCandidates.flatMap((c) => c.regions));
    for (const r of regions)
      if (text.includes(r) && !allowedRegions.has(r))
        errors.push("TEXT_REGION");
    const allRegions = [...regions];
    if (
      /\ben\s+[A-ZÀ-Ÿ][a-zà-ÿ-]+/.test(text) &&
      !allRegions.some((r) => text.includes(r))
    )
      review.add("GEOGRAPHY_REVIEW");
    if (/\bpra[:\s-]*\d+/i.test(text))
      errors.push("TEXT_PRA_REQUIRES_EXPLICIT_PROOF");
    if (
      /(?:caus[eé]|entra[iî]n|provoqu|perte de rendement|dommages? agricoles?|mortalit[eé]|maladie|ont sem[eé]|sont en floraison|vendanges? (?:achev|r[eé]alis)|risque (?:[a-zà-ÿ]+ )?(?:agronomique|[eé]lev[eé]))/i.test(
        text,
      )
    )
      errors.push("UNPROVEN_AGRONOMY");
    if (
      /(?:toute la r[eé]gion|moyenne r[eé]gionale|surface agricole affect[eé]e|hectares?)/i.test(
        text,
      )
    )
      errors.push("REGIONAL_EXTRAPOLATION");
    if (
      /(?:confirme|confirmation scientifique)/i.test(text) &&
      !/(?:ne .{0,30}pas|jamais|sans|aucune)/i.test(text)
    )
      errors.push("DOCUMENTARY_CONFIRMATION");
    if (
      citedCandidates.some((c) => c.nature === "forecast") &&
      /(?:observ[eé]|a [eé]t[eé] mesur[eé])/i.test(text)
    )
      errors.push("FORECAST_AS_OBSERVATION");
    if (
      citedCandidates.some((c) => c.period[1] < b.edition_date) &&
      /(?:aujourd'hui|actuellement|en ce moment)/i.test(text)
    )
      errors.push("OLD_AS_CURRENT");
    if (
      fs.some((f) => f?.quality_flags.some((q) => /partial/i.test(q))) &&
      !/partiel|couverture|incomplet/i.test(text)
    )
      errors.push("UNQUALIFIED_PARTIAL");
    if (
      block.seasonal_ids.length &&
      !/th[eé]ori|habituel|saison|hypoth[eè]se|documentaire|exploratoire|\?/i.test(
        text,
      )
    )
      errors.push("SEASON_AS_OBSERVATION");
    if (
      (text.includes("°C") && !fs.some((f) => f?.unit.includes("°C"))) ||
      (/\bmm(?:\/j)?\b/.test(text) && !fs.some((f) => f?.unit.includes("mm")))
    )
      errors.push("TEXT_UNIT");
    // Exact source text can be verified deterministically. New prose always requires editorial review.
    if (!fs.some((f) => f?.text === text))
      review.add("SEMANTIC_REVIEW_REQUIRED");
  }
  for (const id of d.illustration_ids) {
    const a = assets.find((a) => a.id === id);
    if (
      !a ||
      hash(a.data) !== a.sha256 ||
      a.data.run !== a.cycle ||
      a.data.phenomenon !== a.phenomenon ||
      JSON.stringify(a.data.period) !== JSON.stringify(a.period) ||
      a.data.source !== b.identity.climate_fingerprint ||
      a.data.rows.length !== 713 ||
      new Set(a.data.rows.map((r) => r.id)).size !== 713 ||
      a.data.rows.some(
        (r) =>
          !places.places.some((p) => p.id === r.id && p.region === r.region),
      ) ||
      a.evidence_ids.some((id) => !facts.has(id)) ||
      !b.candidates.some(
        (c) =>
          c.nature === "forecast" &&
          c.phenomenon === a.phenomenon &&
          JSON.stringify(c.period) === JSON.stringify(a.period) &&
          c.evidence_ids.some((id) => a.evidence_ids.includes(id)),
      )
    )
      errors.push("ILLUSTRATION_CONTEXT");
  }
  return {
    status: errors.length
      ? "rejected"
      : review.size
        ? "needs_editorial_review"
        : "validated_automatically",
    errors: [...new Set(errors)],
    review: [...review],
  };
}
