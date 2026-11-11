import "server-only";
/** Private existing bucket. Inserts only, bounded reads, exact readback on races. */
export interface MapObjectStore {
  read(path:string,limit:number):Promise<Uint8Array|null>;
  insert(path:string,bytes:Uint8Array):Promise<void>;
}
function location(path:string){
  const base=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
  if(!base||!key)throw Error("MAP_STORAGE_NOT_CONFIGURED");
  const url=new URL(base);
  if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash||
    !/^edition-maps\/(?:blobs\/[a-f0-9]{64}\.json\.gz|[a-f0-9]{64}\/[a-f0-9]{64}\/publication\.json)$/.test(path))throw Error("MAP_STORAGE_PATH");
  url.pathname=`/storage/v1/object/pra-climate-archives/${path}`;
  return {url,key};
}
export const mapObjectStore:MapObjectStore={
  async read(path,limit){
    const {url,key}=location(path);
    const r=await fetch(url,{headers:{apikey:key},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(12000)});
    if(r.status===404)return null;
    if(r.status===400){const body:unknown=await r.json();if(body&&typeof body==="object"&&"statusCode" in body&&String(body.statusCode)==="404")return null;}
    if(!r.ok)throw Error("MAP_STORAGE_READ");
    const reader=r.body?.getReader();if(!reader)throw Error("MAP_STORAGE_EMPTY");
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error("MAP_STORAGE_BUDGET");}chunks.push(value);}
    return Buffer.concat(chunks,size);
  },
  async insert(path,bytes){
    const {url,key}=location(path);
    const r=await fetch(url,{method:"POST",headers:{apikey:key,"Content-Type":path.endsWith(".gz")?"application/gzip":"application/json","x-upsert":"false"},body:Buffer.from(bytes),redirect:"error",signal:AbortSignal.timeout(12000)});
    if(!r.ok&&![400,409].includes(r.status))throw Error("MAP_STORAGE_INSERT");
  },
};
export async function insertExact(store:MapObjectStore,path:string,bytes:Uint8Array){
  let old=await store.read(path,8*1024**2);
  if(!old){await store.insert(path,bytes);old=await store.read(path,8*1024**2);}
  if(!old||!Buffer.from(old).equals(Buffer.from(bytes)))throw Error("MAP_IMMUTABLE_CONFLICT");
}
