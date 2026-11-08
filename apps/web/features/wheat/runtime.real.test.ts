import { it, expect, vi } from "vitest";
import { writeFile } from "node:fs/promises";
vi.mock("server-only", () => ({}));
import { nationalWeatherDocument } from "../../lib/server/weather-archives";
import { wheatForecast } from "../../lib/server/wheat";
it.skipIf(process.env.AGRO01_RUNTIME !== "1")(
  "measures an isolated cold forecast calculation and warm replay",
  async () => {
    const initial = process.memoryUsage().rss,
      began = performance.now(),
      document = await nationalWeatherDocument();
    expect(document).not.toBeNull();
    const loaded = performance.now(),
      rssLoaded = process.memoryUsage().rss,
      summaries = await wheatForecast(document!),
      computed = performance.now(),
      warm = await wheatForecast(document!),
      end = performance.now();
    expect(warm).toBe(summaries);
    expect(Buffer.byteLength(JSON.stringify(summaries))).toBeLessThan(250000);
    expect(computed - loaded).toBeLessThan(1500);
    await writeFile(
      "../../docs/codex/agro01/evidence/runtime.json",
      JSON.stringify(
        {
          executed_at: new Date().toISOString(),
          archive_sha256: document!.archive_sha256,
          archive_read_validate_ms: loaded - began,
          compute_ms: computed - loaded,
          warm_replay_ms: end - computed,
          initial_rss_bytes: initial,
          loaded_rss_bytes: rssLoaded,
          final_rss_bytes: process.memoryUsage().rss,
          process_peak_rss_bytes: process.resourceUsage().maxRSS * 1024,
          summary_bytes: Buffer.byteLength(JSON.stringify(summaries)),
          memoized_cycle_count: 1,
        },
        null,
        2,
      ),
    );
  },
  45000,
);
