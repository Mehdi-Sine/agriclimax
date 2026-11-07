import { it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const sources = vi.hoisted(() => ({ watch: vi.fn(), wheat: vi.fn() }));
vi.mock("./national-watch", () => ({ nationalWatch: sources.watch }));
vi.mock("./wheat", () => ({ latestWheatForecast: sources.wheat }));
import { journal } from "./journal";
import { assertEdition } from "../../features/journal/validate";
import type { WatchSummary } from "../../features/national-watch/model";
const watch: WatchSummary = {
  version: "synthetic",
  identity: "synthetic-fail-open",
  source_version: "synthetic",
  run: "2026-11-07T00:00:00Z",
  acquired_at: "2026-11-07T00:00:00Z",
  published_at: null,
  source_nature: "forecast",
  period: ["2026-11-08", "2026-11-14"],
  places: [],
  productions: [],
  metrics: [],
  evidence: {},
  events: [],
  coverage: [],
  calculated_at: "2026-11-07T00:00:00Z",
  compute_ms: 0,
};
it("keeps the national edition available when wheat archives fail and retries enrichment", async () => {
  sources.watch.mockResolvedValue(watch);
  sources.wheat.mockRejectedValue(new Error("private upstream details"));
  const first = await journal();
  assertEdition(first);
  expect(
    first.production_sections.find((p) => p.id === "wheat")!.indicators,
  ).toEqual([]);
  expect(JSON.stringify(first)).not.toContain("private upstream");
  await journal();
  expect(sources.wheat).toHaveBeenCalledTimes(2);
});
it("bounds a stalled wheat enrichment without blocking national publication", async () => {
  sources.watch.mockResolvedValue({ ...watch, identity: "synthetic-timeout" });
  sources.wheat.mockReturnValue(new Promise(() => {}));
  const began = performance.now(),
    edition = await journal();
  assertEdition(edition);
  expect(performance.now() - began).toBeLessThan(1800);
  expect(
    edition.production_sections.find((p) => p.id === "wheat")!
      .indicator_inventory?.[0].quality,
  ).toContain("unavailable");
});
