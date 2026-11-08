/** Manual, local-only batch. No production writes or implicit network calls. Run from repo root. */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  renameSync,
} from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import {
  legacyHistoryDates,
  legacyHistoryDay,
} from "../apps/web/lib/server/climate-history";
import { unpackHistoryProduct } from "../apps/web/lib/server/history-product";
import {
  adaptHistory,
  compareHistory,
  reconstructEpisodes,
  hash,
} from "../apps/web/features/editorial/temporal";
import {
  getSeasonalEditorialContext,
  validateAlmanac,
  parisDate,
} from "../apps/web/features/editorial/almanac";
import {
  buildBriefing,
  briefingEvents,
  type NewsContext,
  type BriefingInput,
} from "../apps/web/features/editorial/briefing";
import {
  assertBriefing,
  assertEpisodeMemory,
} from "../apps/web/features/editorial/validate";
import { assertEdition } from "../apps/web/features/journal/validate";
import { historicalWheatContribution } from "../apps/web/features/editorial/contributions";
import places from "../apps/web/data/operational/pra-watch-places.json";
import type { WheatSummary } from "../apps/web/features/wheat/national";
const args = process.argv.slice(2);
function arg(name: string, fallback?: string) {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
}
function read(path: string): unknown {
  const bytes = readFileSync(path);
  return JSON.parse(
    (path.endsWith(".gz") ? gunzipSync(bytes) : bytes).toString(),
  );
}
const validatePath = arg("--validate");
if (validatePath) {
  const bundle = read(validatePath);
  assertBriefing(bundle);
  console.log(JSON.stringify({ valid: true, bundle_id: bundle.bundle_id }));
} else {
  const began = performance.now(),
    date = arg("--date", legacyHistoryDates.at(-1))!,
    cutoff = arg(
      "--cutoff",
      legacyHistoryDates.filter((d) => d <= date).at(-1),
    )!,
    output = arg("--output", "work/task33/archive")!;
  if (!cutoff) throw Error("NO_COMPATIBLE_HISTORY");
  getSeasonalEditorialContext(date);
  validateAlmanac(readFileSync("config/almanach/agriclimax-almanach.v1.json"));
  const dates = legacyHistoryDates.filter((d) => d <= cutoff).slice(-60),
    rows = dates.flatMap((d) => legacyHistoryDay(d) ?? []);
  const history = adaptHistory(rows, places.places, "legacy-rpc-1"),
    comparisons = compareHistory(history, cutoff, places.places),
    episodes = reconstructEpisodes(history, cutoff);
  const episodeContent = JSON.stringify({
      version: "climate-episode-memory-1",
      cutoff,
      episodes,
    }),
    episodeSha = createHash("sha256").update(episodeContent).digest("hex");
  assertEpisodeMemory(JSON.parse(episodeContent));
  const editionPath = arg("--edition"),
    edition = editionPath ? read(editionPath) : undefined;
  if (edition !== undefined) assertEdition(edition);
  const wheatPath = arg("--wheat"),
    contributions = wheatPath
      ? [
          historicalWheatContribution(
            (
              unpackHistoryProduct(
                read(wheatPath) as Parameters<typeof unpackHistoryProduct>[0],
              ) as unknown as { summary: WheatSummary }
            ).summary,
          ),
        ]
      : undefined;
  const base: BriefingInput = {
    date,
    generated_at: arg("--generated-at", `${date}T05:30:00Z`)!,
    history_cutoff: cutoff,
    source_fingerprint: hash(rows),
    history,
    comparisons,
    episodes,
    episode_archive_sha256: episodeSha,
    ...(edition ? { edition } : {}),
    ...(contributions ? { contributions } : {}),
  };
  const newsPath = arg("--news");
  if (newsPath) {
    const news = read(newsPath) as NewsContext;
    const events = briefingEvents(base);
    const matching = spawnSync(
      arg("--python", "python")!,
      ["scripts/task33_news_links.py"],
      {
        input: JSON.stringify({
          news: {
            ...news,
            publications: news.publications.filter(
              (p) =>
                p.published_at !== null && parisDate(p.published_at) <= date,
            ),
          },
          events: [
            ...events.historical.map(({ episodes, ...e }) => {
              void episodes;
              return e;
            }),
            ...events.forecast.map((e) => ({
              id: e.id,
              phenomenon: e.phenomenon,
              region: e.region,
              period: e.period,
              production_ids: e.production_ids,
              provenance: e.evidence_ids,
            })),
          ],
        }),
        encoding: "utf8",
        maxBuffer: 8 * 1024 ** 2,
      },
    );
    if (matching.status !== 0)
      throw Error(`T34_ADAPTER_FAILED: ${matching.stderr}`);
    base.news = {
      bundle_id: news.bundle_id,
      generated_at: news.generated_at,
      publications: news.publications.map((p) => ({
        id: p.id,
        source_id: p.source_id,
        publisher: p.publisher,
        title: p.title,
        original_url: p.original_url,
        published_at: p.published_at,
        content_type: p.content_type,
        limitations: p.limitations,
      })),
      links: JSON.parse(matching.stdout),
    };
  }
  base.generated_at =
    arg("--generated-at") ??
    [
      ...rows.map((r) => r.computed_at),
      ...(base.news ? [base.news.generated_at] : []),
      ...(base.edition ? [base.edition.generated_at] : []),
    ]
      .sort((a, b) => Date.parse(a) - Date.parse(b))
      .at(-1)!;
  const bundle = buildBriefing(base);
  assertBriefing(bundle);
  mkdirSync(output, { recursive: true });
  function immutable(name: string, bytes: Uint8Array | string) {
    const path = join(output, name);
    if (existsSync(path)) {
      if (!readFileSync(path).equals(Buffer.from(bytes)))
        throw Error("IMMUTABLE_ARCHIVE_CONFLICT");
      return;
    }
    writeFileSync(path + ".tmp", bytes);
    renameSync(path + ".tmp", path);
  }
  immutable(`${episodeSha}.episodes.json.gz`, gzipSync(episodeContent));
  immutable(`${bundle.bundle_id}.json`, JSON.stringify(bundle, null, 2) + "\n");
  immutable(
    `${bundle.bundle_id}.comparisons.json`,
    JSON.stringify(comparisons, null, 2) + "\n",
  );
  const metrics = {
    bundle_id: bundle.bundle_id,
    dates: [dates[0], dates.at(-1)],
    days: dates.length,
    rows: rows.length,
    episodes: episodes.length,
    ongoing_at_cutoff: episodes.filter((e) => e.status === "ongoing_at_cutoff")
      .length,
    episode_types: Object.fromEntries(
      [...new Set(episodes.map((e) => e.phenomenon))].map((p) => [
        p,
        episodes.filter((e) => e.phenomenon === p).length,
      ]),
    ),
    horizons: [3, 7, 14, 30].map((h) => ({
      horizon: h,
      qualified: comparisons.filter(
        (c) => c.horizon === h && c.kind === "historical_evolution",
      ).length,
      insufficient: comparisons.filter(
        (c) => c.horizon === h && c.kind === "insufficient_history",
      ).length,
    })),
    candidate_count: bundle.candidates.length,
    news_links: bundle.documentary.links.length,
    indicators: bundle.contributions.map((c) => c.indicator),
    compact_bytes: Buffer.byteLength(JSON.stringify(bundle)),
    seconds: (performance.now() - began) / 1000,
    rss_mb: process.memoryUsage().rss / 1024 ** 2,
  };
  writeFileSync(
    join(output, "metrics.json"),
    JSON.stringify(metrics, null, 2) + "\n",
  );
  console.log(JSON.stringify(metrics, null, 2));
}
