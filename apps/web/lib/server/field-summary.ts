import "server-only";
import geography from "../../data/operational/pra-watch-places.json";
import { compareFieldPeriods, fieldSummary, type DocumentedOrientation, type DocumentedProduction } from "../../features/agroclimatic/national-summary";
import type { AgroPayload } from "./agroclimatic";
import { datasets } from "./agriculture-index";
import { territorialProfiles } from "./agro-territorial";

export async function documentedProductions(indicator: string, groups?: readonly string[]): Promise<Record<string, DocumentedProduction[]>> {
  if (indicator === "field_maize_gdd") {
    const { indicator: metadata, rows } = await datasets["rpg-group-2-surf-pra"]();
    if (metadata.source_id !== "rpg-2025" || metadata.scale !== "pra" ||
        metadata.unit !== "ha" || metadata.years[0] !== 2025) {
      throw new Error("FIELD_MAIZE_RPG_REFERENCE");
    }
    return Object.fromEntries(rows.flatMap(row => {
      const value = row.values[0];
      return row.statuses[0] === "available" && value !== null && Number.isFinite(value) && value > 0
        ? [[`pra:${row.code}`, [{ label: metadata.label, source: metadata.source_id, year: 2025, declaredHectares: value }]]]
        : [];
    }));
  }
  const profiles = await territorialProfiles();
  const categories = groups ?? (indicator === "field_frost" ? ["cereals", "vine", "orchard"] : ["cereals", "forage"]);
  return Object.fromEntries(Object.entries(profiles).map(([id, profile]) => [
    id,
    profile.crops.flatMap(crop => categories.includes(crop.id) && crop.hectares !== null && crop.hectares > 0
      ? [{ label: crop.label, source: "rpg-2025", year: 2025, declaredHectares: crop.hectares }]
      : []),
  ]));
}

export async function summarizeField(payload: AgroPayload, previous?: AgroPayload | null) {
  const groups = payload.rule.science?.productions;
  const productions = await documentedProductions(payload.rule.id, groups);
  let orientations: Record<string, DocumentedOrientation[]> | undefined;
  if (groups?.includes("cattle")) {
    const profiles = await territorialProfiles();
    orientations = Object.fromEntries(Object.entries(profiles).map(([id, profile]) => [
      id,
      profile.orientations.filter(orientation => ["L", "V", "B"].includes(orientation.id))
        .map(({ label }) => ({ label, source: "otex-2020-sampled", year: 2020 })),
    ]));
  }
  return { ...fieldSummary(payload.rule, payload.period, payload.source_version, payload.data, geography.places, productions, orientations),
    evolution: compareFieldPeriods(payload, previous) };
}
