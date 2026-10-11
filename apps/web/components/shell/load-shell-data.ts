import "server-only";
import type { DiagnosticResult } from "../../lib/diagnostic";
import fixture from "../../../../fixtures/contracts/risk-result.json";
import { validateSeries } from "../../lib/server/response-validation";
import { DemoRiskRepository } from "../../lib/demo-repository";
import { parseContext } from "../../lib/url-state";
import { SupabaseRiskRepository } from "../../lib/server/supabase-risk-repository";
import { ApiError, parseMap } from "../../lib/server/query";
import { liveMapSummary, type ShellData } from "../../lib/shell-data";

export const LIVE_QUERY_KEYS = [
  "production",
  "indicator",
  "rule",
  "version",
  "date",
  "bbox",
  "zoom",
  "limit",
] as const;

export async function loadShellData(
  params: URLSearchParams,
  repository = new SupabaseRiskRepository(),
): Promise<ShellData> {
  if (params.get("mode") !== "live") {
    const result = await new DemoRiskRepository().getMapFeatures(
      parseContext(params),
    );
    return { mode: "demo", collection: result.data, diagnostic: validateSeries([fixture])[0] as unknown as DiagnosticResult };
  }
  const query = new URLSearchParams();
  for (const key of LIVE_QUERY_KEYS) {
    for (const value of params.getAll(key)) query.append(key, value);
  }
  try {
    const result = await repository.getMapFeatures(parseMap(query));
    if (result.features.length === 0) return liveMapSummary(0);
    return { mode: "live", state: "available", count: result.features.length,
      results: result.features.map(feature => feature.properties.result as unknown as DiagnosticResult) };
  } catch (error) {
    const message =
      error instanceof ApiError && error.code === "INVALID_QUERY"
        ? "Contexte live incomplet ou invalide : production, indicateur, règle, version, date et bbox sont requis."
        : error instanceof ApiError && error.code === "NOT_CONFIGURED"
          ? "Service live non configuré."
          : "Service live indisponible. Réessayez ultérieurement.";
    return { mode: "live", state: "source-error", message };
  }
}
