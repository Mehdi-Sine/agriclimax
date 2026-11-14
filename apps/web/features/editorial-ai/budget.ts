import "server-only";
import type { EditorialBriefingBundle } from "../editorial/briefing";
import type { Illustration } from "./model";
import type { Run } from "./archive";
import { cost, type AIConfig } from "./config";
import { inputTokenBound } from "./provider";
export function editorialPayload(
  briefing: EditorialBriefingBundle,
  assets: Illustration[] = [],
  mapSelection?: unknown,
) {
  return JSON.stringify({
    briefing,
    ...(mapSelection ? {map_selection: mapSelection} : {}),
    illustrations: assets.map(({ data, ...v }) => {
      void data;
      return v;
    }),
  });
}
export function budgetReport(
  payload: string,
  c: AIConfig,
  runs: Run[],
  now = new Date().toISOString(),
) {
  const month = now.slice(0, 7),
    input = inputTokenBound(payload, c);
  const used = runs
    .filter((r) => r.month === month)
    .reduce((s, r) => s + (r.actual_eur ?? r.reserved_eur), 0);
  const reserved = cost(input, c.max_output_tokens, c.pricing);
  const remaining = Math.max(0, c.monthly_budget_eur - used);
  const blockers: string[] = [];
  if (
    runs.some((r) =>
      ["running", "reserved", "outcome_unknown"].includes(r.state),
    )
  )
    blockers.push("UNRECONCILED_GENERATION");
  if (reserved > c.max_edition_eur) blockers.push("EDITION_COST_EXCEEDED");
  if (reserved > remaining) blockers.push("MONTHLY_BUDGET_EXCEEDED");
  return {
    model: c.model,
    month,
    pricing_version: c.pricing.version,
    input_bytes: Buffer.byteLength(payload),
    input_token_upper_bound: input,
    max_output_tokens: c.max_output_tokens,
    reserved_eur: reserved,
    edition_cap_eur: c.max_edition_eur,
    monthly_cap_eur: c.monthly_budget_eur,
    accounted_month_eur: used,
    available_month_eur: remaining,
    blockers,
    allowed: blockers.length === 0,
  };
}

export class BudgetRefusal extends Error {
  constructor(public report: ReturnType<typeof budgetReport>) {
    super("BUDGET_EXCEEDED");
  }
}
