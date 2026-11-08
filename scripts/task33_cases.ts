/** Reproducible read-only real-history acceptance diagnostics, not a national edition. */
import { writeFileSync } from "node:fs";
import {
  legacyHistoryDates,
  legacyHistoryDay,
} from "../apps/web/lib/server/climate-history";
import geography from "../apps/web/data/operational/pra-watch-places.json";
import {
  adaptHistory,
  reconstructEpisodes,
} from "../apps/web/features/editorial/temporal";
const rows = legacyHistoryDates.flatMap((d) => legacyHistoryDay(d) ?? []);
const evidence = adaptHistory(rows, geography.places, "legacy-rpc-1");
const episodes = reconstructEpisodes(evidence, "2026-10-30");
const longest = ["dry", "frost", "heat", "rain"].map(
  (phenomenon) =>
    episodes
      .filter((e) => e.phenomenon === phenomenon)
      .sort(
        (a, b) => b.duration_days - a.duration_days || a.id.localeCompare(b.id),
      )[0],
);
const quiet = rows.find(
  (r) =>
    r.status === "available" &&
    r.precipitation !== null &&
    r.precipitation >= 1 &&
    r.precipitation <= 20 &&
    r.temperature_min !== null &&
    r.temperature_min >= 0 &&
    r.temperature_max !== null &&
    r.temperature_max <= 25,
);
if (!quiet) throw Error("NO_QUIET_REAL_SAMPLE");
const partial = rows.find((r) => r.status === "partial")!;
const sample = (pra: string, date: string) =>
  evidence.filter((e) => e.pra === pra && e.date === date);
const crozon = evidence.filter((e) => e.pra === "pra:29102");
if (
  crozon.some((e) => e.value !== null) ||
  episodes.some((e) => e.pra_ids.includes("pra:29102"))
)
  throw Error("CROZON_FALSE_EPISODE");
const quietEpisodes = reconstructEpisodes(
  evidence.filter((e) => e.pra === quiet.pra_id && e.date <= quiet.valid_date),
  quiet.valid_date,
).filter((e) => e.status === "ongoing_at_cutoff");
if (quietEpisodes.length) throw Error("QUIET_SAMPLE_FALSE_EVENT");
writeFileSync(
  "docs/codex/task33/evidence/real-cases.json",
  JSON.stringify(
    {
      longest_examples: longest,
      quiet_pra_day: {
        scope: "one_PRA_not_a_calm_national_day",
        row: quiet,
        evidence: sample(quiet.pra_id, quiet.valid_date),
        ongoing_episodes: quietEpisodes,
      },
      partial_support: {
        pra: partial.pra_id,
        date: partial.valid_date,
        evidence: sample(partial.pra_id, partial.valid_date),
      },
      crozon: {
        pra: "pra:29102",
        daily_evidence_count: crozon.length,
        qualified_values: 0,
        episodes: 0,
      },
    },
    null,
    2,
  ) + "\n",
);
