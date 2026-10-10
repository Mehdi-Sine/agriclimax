import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { loadShellData } from "./load-shell-data";
import { ProductShell } from "./product-shell";
import { SupabaseRiskRepository } from "../../lib/server/supabase-risk-repository";
import { parseContext } from "../../lib/url-state";
import { liveMapSummary } from "../../lib/shell-data";

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
    expect(markup).toContain("demo-fiction");
  });
  it("renders an empty validated live response without inventing a risk or demo signal", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret-sentinel");
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
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
  it("only summarizes populated live data pending Task 06, without reclassifying it", () => {
    expect(liveMapSummary(2)).toEqual({
      mode: "live",
      state: "available",
      count: 2,
    });
    const markup = renderToStaticMarkup(
      <ProductShell context={parseContext(params)} data={liveMapSummary(2)} />,
    );
    expect(markup).toContain("Données live disponibles");
    expect(markup).not.toContain("demo-fiction");
    expect(markup).not.toContain("Risque :");
  });
});
