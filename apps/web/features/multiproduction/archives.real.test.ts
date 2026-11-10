import { it, expect, vi } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
vi.mock("server-only", () => ({}));
import {
  archiveCatalogue,
  archivedEra5Day,
  nationalWeatherDocument,
} from "../../lib/server/weather-archives";
import { historicalProvider, forecastProvider } from "./archives";
import { computeBatch } from "./engine";
import { calendarDays } from "../national/daily-availability";
import geography from "../../data/operational/pra-watch-places.json";
it.skipIf(process.env.AGRO02_REAL !== "1")(
  "reads verified live archives without writes and runs a national daily pilot",
  async () => {
    const catalogue = await archiveCatalogue();
    expect(catalogue).not.toBeNull();
    const latest = catalogue!.era5
      .flatMap((a) => a.dates)
      .sort()
      .at(-1)!;
    const historical = await archivedEra5Day(latest);
    expect(historical?.length).toBeGreaterThan(0);
    const document = await nationalWeatherDocument();
    expect(document).not.toBeNull();
    const first = new Date(Date.parse(document!.run.slice(0, 10)) + 86400000)
      .toISOString()
      .slice(0, 10);
    const groups = [];
    for (const [nature, period, provider] of [
      ["reanalysis", [latest, latest], await historicalProvider(historical!)],
      [
        "forecast",
        [first, first],
        forecastProvider(document!, calendarDays(first, first)),
      ],
    ] as const) {
      const began = performance.now();
      const b = computeBatch(
        geography.places.map((p) => p.id),
        [...period],
        provider,
      );
      const counts: Record<string, Record<string, number>> = {};
      for (const m of b.measurements) {
        const key = m.production + "/" + m.indicator;
        const c = (counts[key] ??= {});
        const state = m.result.quality?.state ?? "unknown";
        c[state] = (c[state] ?? 0) + 1;
      }
      groups.push({
        nature,
        period,
        milliseconds: performance.now() - began,
        metrics: b.metrics,
        counts,
        samples: b.measurements.filter(
          (m) =>
            ["pra:29102", "pra:28341", "pra:2A259"].includes(
              m.result.territoryId,
            ) && ["rain", "gdd_base6", "thi"].includes(m.indicator),
        ),
      });
    }
    mkdirSync("../../docs/codex/AGRO-02/evidence", { recursive: true });
    writeFileSync(
      "../../docs/codex/AGRO-02/evidence/live.json",
      JSON.stringify(
        {
          executed_at: new Date().toISOString(),
          forecast_archive: document!.archive_sha256,
          groups,
        },
        null,
        2,
      ) + "\n",
    );
  },
  180000,
);
