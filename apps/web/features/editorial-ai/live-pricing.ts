import "server-only";
import registry from "../../../../config/editorial/openai-pricing.v1.json";
import { type AIConfig, checkConfig } from "./config";
export const LIVE_PROFILE = "gpt6-standard-explicit-cache";
export function liveConfig(
  model: string,
  maxOutputTokens = 6000,
  now = new Date(),
): AIConfig {
  const age = now.getTime() - Date.parse(registry.verified_at);
  if (age < 0 || age > registry.valid_days * 86400000)
    throw Error("OFFICIAL_PRICING_REVERIFICATION_REQUIRED");
  const m = registry.models.find((m) => m.id === model);
  if (
    !m ||
    !m.responses ||
    !m.structured_outputs ||
    !m.byte_token_bound_supported
  )
    throw Error("MODEL_NOT_QUALIFIED");
  const fx = registry.eur_per_usd_ceiling,
    regional = registry.regional_multiplier_ceiling;
  if (fx < 1 / registry.fx.usd_per_eur || regional < 1.1)
    throw Error("NON_CONSERVATIVE_FX_OR_REGION");
  const c: AIConfig = {
    enabled: true,
    model,
    max_output_tokens: maxOutputTokens,
    monthly_budget_eur: 5,
    max_edition_eur: 0.15,
    timeout_ms: 120000,
    request_profile: LIVE_PROFILE,
    pricing: {
      model,
      version: registry.version,
      input_eur_per_million: m.input_usd_per_million * fx * regional,
      output_eur_per_million: m.output_usd_per_million * fx * regional,
      verified_at: registry.verified_at,
    },
  };
  checkConfig(c);
  return c;
}
export function shortContextLimit(model: string) {
  const m = registry.models.find((m) => m.id === model);
  if (!m) throw Error("MODEL_NOT_QUALIFIED");
  return m.short_context_max_tokens;
}
export const pricingReceipt = registry;
