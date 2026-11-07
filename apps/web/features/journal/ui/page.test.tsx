// Synthetic editions only: exercise absent-data and quiet-day UI, never served to users.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToReadableStream } from "react-dom/server";
import type { JournalEdition } from "../model";
vi.mock("../../../lib/server/journal", () => ({ journal: vi.fn() }));
import { journal } from "../../../lib/server/journal";
import Page from "../../../app/journal/page";
const empty: JournalEdition = {
  edition_id: "test-only",
  edition_date: "2026-11-01",
  edition_version: "test",
  generated_at: "2026-11-01T00:00:00Z",
  source_cycles: ["2026-11-01T00:00:00Z"],
  data_cutoff: "2026-11-01T00:00:00Z",
  data_freshness: "expired",
  publication_status: "preview",
  headline: "Une édition sans franchissement des critères descriptifs",
  lead: "Couverture limitée (fixture synthétique).",
  key_facts: [],
  main_story: null,
  secondary_stories: [],
  production_sections: [],
  regional_sections: [],
  regional_focus_ids: [],
  visualizations: [],
  evidence: {
    version: "test",
    facts: [],
    limitations: [],
    fallback: { headline: "", lead: "" },
    visualization_ids: [],
  },
  limitations: [],
  provenance: ["test-only"],
};
async function html() {
  const stream = await renderToReadableStream(
    <Page searchParams={Promise.resolve({ run: "2026-11-01" })} />,
  );
  await stream.allReady;
  return new Response(stream).text();
}
describe("Journal page states (synthetic)", () => {
  beforeEach(() => vi.mocked(journal).mockReset());
  it("renders a quiet archived day without invented signals or visualizations", async () => {
    vi.mocked(journal).mockResolvedValue(empty);
    const result = await html();
    expect(result).toContain("Pas de signal à mettre en carte");
    expect(result).toContain("Aucun fait saillant publiable");
    expect(result).toContain("Prévisions expirées");
    expect(result).not.toContain('class="journal-map');
    expect(result).not.toContain("NaN");
    expect(result).toContain("/api/journal?run=2026-11-01");
  });
});
