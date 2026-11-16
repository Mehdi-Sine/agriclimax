import {expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
vi.mock('server-only',()=>({}));
vi.mock('./weather-archives',async()=>{
  const {unpackWeatherArchive}=await import('./weather-archive-codec');
  return {forecastMaskObject:async(path:string)=>readFileSync(resolve(process.env.COUV05_REAL_SIDECARS!,path)),
    nationalWeatherDocument:async(_run:unknown,sha?:string)=>{const raw=readFileSync(process.env.COUV05_REAL_ARCHIVE!),actual=sha??createHash('sha256').update(raw).digest('hex');return {...unpackWeatherArchive(raw,actual),archive_sha256:actual};}};
});
import {unpackWeatherArchive} from './weather-archive-codec';
import type {NationalWeatherDocument} from './weather-archives';
import {editionForecastRendering} from './edition-forecast';
import {forecastProvider} from '../../features/multiproduction/archives';
import {RECIPES} from '../../features/multiproduction/registry';
import {calculateQualified} from '../../features/climate-quality/calculate';
import {sealMap} from '../../features/edition-maps/model';
import Ajv2020 from 'ajv/dist/2020';
import schema from '../../../../contracts/jsonschema/agroclimatic-1.schema.json';
import {agroclimaticData} from './agroclimatic';
import places from '../../data/operational/pra-watch-places.json';
const enabled=!!process.env.COUV05_REAL_ARCHIVE&&!!process.env.COUV05_REAL_SIDECARS;
const hash=(o:unknown)=>createHash('sha256').update(JSON.stringify(o)).digest('hex');
it.skipIf(!enabled)('attaches exact native evidence to an unchanged real preview and rejects altered values or input hashes',async()=>{
  vi.stubEnv('COUV05_RENDER_ENABLED','true');vi.stubEnv('COUV05_INDEX_SHA256','df8d1c4abc3a3427cee3df3daf200dc7058f408fa22be274bff84e476fbd9145');
  try{
    const raw=readFileSync(process.env.COUV05_REAL_ARCHIVE!),sha=createHash('sha256').update(raw).digest('hex');
    const doc={...unpackWeatherArchive(raw,sha),archive_sha256:sha} as NationalWeatherDocument;
    const period:[string,string]=['2026-11-15','2026-11-15'],provider=forecastProvider(doc,period),rule=RECIPES.find(r=>r.id==='rain')!.kernel;
    const captured=Object.fromEntries([...new Set(RECIPES.map(r=>r.kernel.variables.join()))].map(key=>[key,Object.fromEntries(places.places.map(p=>[p.id,provider(p.id,key.split(',') as Parameters<typeof provider>[1])]))]));
    const results=places.places.map(p=>calculateQualified(p.id,provider(p.id,rule.variables),...period,rule,rule.threshold));
    const map=sealMap({indicator:rule.id,title:rule.label,nature:'forecast',period,unit:rule.unit,sources:['meteofrance-arome'],cycles:[doc.run],input_sha256:hash(captured),
      rows:results.map(r=>({...r,observed_value:r.observed_value??null}))});
    const before=JSON.stringify(map),rendering=await editionForecastRendering(map,'preview');
    expect(Object.values(rendering!.qualities).filter(q=>q.indicator_eligible)).toHaveLength(713);
    expect(JSON.stringify(map)).toBe(before);
    const poisoned=await editionForecastRendering({...map,input_sha256:'0'.repeat(64)},'preview');
    expect(Object.values(poisoned!.qualities).every(q=>q.state==='unknown')).toBe(true);
    const altered={...map,rows:map.rows.map((r,i)=>i?r:{...r,value:(r.value??0)+1})};
    const rejected=await editionForecastRendering(altered,'preview');
    expect(rejected!.qualities[map.rows[0].territoryId].state).toBe('unknown');
    expect(await editionForecastRendering(map,'published')).toBeUndefined();
    const payload=await agroclimaticData(new URLSearchParams({indicator:'rain',temporal:'forecast',start:period[0],end:period[1]}));
    const validate=new Ajv2020({strict:false}).compile(schema);
    expect(validate(payload),JSON.stringify(validate.errors)).toBe(true);
    expect(payload.data).toHaveLength(713);expect(payload.forecast_support).toBeDefined();
    expect(payload.data.every(r=>r.quality?.indicator_eligible)).toBe(true);
  }finally{vi.unstubAllEnvs();}
},60000);
