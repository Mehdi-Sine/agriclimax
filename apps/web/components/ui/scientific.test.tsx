import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DATA_STATES,
  DataState,
  RiskBadge,
  ConfidenceBadge,
  Metric,
  IndicatorSparkline,
} from "./scientific";

describe("scientific presentation boundaries", () => {
  it("keeps missing, no-risk, insufficient and stale as distinct explicit states", () => {
    const labels = Object.values(DATA_STATES).map(([label]) => label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(renderToStaticMarkup(<DataState state="missing" />)).toContain(
      "Données absentes",
    );
    expect(renderToStaticMarkup(<DataState state="no-risk" />)).toContain(
      "Risque non identifié",
    );
    expect(renderToStaticMarkup(<DataState state="demo" />)).toContain(
      'data-demo="true"',
    );
    expect(renderToStaticMarkup(<DataState state="source-error" />)).toContain(
      'role="alert"',
    );
  });
  it("labels risk and confidence independently, without a color-only result", () => {
    expect(renderToStaticMarkup(<RiskBadge level="critical" />)).toContain(
      "Critique",
    );
    expect(renderToStaticMarkup(<ConfidenceBadge level="low" />)).toContain(
      "Confiance : faible",
    );
  });
  it("preserves zero and renders unavailable numbers without inventing a value", () => {
    expect(
      renderToStaticMarkup(<Metric label="Aléa" value={0} unit="d" />),
    ).toContain("0");
    expect(
      renderToStaticMarkup(<Metric label="Aléa" value={null} unit="d" />),
    ).toContain("—");
    expect(
      renderToStaticMarkup(<IndicatorSparkline values={[Number.NaN, 2]} />),
    ).toContain("Données insuffisantes");
  });
});
