import {describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {reconciliationPlan,assertNewDailyTrial,type ReconciliationEvidence} from "../editorial-ai/reconciliation";
import type {Run} from "../editorial-ai/archive";
const run:Run={id:"a".repeat(64),edition_date:"2026-11-09",month:"2026-11",scope:"daily",state:"outcome_unknown",reserved_eur:.094549,actual_eur:null,error:"PROVIDER_HTTP_400",archive_id:"a".repeat(64)};
const proof:ReconciliationEvidence={run_id:run.id,verified_by:"Synthetic local owner",source_reference:"OpenAI isolated synthetic rejection record",evidence_sha256:"b".repeat(64),finding:"rejected_without_usage",actual_eur:0,input_tokens:0,output_tokens:0,response_id:null};
describe("owner reconciliation proposal, never an automatic write",()=>{
 it("retains identity, reservation and archive; proposes a transactional audit with stale-row guard",()=>{
  const plan=reconciliationPlan(run,proof);
  expect(run.state).toBe("outcome_unknown");expect(run.actual_eur).toBeNull();
  expect(plan.after).toEqual({...run,state:"validation_failed",actual_eur:0});
  expect(plan.sql).toContain("RECONCILIATION_STALE_LEDGER");expect(plan.sql).toContain("pg_advisory_xact_lock(360035)");
  expect(plan.sql).toContain("owner_financial_reconciliation");expect(plan.sql).not.toMatch(/delete|truncate|set ai_enabled=true/i);
 });
 it("rejects incomplete evidence, inconsistent zero consumption and unbounded cost",()=>{
  expect(()=>reconciliationPlan(run,{...proof,evidence_sha256:""})).toThrow("VERIFIABLE_OWNER_EVIDENCE_REQUIRED");
  expect(()=>reconciliationPlan(run,{...proof,input_tokens:1})).toThrow("NO_USAGE_EVIDENCE_MISMATCH");
  expect(()=>reconciliationPlan(run,{...proof,actual_eur:.16})).toThrow("RECONCILIATION_AMOUNT_OR_USAGE_INVALID");
  expect(()=>reconciliationPlan({...run,state:"completed"},proof)).toThrow("RECONCILIATION_RUN_MISMATCH");
 });
 it("keeps same-day uniqueness after reconciliation and blocks unresolved outcomes globally",()=>{
  expect(()=>assertNewDailyTrial([run],"2026-11-10")).toThrow("UNRECONCILED_GENERATION");
  const reconciled=reconciliationPlan(run,proof).after as Run;
  expect(()=>assertNewDailyTrial([reconciled],"2026-11-09")).toThrow("DAILY_EDITION_ALREADY_ATTEMPTED");
  expect(()=>assertNewDailyTrial([reconciled],"2026-11-10")).not.toThrow();
 });
});
