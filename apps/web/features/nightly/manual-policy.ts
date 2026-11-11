import {verifySnapshot} from "./snapshot";
import {hash} from "../editorial/temporal";
import {parisDate} from "../editorial/almanac";
export interface ManualOptions {
 edition_date:string; mode:"dry-run"|"resume"|"publish"; refresh_sources:boolean; recompute_indicators:boolean;
 reuse_ai:boolean; force_ai_regeneration:boolean; authorized_snapshot:string; regeneration_reason:string;
}
export function manualOptions(input:Record<string,string|undefined>,now=new Date().toISOString()):ManualOptions {
 const boolean=(key:string,fallback=false)=>{const v=input[key];if(v===undefined||v==="")return fallback;if(!["true","false"].includes(v))throw Error("INVALID_MANUAL_BOOLEAN");return v==="true";};
 const date=input.edition_date||parisDate(now),mode=input.mode||"dry-run";
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>parisDate(now))throw Error("INVALID_EDITION_DATE");
 if(!["dry-run","resume","publish"].includes(mode))throw Error("INVALID_MANUAL_MODE");
 const options:ManualOptions={edition_date:date,mode:mode as ManualOptions["mode"],refresh_sources:boolean("refresh_sources"),recompute_indicators:boolean("recompute_indicators"),reuse_ai:boolean("reuse_ai",true),force_ai_regeneration:boolean("force_ai_regeneration"),authorized_snapshot:input.authorized_snapshot||"",regeneration_reason:input.regeneration_reason||""};
 if(options.force_ai_regeneration&&(options.mode==="dry-run"||!/^([a-f0-9]{64})$/.test(options.authorized_snapshot)||options.regeneration_reason.trim().length<12))throw Error("EXPLICIT_AI_REGENERATION_AUTHORIZATION_REQUIRED");
 return options;
}
export function generationDecision(o:ManualOptions,state:{snapshot_id:string;compatible_ai:boolean;published:boolean;quality:string}) {
 if(o.force_ai_regeneration&&o.authorized_snapshot!==state.snapshot_id)throw Error("EXACT_SNAPSHOT_AUTHORIZATION_REQUIRED");
 if(state.published)return "preserve_published";
 if(o.mode==="dry-run")return o.reuse_ai&&state.compatible_ai?"reuse":"deterministic_preview";
 if(state.quality==="insufficient")return "insufficient_data";
 if(state.compatible_ai)return o.reuse_ai?"reuse":"compatible_generation_preserved";
 if(o.force_ai_regeneration&&o.authorized_snapshot!==state.snapshot_id)throw Error("EXACT_SNAPSHOT_AUTHORIZATION_REQUIRED");
 return "resume_missing_generation";
}

/** Only a qualified, after-cutoff dossier may become a new production snapshot. */
export function productionSnapshot(test:import('./snapshot').DailyEditorialSnapshot,inputArchive:NonNullable<import('./snapshot').DailyEditorialSnapshot['input_archive']>) {
 verifySnapshot(test,true);
 if(test.quality==='insufficient'||!test.briefing)throw Error('QUALIFIED_SNAPSHOT_REQUIRED');
 if(Date.parse(test.frozen_at)<Date.parse(test.cutoff_at))throw Error('FREEZE_BEFORE_CUTOFF');
 const {id,test_only,...body}=test;void id;void test_only;
 const result={...body,input_archive:inputArchive,id:''};const {id:unused,...content}=result;void unused;result.id=hash(content);verifySnapshot(result);return result;
}
