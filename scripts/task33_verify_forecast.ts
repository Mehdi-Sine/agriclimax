import {
  archiveCatalogue,
  nationalWeatherDocument,
} from "../apps/web/lib/server/weather-archives";
import { detectQualifiedNational } from "../apps/web/features/national-watch/model";
import places from "../apps/web/data/operational/pra-watch-places.json";
import {
  qualifiedCompare,
  hash,
} from "../apps/web/features/editorial/temporal";
import { writeFileSync } from "node:fs";
import type { Snapshot } from "../apps/web/features/journal/history";
async function main() {
  const catalogue = await archiveCatalogue();
  const entries = (catalogue?.weather ?? [])
    .filter((e) => e.method_version === "pra-national-weather-daily-1")
    .sort((a, b) =>
      (a.run_at ?? a.run_date!).localeCompare(b.run_at ?? b.run_date!),
    );
  const exactPair = entries
    .flatMap((a) =>
      entries
        .filter(
          (b) =>
            Date.parse(b.run_at ?? b.run_date!) -
              Date.parse(a.run_at ?? a.run_date!) ===
            3 * 86400000,
        )
        .map((b) => [a, b] as const),
    )
    .at(-1);
  const pair = exactPair ?? entries.slice(-2);
  if (pair.length !== 2) throw Error("INSUFFICIENT_FORECAST_CYCLES");
  const docs = await Promise.all(
    pair.map((e) => nationalWeatherDocument(e.run_at ?? e.run_date!)),
  );
  if (!docs[0] || !docs[1]) throw Error("FORECAST_ARCHIVE_MISSING");
  const selected = docs.map((d) => d!.selected_indices.map((i) => d!.rows[i]));
  const available = selected.map(
    (rows) => new Set(rows.map((r) => r.valid_date)),
  );
  const dates = [...available[0]]
    .filter((d) => available[1].has(d))
    .sort()
    .slice(0, 7);
  if (!dates.length) throw Error("FORECAST_VALIDITY_NO_OVERLAP");
  const summaries = selected.map((rows) =>
    detectQualifiedNational(rows, places.places, dates[0], dates.at(-1)!),
  );
  const results = places.places
    .map((p) => p.region)
    .filter((v, i, a) => a.indexOf(v) === i)
    .flatMap((region) =>
      ["heat", "rain", "frost", "dry"].map((phenomenon) => {
        const metrics = summaries.map((s) =>
          s.metrics.filter(
            (m) =>
              m.phenomenon === phenomenon &&
              places.places.some((p) => p.id === m.pra && p.region === region),
          ),
        );
        const support = metrics[0]
          .filter(
            (m) =>
              m.detected !== null &&
              metrics[1].some((n) => n.pra === m.pra && n.detected !== null),
          )
          .map((m) => m.pra)
          .sort();
        const snapshots: Snapshot[] = metrics.map((ms, i) => ({
          nature: "forecast",
          source: "qualified-archive",
          model: hash(
            selected[i]
              .filter(
                (r) => support.includes(r.pra_id) && r.valid_date === dates[0],
              )
              .map((r) => [
                r.pra_id,
                r.source_id,
                r.model,
                r.grid_version,
                r.weights_sha256,
                r.rule_version,
              ])
              .sort(),
          ),
          version: ms[0]?.rule_version ?? "missing",
          unit: "descriptive",
          period: [dates[0], dates.at(-1)!],
          date: docs[i]!.run,
          complete: support.length > 0,
          pra_ids: ms
            .filter((m) => support.includes(m.pra) && m.detected)
            .map((m) => m.pra),
          evaluated_ids: support,
          magnitude: Math.max(
            0,
            ...ms
              .filter((m) => support.includes(m.pra))
              .map((m) => m.value ?? 0),
          ),
          episode_id: region + "/" + phenomenon,
        }));
        return {
          region,
          phenomenon,
          support: support.length,
          ...qualifiedCompare(snapshots[1], snapshots[0], 3),
        };
      }),
    );
  writeFileSync(
    "docs/codex/task33/evidence/forecast-revision.json",
    JSON.stringify(
      {
        cycles: docs.map((d) => d!.run),
        archive_sha256: docs.map((d) => d!.archive_sha256),
        exact_three_day_pair: !!exactPair,
        limitation:
          "Le comparateur T31 exige un horizon exact de 3, 7, 14 ou 30 jours. Deux cycles plus proches ne démontrent pas de tendance.",
        period: [dates[0], dates.at(-1)],
        results,
      },
      null,
      2,
    ),
  );
  console.log({
    comparisons: results.length,
    revisions: results.filter((r) => r.kind === "forecast_revision").length,
  });
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
