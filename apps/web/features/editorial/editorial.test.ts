import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
vi.mock("server-only", () => ({}));
import {
  validateAlmanac,
  getSeasonalEditorialContext,
  easter,
  parisDate,
  inWindow,
  almanac,
} from "./almanac";
import {
  adaptHistory,
  compareHistory,
  reconstructEpisodes,
  qualifiedCompare,
  extendEpisode,
  shift,
  hash,
  type DailyEvidence,
} from "./temporal";
import { buildBriefing } from "./briefing";
import { assertBriefing } from "./validate";
import {
  legacyHistoryDay,
  legacyHistoryDates,
} from "../../lib/server/climate-history";
import { historicalWheatContribution } from "./contributions";
import { unpackHistoryProduct } from "../../lib/server/history-product";
import type { WheatSummary } from "../wheat/national";
import type { Snapshot } from "../journal/history";
const places = [{ id: "pra:1", name: "Test", region: "Bretagne" }];
function evidence(days: number, missing: number[] = []): DailyEvidence[] {
  return Array.from({ length: days }, (_, i) => ({
    date: shift("2026-10-01", i),
    pra: "pra:1",
    region: "Bretagne",
    phenomenon: "dry",
    value: missing.includes(i) ? null : 0,
    detected: missing.includes(i) ? null : true,
    signature: "stable",
    rule_version: "test-1",
    unit: "jours",
    nature: "reanalysis",
    provenance: ["source"],
    data_freshness: ["2026-11-08T00:00:00Z"],
    quality_flags: [],
  }));
}
function bundleInput(history = evidence(30)) {
  return {
    date: "2026-10-30",
    generated_at: "2026-11-08T00:00:00Z",
    history_cutoff: "2026-10-30",
    source_fingerprint: hash(history),
    history,
    comparisons: compareHistory(history, "2026-10-30", places),
    episodes: reconstructEpisodes(history, "2026-10-30"),
    episode_archive_sha256: hash("archive"),
  };
}
describe("canonical almanac", () => {
  it("preserves exact bytes and validates every cross reference", () => {
    expect(
      validateAlmanac(
        readFileSync("../../config/almanach/agriclimax-almanach.v1.json"),
      ),
    ).toMatchObject({ days: 365, windows: 157, sources: 47 });
    expect(() => validateAlmanac(new Uint8Array([0]))).toThrow("CHECKSUM");
  });
  it("resolves all 365 dates without collision", () => {
    for (const day of almanac.jours) {
      const c = getSeasonalEditorialContext("2026-" + day.date_mm_jj);
      expect(c.daily_question).toBe(day.angle_editorial);
      expect(c.windows.every((w) => w.publication_eligible === false)).toBe(
        true,
      );
    }
  });
  it("handles leap day without inheriting fixed traditions", () => {
    const c = getSeasonalEditorialContext("2028-02-29");
    expect(c.leap_day).toBe(true);
    expect(c.windows.length).toBeGreaterThan(0);
    expect(c.markers).toEqual([]);
    expect(c.daily_question).toBeNull();
  });
  it("uses Paris editorial dates across UTC midnight and DST", () => {
    expect(parisDate("2026-03-28T23:30:00Z")).toBe("2026-03-29");
    expect(parisDate("2026-07-01T22:30:00Z")).toBe("2026-07-02");
    expect(() => parisDate("2026-02-30")).toThrow();
  });
  it("computes Gregorian Easter per year and leaves unverified mobiles unresolved", () => {
    expect(easter(2026)).toBe("2026-04-05");
    expect(easter(2027)).toBe("2027-03-28");
    const c = getSeasonalEditorialContext("2026-04-05");
    expect(c.mobile_events.filter((m) => m.active)).toHaveLength(1);
    expect(c.mobile_events.filter((m) => m.date === null)).toHaveLength(6);
  });
  it("retains review flags, filters productions and resolves fixed aliases", () => {
    const c = getSeasonalEditorialContext(
      "2026-05-11",
      undefined,
      "Maraîchage",
    );
    expect(
      c.windows.every(
        (w) =>
          w.productions.includes("Maraîchage") ||
          w.productions.includes("Toutes productions"),
      ),
    ).toBe(true);
    const veg = getSeasonalEditorialContext(
      "2026-05-11",
      undefined,
      undefined,
      40,
    ).windows.filter((w) => w.id.startsWith("VEG-"));
    expect(veg.length).toBeGreaterThan(0);
    expect(veg.every((w) => w.confidence === "review_required")).toBe(true);
    for (const day of almanac.jours.filter((d) =>
      d.fenetre_id.startsWith("MARR-"),
    ))
      expect(
        getSeasonalEditorialContext("2026-" + day.date_mm_jj).markers.length,
      ).toBeGreaterThan(0);
  });
  it("handles windows across December and rejects invalid filters", () => {
    expect(inWindow("01-02", "12-01", "02-01")).toBe(true);
    expect(inWindow("06-02", "12-01", "02-01")).toBe(false);
    expect(() =>
      getSeasonalEditorialContext("2026-10-30", "Atlantide"),
    ).toThrow();
  });
});
describe("qualified temporal evidence", () => {
  it("requires 60 days for two 30-day windows", () => {
    const rows = compareHistory(evidence(30), "2026-10-30", places).filter(
      (c) => c.phenomenon === "dry",
    );
    expect(rows.find((c) => c.horizon === 14)?.kind).toBe(
      "historical_evolution",
    );
    expect(rows.find((c) => c.horizon === 30)?.kind).toBe(
      "insufficient_history",
    );
  });
  it("refuses gaps and changing support without filling dates", () => {
    const es = evidence(30, [26]);
    expect(
      compareHistory(es, "2026-10-30", places).find(
        (c) => c.horizon === 3 && c.phenomenon === "dry",
      )?.kind,
    ).toBe("not_comparable");
    const changed = evidence(30);
    changed.at(-1)!.signature = "changed";
    expect(
      compareHistory(changed, "2026-10-30", places).find(
        (c) => c.horizon === 3 && c.phenomenon === "dry",
      )?.support_count,
    ).toBe(0);
  });
  it("separates revisions from historical evolution for every comparator status", () => {
    const old: Snapshot = {
      nature: "forecast",
      source: "mf",
      model: "arome",
      version: "1",
      unit: "mm",
      period: ["2026-11-08", "2026-11-09"],
      date: "2026-11-01",
      complete: true,
      pra_ids: ["a"],
      evaluated_ids: ["a", "b"],
      magnitude: 10,
      episode_id: "rain",
    };
    const current = { ...old, date: "2026-11-04", pra_ids: ["a", "b"] };
    expect(qualifiedCompare(current, old, 3)).toMatchObject({
      kind: "forecast_revision",
      change: { status: "extension" },
    });
    expect(
      qualifiedCompare(
        { ...current, period: ["2026-11-09", "2026-11-10"] },
        old,
        3,
      ).kind,
    ).toBe("not_comparable");
  });
  it("never bridges an unknown day and only closes with documented non-event", () => {
    const es = evidence(9, [4]);
    es[8].detected = false;
    const episodes = reconstructEpisodes(es, "2026-10-09");
    expect(episodes.map((e) => e.duration_days).sort()).toEqual([3, 4]);
    expect(episodes.find((e) => e.duration_days === 4)?.status).toBe(
      "continuity_unconfirmed",
    );
    expect(episodes.find((e) => e.duration_days === 3)?.status).toBe("ended");
  });
  it("extends an episode only on the same scientific and spatial support", () => {
    const a = reconstructEpisodes(evidence(3), "2026-10-03")[0],
      b = reconstructEpisodes(evidence(5).slice(3), "2026-10-05");
    expect(b).toEqual([]);
    const next = reconstructEpisodes(evidence(6).slice(3), "2026-10-06")[0];
    expect(extendEpisode(a, next)).toMatchObject({
      id: a.id,
      duration_days: 6,
    });
    expect(() => extendEpisode(a, { ...next, signature: "other" })).toThrow();
  });
  it("rejects duplicate daily records and suppresses partial native support", () => {
    const rows = legacyHistoryDay(legacyHistoryDates[0])!;
    expect(() =>
      adaptHistory(
        [rows[0], rows[0]],
        [{ ...places[0], id: rows[0].pra_id }],
        "test",
      ),
    ).toThrow("DUPLICATE");
    const partial = rows.find((r) => r.status === "partial")!;
    expect(
      adaptHistory(
        [partial],
        [{ ...places[0], id: partial.pra_id }],
        "test",
      ).every((e) => e.value === null),
    ).toBe(true);
  });
});
describe("T35 evidence briefing", () => {
  it("is reproducible, bounded and referentially valid", () => {
    const input = bundleInput(),
      a = buildBriefing(input),
      b = buildBriefing(input);
    assertBriefing(a);
    expect(a).toEqual(b);
    expect(Buffer.byteLength(JSON.stringify(a))).toBeLessThan(96 * 1024);
    const broken = structuredClone(a);
    broken.candidates[0].evidence_ids = ["fake"];
    broken.bundle_id = hash({ ...broken, bundle_id: undefined });
    expect(() => assertBriefing(broken)).toThrow("REFERENCES");
  });
  it("keeps a quiet day documentary without a headline", () => {
    const es = evidence(30).map((e) => ({ ...e, detected: false }));
    const b = buildBriefing(bundleInput(es));
    expect(b.candidates).toHaveLength(0);
    expect(b.journal_proposals.headline_candidate_ids).toEqual([]);
    expect(b.seasonal.background_questions.length).toBeGreaterThan(0);
    assertBriefing(b);
  });
  it("keeps stale archives out of current headline proposals", () => {
    const b = buildBriefing({ ...bundleInput(), date: "2026-11-08" });
    expect(b.validity.data_freshness).toBe("stale");
    expect(b.journal_proposals.headline_candidate_ids).toEqual([]);
    assertBriefing(b);
  });
  it("reports missing data explicitly", () => {
    const b = buildBriefing(bundleInput([]));
    expect(b.status).toBe("insufficient_data");
    expect(b.national.coverage.complete_pra_at_cutoff).toBe(0);
  });
  it("imports the ten real descriptive wheat indicators without new scientific computation", () => {
    const product = JSON.parse(
      gunzipSync(
        readFileSync("../../docs/codex/DATA-01/evidence/wheat-30d.json.gz"),
      ).toString(),
    );
    const { summary } = unpackHistoryProduct(product) as unknown as {
      summary: WheatSummary;
    };
    expect(historicalWheatContribution(summary).indicators).toHaveLength(10);
    expect(() =>
      historicalWheatContribution({ ...summary, identity: "tampered" }),
    ).toThrow();
  });
});
it("never promotes weak T34 links or a publication from after the editorial date", () => {
  const input = bundleInput();
  const initial = buildBriefing(input);
  const eventId = initial.candidates[0].evidence_ids[0].replace("fact-", "");
  const publication = {
    id: "pub",
    source_id: "source",
    publisher: "Publisher",
    title: "External context",
    original_url: "https://example.test/publication",
    published_at: "2026-10-20T00:00:00Z",
    content_type: "news",
    limitations: ["Documentary only"],
  };
  const link = {
    publication_id: "pub",
    event_id: eventId,
    axes: {
      temporal: "match" as const,
      geographic: "unknown" as const,
      production: "unknown" as const,
      phenomenon: "match" as const,
      thematic: "unknown" as const,
    },
    temporal_distance_days: 0,
    relation: "documentary-candidate" as const,
    scientific_confirmation: false as const,
    limitation: "Weak documentary link",
  };
  const weak = buildBriefing({
    ...input,
    news: {
      bundle_id: "news-1",
      generated_at: "2026-11-08T00:00:00Z",
      publications: [publication],
      links: [link],
    },
  });
  expect(
    weak.candidates.every(
      (c) => c.news_ids.length === 0 && c.rationale.documentary_matches === 0,
    ),
  ).toBe(true);
  expect(weak.documentary.weak_matches).toHaveLength(1);
  assertBriefing(weak);
  const future = buildBriefing({
    ...input,
    news: {
      bundle_id: "news-2",
      generated_at: "2026-11-08T00:00:00Z",
      publications: [{ ...publication, published_at: "2026-10-30T23:30:00Z" }],
      links: [link],
    },
  });
  expect(future.documentary.weak_matches).toHaveLength(0);
  expect(future.documentary.publications).toHaveLength(0);
});
