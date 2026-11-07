import "server-only";
import { createHash } from "node:crypto";
import source from "../../data/operational/coastal-complement.json";
import { complementaryDocument } from "./spatial-restitution";
import { calendarDays } from "../../features/national/daily-availability";
import { calculateComplementary } from "../../features/agroclimatic/complement-calculate";
import type { Rule } from "../../features/agroclimatic/catalogue";
import type { ComplementaryDay } from "../../features/agroclimatic/complement-model";
interface Field {
  value: number;
  support_id: string;
  native_coverage: number;
  temporal_coverage: number;
}
interface Document {
  source_id: string;
  method_version: string;
  target_pra: string;
  config_sha256: string;
  reference_sha256: string;
  weights_sha256: string;
  native_manifest_sha256: string;
  validation_sha256: string;
  quality_flags: string[];
  validation: {
    accepted_variables: string[];
    pooled: Record<
      string,
      { PRA: number; PRA_days: number; MAE: number; p95_absolute_error: number }
    >;
  };
  days: Record<string, Record<string, Field>>;
}
const seed = source as unknown as Document;
const seedSha = createHash("sha256")
  .update(JSON.stringify(source))
  .digest("hex");
export async function coastalComplement(
  rule: Rule,
  start: string,
  end: string,
  threshold: number | null,
) {
  if (!["temperature_mean", "gdd", "rain"].includes(rule.id)) return undefined;
  const variable = rule.variables[0],
    dates = calendarDays(start, end);
  const rows: ComplementaryDay[] = [];
  for (const date of dates) {
    const archived = seed.days[date] ? null : await complementaryDocument(date);
    const doc = (archived?.document ?? seed) as Document;
    if (
      doc.target_pra !== "pra:29102" ||
      doc.method_version !== seed.method_version ||
      doc.source_id !== seed.source_id ||
      doc.config_sha256 !== seed.config_sha256 ||
      doc.validation_sha256 !== seed.validation_sha256 ||
      doc.weights_sha256 !== seed.weights_sha256 ||
      doc.reference_sha256 !== seed.reference_sha256 ||
      !doc.validation?.accepted_variables?.includes(variable)
    )
      return undefined;
    const row = doc.days?.[date]?.[variable];
    if (!row) return undefined;
    rows.push({
      ...row,
      date,
      identity: `${doc.method_version}/${doc.config_sha256}/${doc.validation_sha256}`,
      provenance: `${doc.source_id}/${doc.method_version}/${date}/${doc.native_manifest_sha256}/${archived?.archive_sha256 ?? seedSha}/${row.support_id}`,
    });
  }
  const metrics = seed.validation.pooled[variable];
  if (!metrics) return undefined;
  return calculateComplementary(
    "pra:29102",
    rows,
    start,
    end,
    rule,
    threshold,
    {
      source_id: seed.source_id,
      method_version: seed.method_version,
      accepted: seed.validation.accepted_variables.includes(variable),
      quality_flags: seed.quality_flags,
      validation: {
        reference: "ERA5-Land field, not an independent station",
        pra: metrics.PRA,
        pra_days: metrics.PRA_days,
        mae: metrics.MAE,
        p95_absolute_error: metrics.p95_absolute_error,
        unit: variable === "temperature" ? "°C" : "mm/j",
      },
    },
  );
}
