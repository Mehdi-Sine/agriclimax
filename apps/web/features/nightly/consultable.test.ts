import {beforeEach,describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("../editorial-ai/supabase-store",()=>({editorialRPC:vi.fn().mockRejectedValue(Error("SYNTHETIC_STORE_OUTAGE")),SupabaseEditorialStore:class{}}));
import {editorialRPC} from "../editorial-ai/supabase-store";
import bootstrap from "../../data/editorial/consultable-bootstrap.json";
import {verifyConsultable,consultableEdition,unpackConsultable} from "../editorial-ai/consultable";
import {numericTokens,unsupportedFrenchDate,unqualifiedAssertion} from "../editorial-ai/scientific-language";
import {previewEditions} from "../../lib/server/editorial-preview";
import {sealArchive} from "../editorial-ai/archive";
beforeEach(()=>vi.clearAllMocks());
describe("the existing real archive's public projection",()=>{
 it("retains the real date, words and five recorded alerts, while disclosing no provider or internal metadata",()=>{
  const a=unpackConsultable(bootstrap)[0];
  expect(a.date).toBe("2026-11-09");expect(a.checksum).toBe("e1f6d85baaa74237ff9d94be5b97dd4f2234f4969f2773ecc63e6f4a03cfa4da");
  expect(a.mode).toBe("live");expect(a.validation.status).toBe("rejected");expect(a.validation.errors).toHaveLength(5);
  expect(a.assessment.errors).toEqual([]);expect(a.assessment.review).toContain("SEMANTIC_REVIEW_REQUIRED");
  expect(a.draft.headline.text).toBe("En Grand Est, des températures sous zéro envisagées par la prévision");
  expect(JSON.stringify(a)).not.toMatch(/"(?:receipt|response_id|cost_eur|usage|parameters|diagnostics|horizon_diagnostics|prompt_sha256|identity)"\s*:/);
 });
 it("serves the controlled real copy after a cold-start database outage, without filling missing dates",async()=>{
  vi.resetModules();const {operationalEditions}=await import("../../lib/server/editorial-published");
  const editions=await operationalEditions();expect(editions[0].date).toBe("2026-11-09");expect(editions.find(a=>a.date==="1999-01-01")).toBeUndefined();
  expect(editorialRPC).toHaveBeenCalledWith("runs");
 });
 it("rejects a changed public copy and an incompatible narrative instead of publishing a corrupt edition",()=>{
  const changed=structuredClone(unpackConsultable(bootstrap)[0]);changed.draft.headline.text="changed";
  expect(()=>verifyConsultable(changed)).toThrow("CONSULTABLE_CONTENT_INTEGRITY");
  const {checksum,...body}=previewEditions()[0];void checksum;
  expect(()=>consultableEdition(sealArchive({...body,mode:"live",draft:{...body.draft,bundle_id:"invented"},receipt:{model:body.parameters.model,response_id:"SYNTHETIC_ONLY",usage:null,cost_eur:null,duration_ms:0,pricing_version:"synthetic"}}))).toThrow("INCOMPATIBLE_EDITORIAL_DATA");
 });
});
describe("precise scientific language checks",()=>{
 it("compares calendar components numerically without discarding a negative measurement",()=>{
  expect(numericTokens("2026-11-09, -2,9 °C")).toEqual(["2026","11","9","-2.9"]);
  expect(unsupportedFrenchDate("Du 9 au 15 novembre", "2026-11-09 2026-11-15")).toBe(false);
  expect(unsupportedFrenchDate("Du 9 au 15 décembre", "2026-11-09 2026-11-15")).toBe(true);
  expect(unsupportedFrenchDate("15 novembre 2025", "2026-11-15")).toBe(true);
 });
 it.each([
  ["Ces signaux ne permettent pas d’évaluer des dommages agricoles.",false],
  ["Sans évaluation de dommage agricole.",false],
  ["Le gel provoque des dommages agricoles.",true],
  ["Aucun dommage n’est établi, mais le gel provoque une maladie.",true],
  ["Sans preuve, le gel provoque une maladie.",true],
  ["Le gel ne cause pas de maladie.",false],
  ["Les pluies n’entraînent aucun dommage agricole.",false],
 ] as const)("qualifies only the negated clause: %s",(text,expected)=>{
  expect(unqualifiedAssertion(text,/caus[eé]|provoqu|entra[iî]n|dommages? agricoles?|maladie/i)).toBe(expected);
 });
 it("distinguishes an unsupported observation from a warning that explicitly denies one",()=>{
  expect(unqualifiedAssertion("L’historique ne permet pas d’affirmer une évolution observée récente.",/observ[eé]/i)).toBe(false);
  expect(unqualifiedAssertion("Une évolution observée est confirmée.",/observ[eé]/i)).toBe(true);
 });
});
