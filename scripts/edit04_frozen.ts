import type {FrozenHistoricalCartography} from "../apps/web/lib/server/historical-cartography";
import {gunzipSync} from "node:zlib";
import {createHash} from "node:crypto";
import type {DailyEditorialSnapshot} from "../apps/web/features/nightly/snapshot";
import type {ArchivedDaily,NationalWeatherDocument} from "../apps/web/lib/server/weather-archives";
import {archivedEra5Day,pinnedNationalWeatherDocument} from "../apps/web/lib/server/weather-archives";
import {record} from "../apps/web/lib/server/weather-archive-codec";
import {shift} from "../apps/web/features/editorial/temporal";
import {FROZEN_INPUT_COMPRESSED_LIMIT,FROZEN_INPUT_DECODED_LIMIT} from "../apps/web/features/nightly/immutable-inputs";
import {FROZEN_SOURCE_VERSION,frozenSourcePins} from "../apps/web/features/nightly/frozen-source-pins";

type FrozenMapInputs={history:ArchivedDaily[];document:NationalWeatherDocument|null;historical_cartography?:FrozenHistoricalCartography};

/** Legacy inline inputs remain readable. Source pins restore only the map's historical window. */
export async function decodeFrozenMapInputs(bytes:Uint8Array,snapshot:DailyEditorialSnapshot):Promise<FrozenMapInputs>{
  const value:unknown=JSON.parse(gunzipSync(bytes,{maxOutputLength:FROZEN_INPUT_DECODED_LIMIT}).toString());
  if(!record(value))throw Error("MAP_FROZEN_INPUT_CONTRACT");
  if(!Object.hasOwn(value,"version")){
    if(!Array.isArray(value.history)||!(value.document===null||record(value.document)))throw Error("MAP_FROZEN_INPUT_CONTRACT");
    return value as FrozenMapInputs;
  }
  const end=snapshot.briefing?.validity.history_cutoff;
  if(value.version!==FROZEN_SOURCE_VERSION||!end)throw Error("MAP_FROZEN_INPUT_CONTRACT");
  const pins=frozenSourcePins(value.sources,end);
  if(pins.weather&&!snapshot.sources.some(source=>source.archive.sha256===pins.weather?.sha256&&source.archive.path===pins.weather.path))
    throw Error("MAP_FORECAST_SOURCE_BINDING");
  const start=shift(end,-6);
  const days=pins.era5.flatMap(pin=>pin.dates.filter(day=>day>=start).map(day=>({day,archive:pin.archive})))
    .sort((a,b)=>a.day.localeCompare(b.day));
  const history:ArchivedDaily[]=[];
  for(const {day,archive} of days){
    const rows=await archivedEra5Day(day,archive);
    if(!rows||rows.some(row=>Date.parse(row.computed_at)>Date.parse(snapshot.input_cutoff_at??snapshot.cutoff_at)))
      throw Error("MAP_ERA5_SOURCE_BINDING");
    history.push(...rows);
  }
  return {history,document:pins.weather?await pinnedNationalWeatherDocument(pins.weather):null,
    ...(value.historical_cartography?{historical_cartography:value.historical_cartography as FrozenHistoricalCartography}:{})};
}

export async function readFrozenMapInputs(snapshot:DailyEditorialSnapshot){
  if(!snapshot.input_archive)throw Error("MAP_FROZEN_INPUTS_MISSING");
  const entry=snapshot.input_archive;
  if(!/^[a-f0-9]{64}$/.test(entry.sha256)||entry.path!==`editorial-inputs/${entry.sha256}.json.gz`||
     !Number.isSafeInteger(entry.bytes)||entry.bytes<=0||entry.bytes>FROZEN_INPUT_COMPRESSED_LIMIT)throw Error("MAP_INPUT_PATH");
  const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  url.pathname=`/storage/v1/object/pra-climate-archives/${entry.path}`;
  const r=await fetch(url,{headers:{apikey:process.env.SUPABASE_SECRET_KEY!},redirect:"error",cache:"no-store",signal:AbortSignal.timeout(30000)});
  if(!r.ok||!r.body)throw Error("MAP_INPUT_READ");
  const reader=r.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>entry.bytes){await reader.cancel();throw Error("MAP_INPUT_BUDGET");}chunks.push(value);}
  const bytes=Buffer.concat(chunks,size);
  if(bytes.length!==entry.bytes||createHash("sha256").update(bytes).digest("hex")!==entry.sha256)throw Error("MAP_INPUT_CHECKSUM");
  const inputs=await decodeFrozenMapInputs(bytes,snapshot);
  return {inputs,bytes};
}
