import type {DailyEditorialSnapshot} from "../apps/web/features/nightly/snapshot";
import {fallbackDraft} from "../apps/web/features/editorial-ai/fallback";
import {sealArchive} from "../apps/web/features/editorial-ai/archive";
import {validateDraft} from "../apps/web/features/editorial-ai/validate";
import {ENGINE,PROMPT_VERSION,CONFIG_VERSION} from "../apps/web/features/editorial-ai/model";
import {hash} from "../apps/web/features/editorial/temporal";
import {buildEditionMaps} from "./int01_map_builder";
import {readFrozenMapInputs} from "./edit04_frozen";
import {buildCatalogue} from "../apps/web/features/editorial-map-selection/catalogue";
import {rankCatalogue} from "../apps/web/features/editorial-map-selection/rank";
import {chooseDaily,mapsDigest} from "../apps/web/features/editorial-map-selection/daily";
/** Exact same frozen input reader and builder as publication. No acquisition, provider or write. */
export async function prepareDailySelection(snapshot:DailyEditorialSnapshot,id:string){
 const b=snapshot.briefing;if(!b)throw Error("EDIT04_BRIEFING_REQUIRED");
 const draft=fallbackDraft(b),validation=validateDraft(draft,b);
 const seed=sealArchive({version:"editorial-archive-1",edition_id:id,revision:1,supersedes:null,date:b.edition_date,generated_at:snapshot.frozen_at,
 engine:ENGINE,prompt_version:PROMPT_VERSION,config_version:CONFIG_VERSION,mode:"fallback",status:validation.status,draft,briefing:b,illustrations:[],validation,receipt:null,
 prompt_sha256:hash("edit04-candidate-seed"),parameters:{model:"candidate-only",max_output_tokens:1}});
 const {inputs}=await readFrozenMapInputs(snapshot),bundle=buildEditionMaps(seed,snapshot,inputs);
 const ranking=rankCatalogue(buildCatalogue(seed,bundle),{min_score:45,max_cards:6});
 return chooseDaily(ranking,mapsDigest(bundle));
}
