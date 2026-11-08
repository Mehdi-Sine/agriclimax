import { it, expect, vi, beforeEach } from "vitest";
vi.mock("../../../lib/server/national-watch", () => ({
  nationalWatch: vi.fn(),
}));
import { nationalWatch } from "../../../lib/server/national-watch";
import { GET } from "../../../app/api/journal/map/route";
beforeEach(() => {
  vi.mocked(nationalWatch).mockReset();
});
it.each([
  "",
  "?run=2026-11-07&phenomenon=frost",
  "?run=2026-02-30T00:00:00Z&phenomenon=frost",
  "?run=2026-11-07T00:00:00Z&phenomenon=anomaly",
  "?run=2026-11-07T00:00:00Z&phenomenon=frost&extra=1",
  "?run=2026-11-07T00:00:00Z&phenomenon=frost&phenomenon=rain",
])("rejects unpinned or invalid map context %s", async (query) => {
  const r = await GET(new Request("https://test/api/journal/map" + query));
  expect(r.status).toBe(400);
  expect(nationalWatch).not.toHaveBeenCalled();
});
it("never falls back to the current map when an archive is unavailable", async () => {
  vi.mocked(nationalWatch).mockImplementation(() => {
    throw new Error("private details must not escape");
  });
  const r = await GET(
    new Request(
      "https://test/api/journal/map?run=2026-11-06T00:00:00Z&phenomenon=frost",
    ),
  );
  expect(r.status).toBe(503);
  expect(r.headers.get("cache-control")).toBe("no-store");
  expect(await r.text()).not.toContain("private");
  expect(nationalWatch).toHaveBeenCalledExactlyOnceWith("2026-11-06T00:00:00Z");
});
