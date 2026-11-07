import { it, expect, vi } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
vi.mock("server-only", () => ({}));
import {
  type ArchivedDaily,
  archiveCatalogue,
  archivedEra5Day,
  nationalWeatherDocument,
} from "../../lib/server/weather-archives";
import {
  computeWheatBatch,
  forecastWheatInputs,
  historicalWheatInputs,
  wheatForecast,
} from "../../lib/server/wheat";
import { wheatRules, WHEAT_VERSION, type WheatDay } from "./qualified";
import { wheatPeriod, calculateWheat } from "./qualified";
import { trailingStart } from "../national/daily-availability";
import { nationalWatch } from "../../lib/server/national-watch";
import { WheatEditorialContributor } from "./editorial";
import { createRegistry, defaultContributors } from "../journal/registry";
import { buildEdition } from "../journal/model";
import { assertEdition } from "../journal/validate";
import geography from "../../data/operational/pra-watch-places.json";
import type { Rule } from "../agroclimatic/catalogue";
// Real archive reads are opt-in and never substituted with fixtures.
it.skipIf(process.env.AGRO01_REAL !== "1")(
  "audits all 713 PRA against independently computed Python values",
  async () => {
    const began = performance.now(),
      rssBefore = process.memoryUsage().rss;
    const out = "../../docs/codex/agro01/evidence";
    await mkdir(out, { recursive: true });
    const catalogue = await archiveCatalogue();
    expect(catalogue).not.toBeNull();
    const days = [...new Set(catalogue!.era5.flatMap((e) => e.dates))].sort(),
      latest = days.at(-1)!;
    const allRows: ArchivedDaily[] = [];
    for (const date of days.filter((d) => d >= trailingStart(latest, 30)))
      allRows.push(...((await archivedEra5Day(date)) ?? []));
    const document = await nationalWeatherDocument();
    expect(document).not.toBeNull();
    const sampleInputs: Record<string, WheatDay[]> = {};
    const cases: unknown[] = [],
      matrix: unknown[] = [],
      samples: unknown[] = [],
      summaries = [];
    const samplePlaces = [
      geography.places.find((p) => p.name.includes("BEAUCE"))!,
      geography.places.find((p) => p.name.includes("MONTAGNE"))!,
      geography.places.find((p) => p.id === "pra:29102")!,
      geography.places.find((p) => p.region === "Corse")!,
      geography.places.find((p) => p.name.includes("LITTORAL"))!,
    ].filter(Boolean);

    const periods: [string, string][] = [1, 7, 30].map((n) => [
      trailingStart(latest, n),
      latest,
    ]);
    const forecastStart = trailingStart(document!.run.slice(0, 10), 0),
      forecastEnd = trailingStart(document!.run.slice(0, 10), -6);
    const plans = [
      ...periods.map((period) => ({
        period,
        nature: "reanalysis" as const,
        source: createHash("sha256")
          .update(
            JSON.stringify(
              catalogue!.era5
                .filter((e) =>
                  e.dates.some((d) => wheatPeriod(...period).includes(d)),
                )
                .map((e) => e.sha256),
            ),
          )
          .digest("hex"),
        run: null,
        inputs: (r: Rule) =>
          historicalWheatInputs(
            allRows.filter((row) =>
              wheatPeriod(...period).includes(row.valid_date),
            ),
            r,
          ),
      })),
      ...(
        [
          [forecastStart, forecastStart],
          [forecastStart, forecastEnd],
        ] as [string, string][]
      ).map((period) => ({
        period,
        nature: "forecast" as const,
        source: document!.archive_sha256,
        run: document!.run,
        inputs: (r: Rule) =>
          forecastWheatInputs(document!, r, wheatPeriod(...period)),
      })),
    ];
    for (const plan of plans) {
      const t = performance.now();
      const batch = computeWheatBatch(
        plan.period,
        { version: plan.source, nature: plan.nature, run: plan.run },
        plan.inputs,
      );
      const batchMs = performance.now() - t;
      summaries.push(batch.summary);
      for (const rule of wheatRules) {
        const input = plan.inputs(rule),
          data = batch.results[rule.id];
        expect(data).toHaveLength(713);
        const national = batch.summary.indicators.find((i) => i.id === rule.id)!
          .territories[0];
        matrix.push({
          indicator: rule.id,
          period: plan.period,
          nature: plan.nature,
          run: plan.run,
          ...national.coverage,
          compute_batch_ms: batchMs,
        });
        for (const result of data)
          cases.push({
            kind: "real_" + plan.nature,
            rule,
            period: plan.period,
            rows: input[result.territoryId] ?? [],
            actual: result.value,
          });
        for (const place of samplePlaces) {
          const key = [
            plan.nature,
            ...plan.period,
            rule.variables.join(),
            place.id,
          ].join("/");
          sampleInputs[key] = input[place.id] ?? [];
          const { series, signals, ...result } = data.find(
            (r) => r.territoryId === place.id,
          )!;
          void series;
          void signals;
          samples.push({
            place,
            indicator: rule.id,
            period: plan.period,
            nature: plan.nature,
            input_key: key,
            result,
          });
        }
      }
    }
    // Explicit synthetic edge cases alongside, clearly labelled and not counted as archive coverage.
    for (const n of [1, 7, 30])
      for (const rule of wheatRules)
        for (const variant of [
          "complete",
          "gap",
          "missing",
          "source",
          "run",
          "support",
          "partial",
          "boundary",
        ]) {
          const period: [string, string] = [
            "2026-12-31",
            trailingStart("2026-12-31", 2 - n),
          ];
          let rows: WheatDay[] = wheatPeriod(...period).map((date, i) => ({
            pra: "synthetic",
            date,
            values: {
              temperature: [-5, 0, 5][i % 3],
              temperature_min: [-5, 0, 5][i % 3],
              temperature_max: [-5, 0, 5][i % 3],
              precipitation: [0, 1, 20, 21][i % 4],
            },
            compatible: true,
            complete: true,
            source: "synthetic",
            run: null,
            nature: "reanalysis",
            freshness: "synthetic",
            provenance: ["synthetic"],
            quality_flags: [],
            support_key: "same",
            spatial_coverage: 1,
            temporal_coverage: 1,
          }));
          const middle = Math.floor(rows.length / 2);
          if (variant === "gap") rows = rows.filter((_, i) => i !== middle);
          else if (variant === "missing")
            rows[middle].values[rule.variables[0]] = null;
          else if (variant === "source") rows[middle].source = "other";
          else if (variant === "run") rows[middle].run = "2027-01-01T00:00:00Z";
          else if (variant === "support") rows[middle].support_key = "other";
          else if (variant === "partial") rows[middle].spatial_coverage = 0.95;
          else if (variant === "boundary")
            rows.forEach((r) => {
              r.values = { [rule.variables[0]]: rule.threshold ?? 0 };
            });
          cases.push({
            kind: "synthetic_" + variant,
            rule,
            period,
            rows,
            actual: calculateWheat("synthetic", rows, ...period, rule).value,
          });
        }
    const oracle = spawnSync(
      "python",
      ["../../docs/codex/agro01/verify_reference.py"],
      {
        input: JSON.stringify(cases),
        encoding: "utf8",
        maxBuffer: 8 * 1024 ** 2,
      },
    );
    expect(oracle.status, oracle.stderr + oracle.stdout).toBe(0);
    const independent = JSON.parse(oracle.stdout);
    expect(independent.mismatches).toEqual([]);
    const watch = await nationalWatch(document!.run),
      snapshots = await wheatForecast(document!),
      registry = createRegistry([
        ...defaultContributors.filter((c) => c.id !== "wheat"),
        WheatEditorialContributor(snapshots),
      ]);
    const edition = buildEdition(watch, {
      now: new Date().toISOString(),
      registry,
    });
    assertEdition(edition);
    expect(
      edition.production_sections.find((p) => p.id === "wheat")!.indicators
        .length,
    ).toBeGreaterThan(0);
    const replay = await wheatForecast(document!);
    expect(replay).toEqual(snapshots);
    const report = {
      executed_at: new Date().toISOString(),
      version: WHEAT_VERSION,
      archive_dates: days,
      latest_historical: latest,
      forecast_cycle: document!.run,
      source_hash: document!.archive_sha256,
      independent,
      sample_places: samplePlaces,
      resources: {
        elapsed_ms: performance.now() - began,
        rss_before: rssBefore,
        rss_after: process.memoryUsage().rss,
        peak_rss_bytes: process.resourceUsage().maxRSS * 1024,
        summary_bytes: Buffer.byteLength(JSON.stringify(snapshots)),
        edition_bytes: Buffer.byteLength(JSON.stringify(edition)),
        raw_forecast_rows: document!.rows.length,
      },
      coverage: matrix,
    };
    await writeFile(`${out}/validation.json`, JSON.stringify(report, null, 2));
    await writeFile(
      `${out}/samples.json`,
      JSON.stringify({
        inputs: Object.fromEntries(
          Object.entries(sampleInputs).map(([id, rows]) => [
            id,
            rows.map(({ support_key, ...row }) => ({
              ...row,
              support_fingerprint: support_key,
            })),
          ]),
        ),
        results: samples,
      }),
    );
    await writeFile(`${out}/summaries.json`, JSON.stringify(summaries));
    await writeFile(`${out}/journal.json`, JSON.stringify(edition));
  },
  180000,
);
