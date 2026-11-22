import 'server-only';
import { createHash } from "node:crypto";
import otex from "../../data/agriculture/agro04-otex.json";
import { datasets } from "./agriculture-index";
import { ORIENTATIONS, PRODUCTIONS } from "../../features/agro-territorial/matrix";
import { shortlist, territorialDay, type Profile, type TerritorialEvidence } from "../../features/agro-territorial/situations";
import type { DailyEvidence } from "../../features/editorial/temporal";
import { detectQualifiedNational, PHENOMENA, type Place } from "../../features/national-watch/model";
import type { NationalWeatherDocument } from "./weather-archives";

export const OTEX_PROVENANCE = {
  release: otex.release,
  systems: otex.systems,
  reference: otex.reference,
  source_sha256: otex.sha256,
  sha256: createHash("sha256").update(JSON.stringify(otex)).digest("hex"),
};

async function loadProfiles(): Promise<Record<string, Profile>> {
  const groups = Object.values(PRODUCTIONS).flatMap(p => [...p.groups]);
  const series = new Map(await Promise.all(groups.map(async group => {
    const data = await datasets[`rpg-group-${group}-surf-pra`]();
    if (data.indicator.scale !== "pra" || data.indicator.unit !== "ha" ||
        data.indicator.years[0] !== 2025 || data.indicator.source_id !== "rpg-2025") {
      throw Error("AGRO04_RPG_REFERENCE");
    }
    return [group, {
      rows: new Map(data.rows.map(row => [row.code, row])),
      sha: data.indicator.sha256,
    }] as const;
  })));
  return Object.fromEntries(otex.rows.map(([rawCode, rawCodes, basin]) => {
    const code = String(rawCode);
    const crops = Object.entries(PRODUCTIONS).map(([id, production]) => {
      const records = production.groups.map(group => series.get(group)!);
      const rows = records.map(record => record.rows.get(code));
      const hectares = rows.every(row => row?.statuses[0] === "available" &&
        row.values[0] != null && Number.isFinite(row.values[0]) && row.values[0] >= 0)
        ? rows.reduce((sum, row) => sum + row!.values[0]!, 0)
        : null;
      return { id, label: production.label, hectares, sha256: records[0].sha };
    }).sort((a, b) => (b.hectares ?? -1) - (a.hectares ?? -1) || a.id.localeCompare(b.id));
    const animalCodes = String(rawCodes);
    return [`pra:${code}`, {
      crops, sampled: !!animalCodes, systems_basin: Number(basin),
      orientations: Object.entries(ORIENTATIONS).filter(([id]) => animalCodes.includes(id))
        .map(([id, label]) => ({ id, label })),
      otex_sha256: OTEX_PROVENANCE.sha256,
    }];
  }));
}

let profiles: Promise<Record<string, Profile>> | undefined;
export function territorialProfiles() {
  return profiles ??= loadProfiles().catch(error => {
    profiles = undefined;
    throw error;
  });
}

export async function prepareTerritorialWatch(
  date: string, historyDate: string, history: readonly DailyEvidence[],
  forecast: NationalWeatherDocument | undefined, places: Place[],
) {
  const profiles = await territorialProfiles();
  if (Object.keys(profiles).length !== places.length || places.some(p => !profiles[p.id])) {
    throw Error("AGRO04_PRA_REFERENCES");
  }
  const evaluated = territorialDay(historyDate, "reanalysis", places, profiles, history);
  const rows = forecast?.selected_indices.map(i => forecast.rows[i])
    .filter(row => row.nature === "forecast" && row.valid_date === date) ?? [];
  let evidence: TerritorialEvidence[] = [];
  if (forecast && rows.length) {
    const { metrics } = detectQualifiedNational(rows, places, date, date);
    evidence = metrics.filter(m => m.quality?.journal_eligible).map(metric => ({
      ...metric, date, nature: "forecast" as const, cycle: forecast.run, archive: forecast.archive_sha256,
      signature: metric.sources.join("|"),
      provenance: [...new Set([forecast.archive_sha256, ...metric.provenance])],
      unit: PHENOMENA.find(p => p.id === metric.phenomenon)!.unit,
      phenomenon: metric.phenomenon,
    }));
  }
  evaluated.push(...territorialDay(date, "forecast", places, profiles, evidence));
  const situations = evaluated.flatMap(result => result.situation ? [result.situation] : []);
  return { evaluated, situations, selected: shortlist(situations) };
}
