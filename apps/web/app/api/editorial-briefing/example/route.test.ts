import { it, expect } from "vitest";
import { GET } from "./route";
it("serves a bounded precomputed historical briefing with conditional caching", async () => {
  const response = await GET(
    new Request("https://example.test/api/editorial-briefing/example"),
  );
  expect(response.status).toBe(200);
  const raw = await response.text();
  expect(Buffer.byteLength(raw)).toBeLessThan(96 * 1024);
  const body = JSON.parse(raw);
  expect(body.edition_date).toBe("2026-10-30");
  expect(response.headers.get("x-editorial-example")).toBe("historical-replay");
  expect(
    (
      await GET(
        new Request("https://example.test/api/editorial-briefing/example", {
          headers: { "if-none-match": response.headers.get("etag")! },
        }),
      )
    ).status,
  ).toBe(304);
});
