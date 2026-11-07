import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const archived = vi.hoisted(() => vi.fn().mockResolvedValue(null));
vi.mock("./spatial-restitution", () => ({ complementaryDocument: archived }));
import seed from "../../data/operational/coastal-complement.json";
import { coastalComplement } from "./coastal-complement";
import { RULES } from "../../features/agroclimatic/catalogue";
import {
  observedRule,
  NATIVE_RULE_VERSION,
} from "../../features/agroclimatic/observed-support";
const rule = (id: string) =>
  observedRule(RULES.find((r) => r.id === id)!, NATIVE_RULE_VERSION);
beforeEach(() => archived.mockReset().mockResolvedValue(null));
it("exposes a separately traced reconstruction without changing native coverage", async () => {
  const result = await coastalComplement(
    rule("gdd"),
    "2026-10-25",
    "2026-10-31",
    0,
  );
  expect(result).toMatchObject({
    days: 7,
    native_spatial_coverage: 0,
    source_kind: "spatial_reconstruction",
    scientific_status: "exploratory",
    rule_version: NATIVE_RULE_VERSION,
  });
  expect(result?.value).toBeGreaterThan(0);
  expect(result?.provenance).toHaveLength(7);
  expect(result?.validation.reference).toBe(
    "ERA5-Land field, not an independent station",
  );
  expect(archived).not.toHaveBeenCalled();
});
it("never supplies native extrema, threshold events, THI or missing future dates", async () => {
  for (const id of ["hot", "frost", "cattle_heat", "heavy_rain", "thi"])
    expect(
      await coastalComplement(rule(id), "2026-10-31", "2026-10-31", 25),
    ).toBeUndefined();
  expect(
    await coastalComplement(rule("rain"), "2026-11-01", "2026-11-01", null),
  ).toBeUndefined();
});
it("accepts incremental archives only with the frozen certificate and stable neighbor support", async () => {
  const day = seed.days["2026-10-31"];
  const future = { ...seed, days: { "2026-11-01": day } };
  archived.mockResolvedValue({
    document: future,
    archive_sha256: "archive-proof",
  });
  expect(
    (await coastalComplement(rule("rain"), "2026-11-01", "2026-11-01", null))
      ?.days,
  ).toBe(1);
  archived.mockResolvedValue({
    document: { ...future, validation_sha256: "different-validation" },
    archive_sha256: "archive-proof",
  });
  expect(
    await coastalComplement(rule("rain"), "2026-11-01", "2026-11-01", null),
  ).toBeUndefined();
  archived.mockResolvedValue({
    document: {
      ...future,
      days: {
        "2026-11-01": {
          ...day,
          precipitation: { ...day.precipitation, support_id: "b".repeat(64) },
        },
      },
    },
    archive_sha256: "archive-proof",
  });
  expect(
    await coastalComplement(rule("rain"), "2026-10-31", "2026-11-01", null),
  ).toBeUndefined();
});
