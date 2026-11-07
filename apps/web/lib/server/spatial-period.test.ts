import { it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("./weather-archives", () => ({
  currentManifest: vi.fn().mockResolvedValue({ supports: [] }),
  archiveCatalogue: vi.fn().mockResolvedValue({ supports: [] }),
  archiveBlob: vi.fn(),
}));
import { periodSupportDocument } from "./spatial-restitution";
it("reuses 67 identical Task26D masks over four complete days without painting unavailable days", async () => {
  const valid = await periodSupportDocument(
    "2026-10-27",
    "2026-10-30",
    "temperature",
  );
  expect(valid.verified).toBe(true);
  expect(valid.collection.features).toHaveLength(67);
  expect(
    new Set(valid.collection.features.map((f) => f.properties.code)).size,
  ).toBe(67);
  const missing = await periodSupportDocument(
    "2026-10-02",
    "2026-10-30",
    "temperature",
  );
  expect(missing.verified).toBe(false);
  expect(missing.collection.features).toHaveLength(0);
  const extremes = await periodSupportDocument(
    "2026-10-27",
    "2026-10-30",
    "temperature_max",
  );
  expect(extremes.verified).toBe(true);
  expect(extremes.collection.features).toHaveLength(67);
});
it("restores a genuine seven-day common support while keeping the 1.1 data path available", async () => {
  const { observedSupportDay } = await import("./spatial-restitution");
  for (const variable of [
    "temperature",
    "temperature_min",
    "temperature_max",
    "precipitation",
  ]) {
    const period = await periodSupportDocument(
      "2026-10-25",
      "2026-10-31",
      variable,
    );
    expect(period.verified).toBe(true);
    expect(period.collection.features).toHaveLength(67);
    expect(period.rows.find((r) => r.pra_id === "pra:29102")).toBeUndefined();
  }
  expect(
    (await observedSupportDay("2026-10-25", "temperature", true)).verified,
  ).toBe(false);
  expect((await observedSupportDay("2026-10-25", "temperature")).verified).toBe(
    true,
  );
});
