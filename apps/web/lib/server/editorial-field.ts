import "server-only";
import geography from "../../data/operational/pra-watch-places.json";
import { AGRO06_RULES } from "../../features/agroclimatic/analysis-catalogue";
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
  const month = Number(end.slice(5, 7));
  const coveredFamilies = new Set<string>();
  const candidates = [...AGRO06_RULES, ...[...FIELD_RULES].reverse()];
  for (const base of candidates) {
    // The agricultural sensitivity window is undocumented. Only descriptive indicators
    // are admitted here, with frost explicitly labelled as a meteorological threshold.
    if (base.id === "field_maize_gdd") continue;
    if (summaries.length === 4) break;
    if (base.science && coveredFamilies.has(base.family)) continue;
    if (base.id.startsWith("warm_nights20") && (month < 5 || month > 9)) continue;
    if (base.id.startsWith("ice_") && month >= 5 && month <= 9) continue;
    const rule = coverageRule(base, base.version);
    const inputs = historicalWheatInputs(window, rule);
    const results = geography.places.map(({ id }) =>
      calculateQualified(id, inputs[id] ?? [], start, end, rule, rule.threshold),
    );
    const values = results.flatMap(result =>
      result.quality?.journal_eligible && result.value !== null ? [result.value] : [],
    );
    if (!values.length) continue;
    if (rule.science && (values.length / geography.places.length < .8 || values.every(value => value === values[0]))) continue;
    const productions = await documentedProductions(rule.id, rule.science?.productions);
    const summary = fieldSummary(rule, { start, end, timezone: "UTC" }, sourceVersion, results, geography.places, productions);
    const { version, indicator, rule_version, unit, period, source, data_freshness, provenance, quality_flags,
      total_pra, evaluable_pra, limitations, remarkable } = summary;
    if (rule.science) coveredFamilies.add(rule.family);
    summaries.push({
      version, indicator, rule_version, unit, period, source, data_freshness, provenance, quality_flags,
      total_pra, evaluable_pra,
      limitations: rule.science ? [...limitations, rule.science.confidence] : limitations,
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
