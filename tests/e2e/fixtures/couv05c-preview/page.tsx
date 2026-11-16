import '../journal/journal.css';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sealMap,mapInfo} from '../../features/edition-maps/model';
import {journalMapCards} from '../../features/edition-maps/carousel-model';
import Preview from './preview';
export default function Page(){
  const samples=['rain','temperature_mean','thi'].map(id=>JSON.parse(readFileSync('../../work/couv05c-visual/'+id+'.json','utf8')));
  const maps=samples.map(({map})=>{const {id,...body}=map;void id;return sealMap(body);});
  const bundle=createHash('sha256').update(JSON.stringify(maps)).digest('hex');
  const view={status:'preview' as const,code:'COUV05C_LOCAL_REPLAY',bundle_sha256:bundle,maps:maps.map(mapInfo)};
  return <Preview samples={samples.map((s,i)=>({...s,map:maps[i]}))} view={view} cards={journalMapCards(view,bundle,'2026-11-15')} editionId={bundle} collection={JSON.parse(readFileSync('public/maps/journal-pra-v1.geojson','utf8'))}/>;
}
