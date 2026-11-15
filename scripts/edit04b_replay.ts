/** Offline archival replay. Does not import a provider or remote storage writer. */
import {mkdirSync,writeFileSync} from "node:fs";
import {readNovember15} from "./edit04b_archives";
import {readEdit04Archive} from "./edit04_archives";
import {validateDraft} from "../apps/web/features/editorial-ai/validate";
import {chooseDaily,mapsDigest,selectedMapIds} from "../apps/web/features/editorial-map-selection/daily";
import {rankCatalogue} from "../apps/web/features/editorial-map-selection/rank";
import {buildCatalogue} from "../apps/web/features/editorial-map-selection/catalogue";
import {journalMapCards} from "../apps/web/features/edition-maps/carousel-model";
import {mapInfo} from "../apps/web/features/edition-maps/model";
import {hash} from "../apps/web/features/editorial/temporal";
const source15=readNovember15();
const rows=[readEdit04Archive("2026-11-13"),readEdit04Archive("2026-11-14"),source15].map(source=>{
 const before=hash(source),{archive,bundle}=source;
 const selection=chooseDaily(rankCatalogue(buildCatalogue(archive,bundle),{min_score:45,max_cards:6}),mapsDigest(bundle));
 const ids=selectedMapIds(selection,bundle);
 const old=archive.map_selection?[...archive.map_selection.response.priority,...archive.map_selection.response.complementary].map(c=>c.map_id):bundle.maps.map(m=>m.id);
 const cards=journalMapCards({status:"published",code:"MAP_PUBLISHED",maps:bundle.maps.map(mapInfo)},archive.edition_id,archive.date,{hero_map_id:selection.response.hero_map_id,map_ids:ids});
 return {date:archive.date,archive_checksum:archive.checksum,bundle_sha256:bundle.sha256,validation:validateDraft(archive.draft,archive.briefing),
  comparison:bundle.maps.map(m=>({id:m.id,indicator:m.indicator,nature:m.nature,period:m.period,before_order:old.includes(m.id)?old.indexOf(m.id)+1:null,after_deterministic_order:ids.includes(m.id)?ids.indexOf(m.id)+1:null})),
  carousel:cards.map(c=>({id:c.map_id,role:c.role,period:c.info.period,thumbnail:c.thumbnail_url,link:c.interactive_url})),immutable:hash(source)===before};
});
const out="docs/codex/EDIT-04B/evidence";mkdirSync(out,{recursive:true});
writeFileSync(`${out}/replay.json`,JSON.stringify({rows,rejected15:{before:source15.rejected.validation,after:validateDraft(source15.rejected.draft,source15.rejected.briefing)},remote_writes:0,openai_calls:0,publication_calls:0},null,2)+"\n");
console.log(JSON.stringify(rows.map(r=>({date:r.date,before:r.comparison.filter(c=>c.before_order).length,after:r.carousel.length,immutable:r.immutable}))));
