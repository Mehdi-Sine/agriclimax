import "server-only";
import {readFileSync,existsSync,statSync} from "node:fs";
import {join} from "node:path";
import {gunzipSync,gzipSync} from "node:zlib";
import {createHash} from "node:crypto";
import {verifyBundle,verifyPublication,publicationPath,mapInfo,type EditionMapBundle,type EditionMapsView,type MapApproval,type MapPublication} from "../../features/edition-maps/model";
import {mapObjectStore,insertExact,type MapObjectStore} from "./immutable-map-storage";
import {verifyConsultable} from "../../features/editorial-ai/consultable";
type Edition={edition_id:string;checksum:string;date:string};
export function mapPreviewEdition(){
  const root=process.env.AGRICLIMAX_MAP_PREVIEW_DIR;
  if(process.env.AGRICLIMAX_MAP_PREVIEW_ENABLED!=="true"||!root)return null;
  const path=join(root,"consultable-edition.json");
  if(!existsSync(path))return null;
  if(statSync(path).size>2*1024**2)throw Error("MAP_PREVIEW_EDITION_BUDGET");
  return verifyConsultable(JSON.parse(readFileSync(path,"utf8")));
}
const digest=(raw:Uint8Array)=>createHash("sha256").update(raw).digest("hex");
const decoded=new Map<string,Promise<EditionMapBundle>>();
export function encodeMapBundle(b:EditionMapBundle){
  verifyBundle(b,{edition_id:b.edition_id,checksum:b.edition_checksum,date:b.edition_date});
  const bytes=gzipSync(JSON.stringify(b));
  if(bytes.length>8*1024**2)throw Error("MAP_BUNDLE_BUDGET");
  const sha256=digest(bytes);
  return {bytes,reference:{path:`edition-maps/blobs/${sha256}.json.gz`,sha256,bytes:bytes.length,content_sha256:b.sha256}};
}
export async function publishMapBundle(bundle:EditionMapBundle,approval:MapApproval,store:MapObjectStore=mapObjectStore){
  const edition={edition_id:bundle.edition_id,checksum:bundle.edition_checksum,date:bundle.edition_date};
  const encoded=encodeMapBundle(bundle);
  const p:MapPublication={version:"edition-map-publication-1",edition_id:edition.edition_id,edition_checksum:edition.checksum,bundle:encoded.reference,approval};
  verifyPublication(p,edition); // validate approval before the first write
  const path=publicationPath(edition),raw=Buffer.from(JSON.stringify(p));
  const prior=await store.read(path,16*1024);
  if(prior&&!Buffer.from(prior).equals(raw))throw Error("MAP_IMMUTABLE_CONFLICT");
  await insertExact(store,p.bundle.path,encoded.bytes); // orphan safe after interruption
  await insertExact(store,path,raw); // visibility is the final atomic insert
  const restored=await readPublishedMaps(edition,store);
  if(restored?.sha256!==bundle.sha256)throw Error("MAP_PUBLICATION_READBACK");
  return p;
}
export async function readPublishedMaps(edition:Edition,store:MapObjectStore=mapObjectStore):Promise<EditionMapBundle|null>{
  const raw=await store.read(publicationPath(edition),16*1024);if(!raw)return null;
  const p=verifyPublication(JSON.parse(Buffer.from(raw).toString()),edition);
  let value=store===mapObjectStore?decoded.get(p.bundle.sha256):undefined;
  if(!value){
    value=(async()=>{
      const bytes=await store.read(p.bundle.path,8*1024**2);
      if(!bytes||bytes.length!==p.bundle.bytes||digest(bytes)!==p.bundle.sha256)throw Error("MAP_BLOB_INTEGRITY");
      return verifyBundle(JSON.parse(gunzipSync(bytes,{maxOutputLength:64*1024**2}).toString()),edition);
    })();
    if(store===mapObjectStore){
      if(decoded.size>=3)decoded.delete(decoded.keys().next().value!);
      decoded.set(p.bundle.sha256,value);void value.catch(()=>decoded.delete(p.bundle.sha256));
    }
  }
  const b=await value;
  if(b.edition_id!==edition.edition_id||b.edition_checksum!==edition.checksum||b.edition_date!==edition.date)throw Error("MAP_BUNDLE_BINDING");
  if(b.sha256!==p.bundle.content_sha256)throw Error("MAP_CONTENT_INTEGRITY");
  return b;
}
export async function editionMaps(edition:Edition):Promise<{view:EditionMapsView;bundle?:EditionMapBundle}>{
  try {
    // Explicit isolated recipe mode. Candidates stay visibly unpublished on both pages/API.
    const root=process.env.AGRICLIMAX_MAP_PREVIEW_DIR;
    if(process.env.AGRICLIMAX_MAP_PREVIEW_ENABLED==="true"&&root){
      publicationPath(edition);
      const path=join(root,`${edition.edition_id}.json`);
      if(existsSync(path)){
        if(statSync(path).size>64*1024**2)throw Error("MAP_PREVIEW_BUDGET");
        const bundle=verifyBundle(JSON.parse(readFileSync(path,"utf8")),edition);
        return {bundle,view:{status:"preview",code:"MAP_REVIEW_REQUIRED",bundle_sha256:bundle.sha256,maps:bundle.maps.map(mapInfo)}};
      }
    }
    // A code deploy does not publish a candidate. Only a reviewed private manifest does.
    if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.SUPABASE_SECRET_KEY)return {view:{status:"absent",code:"MAP_STORAGE_NOT_CONFIGURED",maps:[]}};
    const bundle=await readPublishedMaps(edition);
    return bundle?{bundle,view:{status:"published",code:"MAP_PUBLISHED",bundle_sha256:bundle.sha256,maps:bundle.maps.map(mapInfo)}}:{view:{status:"absent",code:"MAP_NOT_PUBLISHED",maps:[]}};
  } catch {return {view:{status:"error",code:"MAP_ARCHIVE_UNAVAILABLE_OR_INVALID",maps:[]}};}
}
