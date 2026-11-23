import "server-only";
import geography from "../../data/operational/pra-watch-places.json";
import { FIELD_RULES } from "../../features/agroclimatic/catalogue";
import { fieldSummary } from "../../features/agroclimatic/national-summary";
import { calculateQualified, coverageRule } from "../../features/climate-quality/calculate";
import { hash, shift } from "../../features/editorial/temporal";
import { documentedProductions } from "./field-summary";
import type { ArchivedDaily } from "./weather-archives";
import { historicalWheatInputs } from "./wheat";

/** Only frozen, native ERA5-Land support. The analysis UI can display partial supports independently. */
export async function editorialFieldSummaries(rows: ArchivedDaily[], end: string) {
  const start = shift(end, -6);
  const window = rows.filter(row => row.valid_date >= start && row.valid_date <= end);
  if (new Set(window.map(row => row.valid_date)).size !== 7) return [];
  const sourceVersion = hash(window.map(row => row.batch_key).sort());
  const summaries = [];
  for (const base of [...FIELD_RULES].reverse()) {
    // The agricultural sensitivity window is undocumented. Only descriptive indicators
    // are admitted here, with frost explicitly labelled as a meteorological threshold.
    if (base.id === "field_maize_gdd") continue;
    const rule = coverageRule(base, base.version);
    const inputs = historicalWheatInputs(window, rule);
    const results = geography.places.map(({ id }) =>
      calculateQualified(id, inputs[id] ?? [], start, end, rule, rule.threshold),
    );
    if (!results.some(result => result.quality?.journal_eligible)) continue;
    const productions = await documentedProductions(rule.id);
    const summary = fieldSummary(rule, { start, end, timezone: "UTC" }, sourceVersion, results, geography.places, productions);
    const { version, indicator, rule_version, unit, period, source, data_freshness, provenance, quality_flags,
      total_pra, evaluable_pra, limitations, remarkable } = summary;
    summaries.push({
      version, indicator, rule_version, unit, period, source, data_freshness, provenance, quality_flags,
      total_pra, evaluable_pra, limitations,
      label: indicator === "field_frost" ? "Jours de gel météorologique" : summary.label,
      maximum: remarkable.maximum,
      maximum_count: remarkable.maximum_count,
      territories: remarkable.highest.map(({ productions, ...territory }) => ({
        ...territory,
        productions: productions.map(({ label, source, year }) => ({ label, source, year })),
      })),
    });
  }
  return summaries;
}

export type EditorialFieldSummary = Awaited<ReturnType<typeof editorialFieldSummaries>>[number];
