import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
import { loadShellData } from "./load-shell-data";
import { ProductShell } from "./product-shell";
import { SupabaseRiskRepository } from "../../lib/server/supabase-risk-repository";
import { parseContext } from "../../lib/url-state";
import { liveMapSummary } from "../../lib/shell-data";
import fixture from "../../../../fixtures/contracts/risk-result.json";

const params = new URLSearchParams(
  "mode=live&production=wheat_soft&indicator=tmax_days_above&rule=demo-rule&version=1.0&date=2026-07-01&bbox=-5,43,1,49",
);
afterEach(() => vi.unstubAllEnvs());

describe("shell demo/live boundary", () => {
  it("keeps default demo local and labelled, without requesting Supabase", async () => {
    const transport = vi.fn<typeof fetch>();
    const data = await loadShellData(
      new URLSearchParams(),
      new SupabaseRiskRepository(transport),
    );
    expect(data.mode).toBe("demo");
    expect(transport).not.toHaveBeenCalled();
    const markup = renderToStaticMarkup(
      <ProductShell
        context={parseContext(new URLSearchParams())}
        data={data}
      />,
    );
    expect(markup).toContain('data-demo="true"');
    expect(markup).toContain("Données fictives");
  });
  it("renders an empty validated live response without inventing a risk or demo signal", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret-sentinel");
    const transport = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        type: "FeatureCollection",
        features: [],
        truncated: false,
        limit: 1000,
      }),
    );
    const data = await loadShellData(
      params,
      new SupabaseRiskRepository(transport),
    );
    expect(data).toEqual({ mode: "live", state: "missing", count: 0 });
    const markup = renderToStaticMarkup(
      <ProductShell context={parseContext(params)} data={data} />,
    );
    expect(markup).toContain("Données live");
    expect(markup).toContain("Données absentes");
    expect(markup).not.toContain('data-demo="true"');
    expect(markup).not.toContain("demo-fiction");
    expect(markup).not.toContain("Risque non identifié");
    expect(markup).not.toContain("test-secret-sentinel");
  });
  it("keeps upstream failures explicit without a silent demo fallback", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret-sentinel");
    const data = await loadShellData(
      params,
      new SupabaseRiskRepository(
        vi
          .fn<typeof fetch>()
          .mockRejectedValue(new Error("test-secret-sentinel")),
      ),
    );
    expect(data).toEqual({
      mode: "live",
      state: "source-error",
      message: "Service live indisponible. Réessayez ultérieurement.",
    });
  });
  it("requires explicit scientific query parameters, with no invented rule/version", async () => {
    const transport = vi.fn<typeof fetch>();
    const data = await loadShellData(
      new URLSearchParams("mode=live"),
      new SupabaseRiskRepository(transport),
    );
    expect(data).toMatchObject({ mode: "live", state: "source-error" });
    expect(transport).not.toHaveBeenCalled();
  });
  it("renders the Observation loading boundary without reclassifying live results", () => {
    expect(liveMapSummary(2)).toEqual({
      mode: "live",
      state: "available",
      count: 2,
    });
    const markup = renderToStaticMarkup(
      <ProductShell context={parseContext(params)} data={liveMapSummary(2)} />,
    );
    expect(markup).toContain("Chargement");
    expect(markup).not.toContain("demo-fiction");
    expect(markup).not.toContain("Cellule fictive");
  });
  it("offers a deep-link from a validated live map result without relabelling it as demo", async () => {
    const repository = new SupabaseRiskRepository();
    vi.spyOn(repository, "getMapFeatures").mockResolvedValue({
      type: "FeatureCollection", truncated: false, limit: 1000,
      features: [{ type: "Feature", id: "11111111-1111-4111-8111-111111111111",
        geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
        properties: { cell_id: fixture.cell_id, valid_date: fixture.valid_date,
          production_id: fixture.production_id, indicator_id: fixture.indicator_id,
          risk_level: "moderate", confidence_level: "low", freshness: "fresh", result: fixture } }],
    });
    const data = await loadShellData(params, repository);
    const html = renderToStaticMarkup(<ProductShell context={parseContext(params)} data={data}
      liveContext={{ mode: "live", bbox: "-5,43,1,49", zoom: "8" }} />);
    expect(html).toContain("/diagnostic?");
    expect(html).toContain("cell=demo-001");
    expect(html).toContain("rule=demo_heat_wheat");
    expect(html).toContain("version=0.1.0");
    expect(html).toContain("mode=live");
    expect(html).not.toContain('data-demo="true"');
  });
});
