import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { editorialFieldSummaries } from "./editorial-field";
import { legacyHistoryDates, legacyHistoryDay } from "./climate-history";
import { shift } from "../../features/editorial/temporal";

describe("contexte AGRO-05 du Journal", () => {
  const end = legacyHistoryDates[6];
  const start = shift(end, -6);
  const rows = legacyHistoryDates.slice(0, 7).flatMap(day => legacyHistoryDay(day) ?? []);

  it("n’étend jamais un support partiel à la PRA entière", async () => {
    const summaries = await editorialFieldSummaries(rows, end);
    expect(summaries).toHaveLength(4);
    expect(summaries.map(item => item.indicator)).not.toContain("field_maize_gdd");
    for (const summary of summaries) {
      expect(summary).toMatchObject({ version: "agro-field-summary-1", period: { start, end, timezone: "UTC" }, total_pra: 713 });
      expect(summary.evaluable_pra).toBeGreaterThan(0);
      expect(summary.evaluable_pra).toBeLessThan(713);
      expect(summary.territories.map(item => item.id)).not.toContain("pra:29102");
      for (const place of summary.territories) {
        for (const production of place.productions) expect(production).toMatchObject({ source: "rpg-2025", year: 2025 });
      }
    }
  });

  it("s’abstient lorsque la fenêtre n’est pas continue", async () => {
    await expect(editorialFieldSummaries(rows.filter(row => row.valid_date !== shift(end, -3)), end)).resolves.toEqual([]);
  });
});
