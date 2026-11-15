import {readFileSync} from 'node:fs';
import Preview from './preview';
export default function Page(){return <Preview readings={JSON.parse(readFileSync('../../docs/codex/COUV-04/evidence/visual-readings.json','utf8'))} collection={JSON.parse(readFileSync('public/maps/journal-pra-v1.geojson','utf8'))} support={JSON.parse(readFileSync('data/operational/era5-spatial-support.json','utf8'))}/>;}
