import 'server-only';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import type {EditionMap} from '../../features/edition-maps/model';
import {RECIPES} from '../../features/multiproduction/registry';
import {forecastProvider} from '../../features/multiproduction/archives';
import {forecastWheatInputs} from './wheat';
import {nationalWeatherDocument,forecastMaskObject} from './weather-archives';
import {forecastRecipeMasks} from './forecast-composites';
import {calculateQualified} from '../../features/climate-quality/calculate';
import {qualifyCoverage,type CoverageQuality} from '../../features/climate-quality/policy';
import {calendarDays} from '../../features/national/daily-availability';
import {FORECAST_MASK_VERSION} from '../../features/cartography/forecast-support';
import type {PraCollection} from '../../features/national/map';
import geography from '../../data/operational/pra-watch-places.json';

export interface EditionForecastRendering {qualities:Record<string,CoverageQuality>;collection:PraCollection}
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Rendering attachment only. Signed bundles and published editions stay immutable.
 * The full original captured-input hash must match before any forecast is reused.
 */
export async function editionForecastRendering(map:EditionMap,state:string):Promise<EditionForecastRendering|undefined>{
  if(state!=='preview'||map.nature!=='forecast'||process.env.COUV05_RENDER_ENABLED!=='true')return undefined;
  const unknown:EditionForecastRendering={collection:{type:'FeatureCollection',features:[]},qualities:{}};
  for(const row of map.rows)unknown.qualities[row.territoryId]=qualifyCoverage(row.value??row.observed_value??null,'specific',{
    fraction:null,support_id:null,mask:'unknown',represented_area_m2:null,expected_days:calendarDays(...map.period).length,
    available_days:0,continuous:false,homogeneous:false,method:'',estimate_certificate:null,reference_compatible:false});
  try{
    const pin=process.env.COUV05_INDEX_SHA256;
    if(!pin||!/^[a-f0-9]{64}$/.test(pin))return unknown;
    const raw=await forecastMaskObject(`forecast-masks/indexes/${pin}.json.gz`,1024**2);
    if(!raw||createHash('sha256').update(raw).digest('hex')!==pin)return unknown;
    const index:unknown=JSON.parse(gunzipSync(raw,{maxOutputLength:8*1024**2}).toString());
    if(!index||typeof index!=='object'||!('version' in index)||index.version!==FORECAST_MASK_VERSION||!('archive_sha256' in index)||typeof index.archive_sha256!=='string'||!/^[a-f0-9]{64}$/.test(index.archive_sha256))return unknown;
    const document=await nationalWeatherDocument(undefined,index.archive_sha256);
    if(!document)return unknown;
    const provider=forecastProvider(document,map.period);
    const captured=Object.fromEntries([...new Set(RECIPES.map(r=>r.kernel.variables.join()))].map(key=>[key,Object.fromEntries(geography.places.map(p=>[p.id,provider(p.id,key.split(',') as Parameters<typeof provider>[1])]))]));
    if(hash(captured)!==map.input_sha256)return unknown;
    const recipe=RECIPES.find(r=>r.id===map.indicator);
    if(!recipe)return unknown;
    const rule=recipe.kernel, days=calendarDays(...map.period);
    const rows=document.selected_indices.map(i=>document.rows[i]).filter(r=>days.includes(r.valid_date)&&rule.variables.includes(r.variable));
    const spatial=await forecastRecipeMasks(rows,document.archive_sha256,rule,...map.period,rule.threshold);
    if(!spatial)return unknown;
    const inputs=forecastWheatInputs(document,rule,days);
    const accepted=new Set<string>();
    for(const original of map.rows){
      const support=spatial.supports.get(original.territoryId);
      const retained=spatial.qualified?.get(original.territoryId);
      if(!support&&!retained)continue;
      const result=retained??calculateQualified(original.territoryId,(inputs[original.territoryId]??[]).map(r=>({...r,climate_support:support})),...map.period,rule,rule.threshold);
      // An attachment cannot silently replace or numerically change an archived result.
      if(result.quality?.indicator_eligible && (result.value??result.observed_value??null)===(original.value??original.observed_value??null)){
        unknown.qualities[original.territoryId]=result.quality;accepted.add(original.territoryId);
      }
    }
    unknown.collection={...spatial.collection,features:spatial.collection.features.filter(f=>accepted.has(String(f.id)))};
    return unknown;
  }catch{return unknown;}
}
