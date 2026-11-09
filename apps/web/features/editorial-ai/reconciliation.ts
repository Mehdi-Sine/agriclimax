import "server-only";
import type {Run} from "./archive";
import {sha256} from "./request-audit";

export interface ReconciliationEvidence {
  run_id:string;
  verified_by:string;
  source_reference:string;
  evidence_sha256:string;
  finding:"rejected_without_usage"|"consumption_confirmed";
  actual_eur:number;
  input_tokens:number;
  output_tokens:number;
  response_id:string|null;
}
/** A proposal only. The owner must verify attribution and amounts against the private source. */
export function reconciliationPlan(run:Run,e:ReconciliationEvidence) {
  if(run.state!=="outcome_unknown" || run.error!=="PROVIDER_HTTP_400" || run.actual_eur!==null || run.scope!=="daily" || !run.edition_date || e.run_id!==run.id) throw Error("RECONCILIATION_RUN_MISMATCH");
  if(!/^[a-f0-9]{64}$/.test(run.id) || !/^\d{4}-\d{2}-\d{2}$/.test(run.edition_date) || !/^[a-f0-9]{64}$/.test(e.evidence_sha256) || e.verified_by.trim().length<3 || e.source_reference.trim().length<8 || e.verified_by.length>100 || e.source_reference.length>500) throw Error("VERIFIABLE_OWNER_EVIDENCE_REQUIRED");
  if(!Number.isFinite(e.actual_eur) || e.actual_eur<0 || e.actual_eur>run.reserved_eur || ![e.input_tokens,e.output_tokens].every(n=>Number.isSafeInteger(n)&&n>=0)) throw Error("RECONCILIATION_AMOUNT_OR_USAGE_INVALID");
  if(e.finding==="rejected_without_usage") {
    if(e.actual_eur!==0 || e.input_tokens!==0 || e.output_tokens!==0 || e.response_id!==null) throw Error("NO_USAGE_EVIDENCE_MISMATCH");
  } else if(e.finding!=="consumption_confirmed" || e.actual_eur<=0 || e.input_tokens+e.output_tokens===0 || typeof e.response_id!=="string" || !/^resp_[a-zA-Z0-9_-]{1,160}$/.test(e.response_id)) throw Error("CONSUMPTION_RECEIPT_REQUIRED");
  const after={...run,state:"validation_failed",actual_eur:e.actual_eur};
  const audit={kind:"owner_financial_reconciliation",run_id:run.id,evidence:e,before:run,after};
  const json=(v:unknown)=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb";
  const body=`
declare previous jsonb; next_run jsonb := ${json(after)};
begin
 perform pg_catalog.pg_advisory_xact_lock(360035);
 if exists(select 1 from agriclimax_private.editorial_control where acquisition_enabled or ai_enabled or publication_enabled)
 then raise exception 'RECONCILIATION_REQUIRES_ALL_CONTROLS_OFF'; end if;
 select body into previous from agriclimax_private.editorial_runs where id='${run.id}' for update;
 if previous is distinct from ${json(run)} then raise exception 'RECONCILIATION_STALE_LEDGER'; end if;
 insert into agriclimax_private.editorial_diagnostics(id,edition_date,body)
 values('${sha256(JSON.stringify(audit))}', '${run.edition_date}', ${json(audit)});
 update agriclimax_private.editorial_runs
 set state='validation_failed',actual_eur=${e.actual_eur},body=next_run,updated_at=now()
 where id='${run.id}';
end`;
  const tag=`$t36_${sha256(body).slice(0,24)}$`;
  if(body.includes(tag)) throw Error("RECONCILIATION_SQL_DELIMITER");
  return {before:run,after,sql:`-- OWNER REVIEW REQUIRED: attribution, usage, EUR conversion and evidence SHA must be independently verified.\n-- No deletion, no new run, no uniqueness change, no activation. Archive and reservation are retained.\nbegin;\ndo ${tag}${body}${tag};\nselect id,edition_date,state,reserved_eur,actual_eur from agriclimax_private.editorial_runs where id='${run.id}';\ncommit;\n`};
}

export function assertNewDailyTrial(runs:Run[],date:string) {
  if(runs.some(r=>["reserved","running","outcome_unknown"].includes(r.state))) throw Error("UNRECONCILED_GENERATION");
  if(runs.some(r=>r.edition_date===date)) throw Error("DAILY_EDITION_ALREADY_ATTEMPTED");
}
