import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import forecast from "../../../../docs/codex/task35/evidence/forecast-edition.json";
import type { Archive, EditorialDraft } from "./model";
import { validateDraft } from "./validate";
import { revalidateArchive } from "./revalidate";
import { sealArchive } from "./archive";

// Public pre-existing simulation, never a copy of the private November 12 archive.
const fixture = forecast as unknown as Archive;
const errors = ["UNPROVEN_AGRONOMY", "FORECAST_AS_OBSERVATION"];
function draft(text: string): EditorialDraft {
  const result = structuredClone(fixture.draft);
  result.decision.text = text;
  return result;
}
const rejected = () => draft("Les propositions restent exploratoires ; elles ne documentent ni évolution observée ni dommage agricole.");
const separated = () => draft("Les modèles prévoient ces signaux. Les données de terrain et les évaluations agronomiques sont absentes du dossier. Une revue éditoriale reste nécessaire.");

describe("EDIT-01 — deidentified reproduction on the public forecast fixture", () => {
  it("starts from qualified public forecast evidence", () => {
    expect(validateDraft(fixture.draft, fixture.briefing, fixture.illustrations).errors).toEqual([]);
    expect(fixture.briefing.candidates.some(c => c.nature === "forecast" && c.evidence_ids.some(id => fixture.draft.decision.evidence_ids.includes(id)))).toBe(true);
  });

  it("reproduces both lexical failures on the coordinated negation", () => {
    expect(validateDraft(rejected(), fixture.briefing, fixture.illustrations).errors).toEqual(errors);
  });

  it.each([
    ["Elles ne documentent ni dommage agricole ni causalité.", "UNPROVEN_AGRONOMY"],
    ["Elles ne documentent ni évolution observée ni mesure de terrain.", "FORECAST_AS_OBSERVATION"],
  ])("isolates each negation failure: %s", (text, code) => {
    expect(validateDraft(draft(text), fixture.briefing, fixture.illustrations).errors).toContain(code);
  });

  it("admits explicit evidence boundaries with human review, without changing the fixture", () => {
    const before = JSON.stringify(fixture);
    expect(validateDraft(separated(), fixture.briefing, fixture.illustrations)).toEqual({
      status: "needs_editorial_review", errors: [], review: ["SEMANTIC_REVIEW_REQUIRED"],
    });
    expect(JSON.stringify(fixture)).toBe(before);
  });

  it.each([
    ["Les pluies provoquent des dommages agricoles.", "UNPROVEN_AGRONOMY"],
    ["Les pluies pourraient provoquer des dommages agricoles.", "UNPROVEN_AGRONOMY"],
    ["La pluie a été mesurée.", "FORECAST_AS_OBSERVATION"],
    ["Un gel observé.", "FORECAST_AS_OBSERVATION"],
    ["Aucun dommage agricole évalué ; mais la pluie provoque une perte de rendement.", "UNPROVEN_AGRONOMY"],
    ["Prévisions issues des modèles ; mais un gel observé.", "FORECAST_AS_OBSERVATION"],
  ])("continues rejecting unsupported claims: %s", (text, code) => {
    expect(validateDraft(draft(text), fixture.briefing, fixture.illustrations).errors).toContain(code);
  });

  it("refuses a revalidation revision of the same rejected prose", () => {
    const { checksum, ...body } = structuredClone(fixture);
    void checksum;
    const original = sealArchive({ ...body, mode: "live", draft: rejected(), status: "rejected",
      validation: validateDraft(rejected(), fixture.briefing, fixture.illustrations),
      receipt: { model: fixture.parameters.model, response_id: "resp_synthetic_edit01", usage: null, cost_eur: null, duration_ms: 0, pricing_version: "synthetic" } });
    expect(() => revalidateArchive(original, original.checksum)).toThrow("REVALIDATION_REJECTED");
  });
});
