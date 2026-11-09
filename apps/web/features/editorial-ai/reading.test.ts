import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { GET } from "../../app/api/journal-preview/route";
import { GET as mapGET } from "../../app/api/journal-preview/map/route";
import { previewEditions } from "../../lib/server/editorial-preview";
import { dailyPlan, DAILY_TARGET } from "./batch";
import { readFileSync } from "node:fs";
describe("archive-only read path", () => {
  it("loads exact bytes, lists both dates and keeps corresponding maps", async () => {
    const editions = previewEditions();
    expect(editions.map((a) => a.date)).toEqual(["2026-11-08", "2026-10-30"]);
    const a = editions[0],
      r = await mapGET(
        new Request(
          `http://local/api/journal-preview/map?id=${a.edition_id}&map=${a.draft.illustration_ids[0]}`,
        ),
      );
    expect(r.status).toBe(200);
    expect((await r.json()).period).toEqual(["2026-11-08", "2026-11-14"]);
  });
  it("serves cached archives with ETag and never fills absent dates", async () => {
    const r = await GET(
      new Request("http://local/api/journal-preview?date=2026-10-30"),
    );
    expect(r.status).toBe(200);
    const etag = r.headers.get("etag")!;
    expect(
      (
        await GET(
          new Request("http://local/api/journal-preview?date=2026-10-30", {
            headers: { "if-none-match": etag },
          }),
        )
      ).status,
    ).toBe(304);
    expect(
      (
        await GET(
          new Request("http://local/api/journal-preview?date=2000-01-01"),
        )
      ).status,
    ).toBe(404);
  });
  it("does not substitute a current map for an old edition", async () => {
    expect(
      (
        await mapGET(
          new Request(
            `http://local/api/journal-preview/map?id=${previewEditions()[1].edition_id}&map=missing`,
          ),
        )
      ).status,
    ).toBe(404);
  });
  it("keeps generation and secrets out of read-path source modules", () => {
    for (const file of [
      "lib/server/editorial-preview.ts",
      "app/api/journal-preview/route.ts",
      "app/api/journal-preview/map/route.ts",
      "app/journal/preview/page.tsx",
      "features/editorial-ai/preview.tsx",
    ]) {
      const s = readFileSync(file, "utf8");
      expect(s).not.toMatch(
        /from\s+["'][^"']*\/(?:provider|generate|config)["']/,
      );
      expect(s).not.toContain("OPENAI_API_KEY");
    }
  });
  it("declares a Paris target and provides last valid edition after cutoff", () => {
    const [a, old] = previewEditions();
    expect(DAILY_TARGET).toEqual({
      hour: 6,
      minute: 30,
      time_zone: "Europe/Paris",
    });
    const plan = dailyPlan(a.briefing, "2000-01-01T00:00:00Z", [old]);
    expect(plan.can_generate).toBe(false);
    expect(plan.status).toBe("after_cutoff");
    expect(plan.fallback_edition_id).toBe(old.edition_id);
    expect(plan.publication_enabled).toBe(false);
  });
});
