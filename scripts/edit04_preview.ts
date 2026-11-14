/** Disposable browser recipe. Writes only work/ and a temporary bootstrap replaced by the runner. */
import {mkdirSync,writeFileSync} from "node:fs";
import {gzipSync} from "node:zlib";
import {createHash} from "node:crypto";
import {DATES,readEdit04Archive} from "./edit04_archives";
import {consultableEdition} from "../apps/web/features/editorial-ai/consultable";
import {hash} from "../apps/web/features/editorial/temporal";
import {buildCatalogue} from "../apps/web/features/editorial-map-selection/catalogue";
import {rankCatalogue} from "../apps/web/features/editorial-map-selection/rank";
import {chooseDaily,mapsDigest,selectedMapIds} from "../apps/web/features/editorial-map-selection/daily";
const out="work/edit-04/preview";mkdirSync(out,{recursive:true});
const editions=DATES.map(date=>{
 const {archive,bundle}=readEdit04Archive(date),edition=consultableEdition(archive),selection=chooseDaily(rankCatalogue(buildCatalogue(archive,bundle),{min_score:45,max_cards:6}),mapsDigest(bundle));
 const {content_sha256,...body}=edition;void content_sha256;
 const projected={...body,map_selection:{hero_map_id:selection.response.hero_map_id,map_ids:selectedMapIds(selection,bundle)}};
 writeFileSync(`${out}/${archive.edition_id}.json`,JSON.stringify(bundle));
 return {...projected,content_sha256:hash(projected)};
});
const bytes=Buffer.from(JSON.stringify(editions));
writeFileSync(`${out}/bootstrap.json`,JSON.stringify({version:"consultable-archive-pack-1",bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex"),content:gzipSync(bytes).toString("base64")}));
console.log(JSON.stringify({dates:DATES,local_only:true,projection_only:true}));
