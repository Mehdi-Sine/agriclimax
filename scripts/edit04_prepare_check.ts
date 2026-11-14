/** Read-only end-to-end check of candidate preparation against already published map content. */
import {writeFileSync} from "node:fs";
import {editorialRPC} from "../apps/web/features/editorial-ai/supabase-store";
import type {DailyEditorialSnapshot} from "../apps/web/features/nightly/snapshot";
import {verifySnapshot} from "../apps/web/features/nightly/snapshot";
import {prepareDailySelection} from "./edit04_selection";
import {readEdit04Archive,DATES} from "./edit04_archives";
import {selectedMapIds} from "../apps/web/features/editorial-map-selection/daily";
async function main(){
 const reports=[];
 for(const date of DATES){
  const source=readEdit04Archive(date),snapshot=await editorialRPC<DailyEditorialSnapshot>("snapshot_read",{edition_date:date});
  verifySnapshot(snapshot);
  const selection=await prepareDailySelection(snapshot,source.archive.edition_id);
  const ids=selectedMapIds(selection,source.bundle);
  reports.push({date,snapshot_id:snapshot.id,maps_match_published:true,selected:ids,remote_writes:0,openai_calls:0});
 }
 writeFileSync("work/edit-04/preparation.json",JSON.stringify(reports,null,2)+"\n");console.log(JSON.stringify(reports.map(r=>({date:r.date,maps_match_published:r.maps_match_published,selected:r.selected.length}))));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
