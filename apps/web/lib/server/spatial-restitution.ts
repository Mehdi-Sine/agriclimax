import 'server-only';
import {gunzipSync} from 'node:zlib';
import {currentManifest,archiveCatalogue,archiveBlob} from './weather-archives';
import {record} from './weather-archive-codec';
import source from '../../data/operational/era5-spatial-support.json';
import type {FeatureCollection,Geometry} from 'geojson';
import type {PraProperties} from '../../features/national/map';
import type {TerritorialValue} from '../../features/unified/model';

type PartialRow={pra_id:string;coverage:number;observed_value:number|null;value:number|null;support_id:string|null;temporal_coverage:number;rule_version:string;quality_flags:string[]};
type SupportData= {rule_version:string;dates:string[];geometries:Record<string,FeatureCollection<Geometry,PraProperties>['features'][number]>;days:Record<string,Record<string,PartialRow[]>>};
const baseline=source as unknown as SupportData;
let cached:{sha:string;data:Promise<SupportData>}|undefined;
let geometryCache:{sha:string;geometries:SupportData['geometries']}|undefined;
async function load(date:string):Promise<SupportData>{
 if(baseline.dates.includes(date))return baseline;
 const current=await currentManifest();const e=current?.supports?.find(e=>e.dates.includes(date))??(await archiveCatalogue())?.supports?.find(e=>e.dates.includes(date));if(!e)return baseline;
 if(cached?.sha===e.sha256)return cached.data;
 const data=(async()=>{const value:unknown=JSON.parse(gunzipSync(await archiveBlob(e),{maxOutputLength:16*1024**2}).toString());if(!record(value)||value.rule_version!==baseline.rule_version||!Array.isArray(value.dates)||!value.dates.includes(date)||!record(value.days)||!record(value.geometry_entry))throw new Error('SPATIAL_SUPPORT_CONTRACT');
 const g=value.geometry_entry;if(typeof g.path!=='string'||!/^support\/[a-f0-9]{64}\.json\.gz$/.test(g.path)||typeof g.sha256!=='string'||!g.path.includes(g.sha256)||typeof g.bytes!=='number')throw new Error('SPATIAL_GEOMETRY_ENTRY');
 if(geometryCache?.sha!==g.sha256){const geo:unknown=JSON.parse(gunzipSync(await archiveBlob({path:g.path,sha256:g.sha256,bytes:g.bytes,dates:[]}),{maxOutputLength:16*1024**2}).toString());if(!record(geo)||!record(geo.geometries)||geo.rule_version!==baseline.rule_version)throw new Error('SPATIAL_GEOMETRY');geometryCache={sha:g.sha256,geometries:geo.geometries as SupportData['geometries']};}
 return {...value,geometries:geometryCache.geometries} as SupportData;})();cached={sha:e.sha256,data};void data.catch(()=>{if(cached?.data===data)cached=undefined;});return data;
}
export function spatialRows(data:SupportData,date:string,variable:string):PartialRow[]{return data.days[date]?.[variable]??[];}
export function supportCollection(data:SupportData,date:string,variable:string):FeatureCollection<Geometry,PraProperties>{
 return {type:'FeatureCollection',features:spatialRows(data,date,variable).flatMap(r=>r.support_id&&data.geometries[r.support_id]?[data.geometries[r.support_id]]:[])};
}
export async function qualifySpatial(rows:TerritorialValue[],date:string,variable:string):Promise<TerritorialValue[]>{
 const data=await load(date);
 const partial=new Map(spatialRows(data,date,variable).map(r=>[r.pra_id,r]));
 return rows.map(row=>{
  const p=partial.get(row.territoryId);if(!p||row.value!==null||row.coverage===null||Math.abs(row.coverage-p.coverage)>0.00001)return row;
  // Keep the former strict value separately; never manufacture compatible normals/anomalies.
  return {...row,value:p.value,normal:null,anomaly:null,observed_value:p.observed_value,coverage:p.coverage,rule_version:p.rule_version,provenance:'ERA5-Land · verified native daily support',quality_flags:[...row.quality_flags,...p.quality_flags],status:p.coverage>0?'partial':'unavailable'};
 });
}
export function validSupportQuery(params:URLSearchParams):boolean{return [...params.keys()].every(k=>['date','variable'].includes(k)&&params.getAll(k).length===1)&&!!params.get('date')&&!!params.get('variable');}
export async function supportDocument(date:string,variable:string){const data=await load(date);const rows=spatialRows(data,date,variable);return {rule_version:data.rule_version,verified:data.dates.includes(date)&&['temperature','precipitation'].includes(variable),date,variable,rows,collection:supportCollection(data,date,variable)};}
// Keep this module strictly server-only; its 2.6 MB native-mask evidence never enters JS bundles.
