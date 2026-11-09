import "server-only";
export interface Pricing {
  version: string;
  model: string;
  input_eur_per_million: number;
  output_eur_per_million: number;
  verified_at: string;
}
export interface AIConfig {
  request_profile?: "gpt6-standard-explicit-cache";
  enabled: boolean;
  model: string;
  max_output_tokens: number;
  monthly_budget_eur: number;
  max_edition_eur: number;
  timeout_ms: number;
  pricing: Pricing;
}
function positive(s: string | undefined, fallback: number) {
  const v = Number(s ?? fallback);
  if (!Number.isFinite(v) || v <= 0) throw Error("INVALID_AI_CONFIG");
  return v;
}
export function readConfig(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): AIConfig {
  const model = env.AGRICLIMAX_EDITORIAL_MODEL ?? "unconfigured";
  if (
    env.AGRICLIMAX_AI_ENABLED === "true" &&
    (!env.AGRICLIMAX_AI_INPUT_EUR_PER_MILLION ||
      !env.AGRICLIMAX_AI_OUTPUT_EUR_PER_MILLION)
  )
    throw Error("EXPLICIT_PRICING_REQUIRED");
  return {
    enabled: env.AGRICLIMAX_AI_ENABLED === "true",
    model,
    max_output_tokens: positive(env.AGRICLIMAX_AI_MAX_OUTPUT_TOKENS, 6000),
    monthly_budget_eur: Math.min(
      5,
      positive(env.AGRICLIMAX_AI_MONTHLY_BUDGET, 5),
    ),
    max_edition_eur: positive(env.AGRICLIMAX_AI_MAX_EDITION_COST, 0.15),
    timeout_ms: positive(env.AGRICLIMAX_AI_TIMEOUT_MS, 90000),
    pricing: {
      version: env.AGRICLIMAX_AI_PRICING_VERSION ?? "unverified",
      model,
      input_eur_per_million: positive(
        env.AGRICLIMAX_AI_INPUT_EUR_PER_MILLION,
        1,
      ),
      output_eur_per_million: positive(
        env.AGRICLIMAX_AI_OUTPUT_EUR_PER_MILLION,
        5,
      ),
      verified_at: env.AGRICLIMAX_AI_PRICING_VERIFIED_AT ?? "",
    },
  };
}
export function cost(input: number, output: number, p: Pricing) {
  return (
    Math.ceil(
      input * p.input_eur_per_million + output * p.output_eur_per_million,
    ) / 1e6
  );
}
export function checkConfig(c: AIConfig) {
  if (!c.enabled) throw Error("AI_DISABLED");
  if (
    c.model === "unconfigured" ||
    c.pricing.model !== c.model ||
    c.pricing.version === "unverified" ||
    !Number.isFinite(Date.parse(c.pricing.verified_at))
  )
    throw Error("UNVERIFIED_MODEL_PRICING");
  if (
    !Number.isInteger(c.max_output_tokens) ||
    c.max_output_tokens > 16000 ||
    c.max_output_tokens <= 0 ||
    ![c.monthly_budget_eur, c.max_edition_eur, c.timeout_ms].every(
      Number.isFinite,
    ) ||
    c.monthly_budget_eur > 5 ||
    c.monthly_budget_eur <= 0 ||
    c.max_edition_eur <= 0 ||
    c.max_edition_eur > 0.15 ||
    c.timeout_ms <= 0 ||
    [c.pricing.input_eur_per_million, c.pricing.output_eur_per_million].some(
      (v) => !Number.isFinite(v) || v <= 0,
    )
  )
    throw Error("INVALID_AI_CONFIG");
}
