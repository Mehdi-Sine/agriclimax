import {historicalWheatInputs} from "../apps/web/lib/server/wheat";
import {forecastProvider} from "../apps/web/features/multiproduction/archives";
import {RECIPES} from "../apps/web/features/multiproduction/registry";
import {computeBatch,type InputProvider} from "../apps/web/features/multiproduction/engine";
import {capture} from "./manual_indicators";
import {hash,shift} from "../apps/web/features/editorial/temporal";
import {sealBundle,sealMap,verifyBundle,type EditionMap} from "../apps/web/features/edition-maps/model";
import type {Archive} from "../apps/web/features/editorial-ai/model";
import type {DailyEditorialSnapshot} from "../apps/web/features/nightly/snapshot";
import type {ArchivedDaily,NationalWeatherDocument} from "../apps/web/lib/server/weather-archives";
import places from "../apps/web/data/operational/pra-watch-places.json";

/** Bounded initial catalogue, existing recipes only. No acquisition or scientific fallback. */
const indicators=["temperature_min","temperature_mean","rain","frost","gdd"];
export function buildEditionMaps(archive:Archive,snapshot:DailyEditorialSnapshot,inputs:{history:ArchivedDaily[];document:NationalWeatherDocument|null}){
  if(snapshot.test_only||!snapshot.input_archive||snapshot.edition_date!==archive.date||snapshot.briefing?.bundle_id!==archive.briefing.bundle_id)throw Error("MAP_FROZEN_INPUT_BINDING");
  const groups:{nature:EditionMap["nature"];period:[string,string];provider:InputProvider}[]=[];
  const end=archive.briefing.validity.history_cutoff;
  const period:[string,string]=[shift(end,-6),end];
  const history=inputs.history.filter(r=>r.valid_date>=period[0]&&r.valid_date<=end);
  if(history.length){
    // Use only frozen native rows. A later coastal support release cannot change an archive.
    const cache=new Map<string,ReturnType<typeof historicalWheatInputs>>();
    const provider:InputProvider=(pra,variables)=>{
      const recipe=RECIPES.find(r=>r.kernel.variables.join()===variables.join())!;
      const key=variables.join();
      if(!cache.has(key))cache.set(key,historicalWheatInputs(history,recipe.kernel));
      return cache.get(key)?.[pra]??[];
    };
    groups.push({nature:"reanalysis",period,provider});
  }
  if(inputs.document){
    const doc=inputs.document;
    if(!snapshot.sources.some(c=>c.archive.sha256===doc.archive_sha256))throw Error("MAP_FORECAST_SOURCE_BINDING");
    const period:[string,string]=[archive.date,shift(archive.date,1)];
    groups.push({nature:"forecast",period,provider:forecastProvider(doc,period)});
  }
  const maps:EditionMap[]=[];
  for(const g of groups){
    const captured=capture(g.provider),input_sha256=hash(captured);
    const batch=computeBatch(places.places.map(p=>p.id),g.period,(pra,variables)=>captured[variables.join()]?.[pra]??[]);
    for(const indicator of indicators){
      const all=batch.measurements.filter(m=>m.indicator===indicator),first=all[0];
      if(!first)continue;
      const values=all.filter(m=>m.production===first.production);
      if(!values.some(m=>m.result.value!==null||m.result.observed_value!=null))continue;
      const recipe=RECIPES.find(r=>r.id===indicator)!;
      maps.push(sealMap({indicator,title:recipe.kernel.label,nature:g.nature,period:g.period,unit:recipe.kernel.unit,input_sha256,
        sources:[...new Set(values.flatMap(m=>m.origins.map(o=>o.source)))].sort(),
        cycles:[...new Set(values.flatMap(m=>m.origins.flatMap(o=>o.run?[o.run]:[])))].sort(),
        rows:values.map(m=>{const r=m.result;return {territoryId:r.territoryId,value:r.value,observed_value:r.observed_value??null,status:r.status,reason:r.reason,
          support_scope:r.support_scope,support_id:r.support_id,spatial_coverage:r.spatial_coverage,temporal_coverage:r.temporal_coverage,
          data_freshness:[...r.data_freshness],rule_version:r.rule_version,quality_flags:[...r.quality_flags],provenance:[...r.provenance],quality:r.quality?{...r.quality,evidence:{...r.quality.evidence}}:undefined};}),
      }));
    }
  }
  const bundle=sealBundle({version:"edition-maps-1",edition_id:archive.edition_id,edition_checksum:archive.checksum,edition_date:archive.date,
    snapshot_id:snapshot.id,input_archive_sha256:snapshot.input_archive.sha256,maps});
  return verifyBundle(bundle,archive);
}
