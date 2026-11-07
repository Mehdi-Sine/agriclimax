import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RegionalMap, RegionalChart, proportion } from "./visualizations";
import { ProductionStoryCard } from "./stories";
import type { RegionalSection } from "../model";
import type { Contribution } from "../registry";
const region: RegionalSection = {
  id: "Bretagne",
  label: "Bretagne",
  total_pra: 10,
  events: [],
  coverage: [{ phenomenon: "frost", affected: 2, evaluated: 4 }],
  productions: [],
  summary: "",
  href: "/veille",
};
describe("Journal presentation (synthetic fixtures only)", () => {
  it("distinguishes unavailable from evaluated zero", () => {
    expect(proportion(0, 0)).toBeNull();
    expect(proportion(0, 5)).toBe(0);
    expect(proportion(2, 4)).toBe(50);
  });
  it("shows exact denominators and marks incomplete coverage", () => {
    const map = renderToStaticMarkup(
      <RegionalMap regions={[region]} phenomenon="frost" />,
    );
    expect(map).toContain("2 / 4 PRA évaluables (50 %), sur 10 PRA");
    expect(map).toContain("url(#partial)");
    const chart = renderToStaticMarkup(
      <RegionalChart regions={[region]} phenomenon="frost" />,
    );
    expect(chart).toContain("2 / 4 · 50 %");
    expect(chart).toContain("4 / 10 PRA");
  });
  it("does not imply a crossing with missing or zero data", () => {
    const chart = renderToStaticMarkup(
      <RegionalChart
        regions={[{ ...region, coverage: [] }]}
        phenomenon="frost"
      />,
    );
    expect(chart).toContain("Non évaluable");
    expect(chart).not.toContain("NaN");
  });
  it("excludes unqualified production indicators even if provided by a caller", () => {
    const section: Contribution = {
      id: "future",
      label: "Future production",
      family: "culture",
      source: "test",
      year: null,
      declared_pra_count: null,
      event_ids: [],
      href: "/veille",
      limits: "test only",
      indicators: [
        {
          id: "test",
          version: "1",
          qualified: false,
          publishable: true,
          status: "available",
          quality: "test",
          scale: "pra",
          period: ["2026-01-01", "2026-01-02"],
          provenance: ["test"],
          limits: "test",
          facts: [
            {
              id: "test",
              text: "MUST NOT PUBLISH",
              value: 1,
              unit: "jours",
              period: ["2026-01-01", "2026-01-02"],
              source: "test",
              rule_version: "1",
              provenance: ["test"],
              quality_flags: [],
              data_freshness: [],
              href: "/veille",
            },
          ],
        },
      ],
    };
    const html = renderToStaticMarkup(
      <ProductionStoryCard section={section} />,
    );
    expect(html).not.toContain("MUST NOT PUBLISH");
    expect(html).toContain("Future production");
  });
});
