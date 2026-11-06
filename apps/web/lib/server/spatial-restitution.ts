import 'server-only';
import source from '../../data/operational/era5-spatial-support.json';
import type {FeatureCollection,Geometry} from 'geojson';
import type {PraProperties} from '../../features/national/map';
import type {TerritorialValue} from '../../features/unified/model';

type PartialRow={pra_id:string;coverage:number;observed_value:number|null;value:number|null;support_id:string|null;temporal_coverage:number;rule_version:string;quality_flags:string[]};
const data=source as unknown as {rule_version:string;dates:string[];geometries:Record<string,FeatureCollection<Geometry,PraProperties>['features'][number]>;days:Record<string,Record<string,PartialRow[]>>};
export function spatialRows(date:string,variable:string):PartialRow[]{return data.days[date]?.[variable]??[];}
export function supportCollection(date:string,variable:string):FeatureCollection<Geometry,PraProperties>{
 return {type:'FeatureCollection',features:spatialRows(date,variable).flatMap(r=>r.support_id&&data.geometries[r.support_id]?[data.geometries[r.support_id]]:[])};
}
export function qualifySpatial(rows:TerritorialValue[],date:string,variable:string):TerritorialValue[]{
 const partial=new Map(spatialRows(date,variable).map(r=>[r.pra_id,r]));
 return rows.map(row=>{
  const p=partial.get(row.territoryId);if(!p||row.value!==null||row.coverage===null||Math.abs(row.coverage-p.coverage)>0.00001)return row;
  // Keep the former strict value separately; never manufacture compatible normals/anomalies.
  return {...row,value:p.value,normal:null,anomaly:null,observed_value:p.observed_value,coverage:p.coverage,rule_version:p.rule_version,provenance:'ERA5-Land · verified native daily support',quality_flags:[...row.quality_flags,...p.quality_flags],status:p.coverage>0?'partial':'unavailable'};
 });
}
export function validSupportQuery(params:URLSearchParams):boolean{return [...params.keys()].every(k=>['date','variable'].includes(k)&&params.getAll(k).length===1)&&!!params.get('date')&&!!params.get('variable');}
export function supportDocument(date:string,variable:string){const rows=spatialRows(date,variable);return {rule_version:data.rule_version,verified:data.dates.includes(date)&&['temperature','precipitation'].includes(variable),date,variable,rows,collection:supportCollection(date,variable)};}
// Keep this module strictly server-only; its 2.6 MB native-mask evidence never enters JS bundles.
