import {it,expect,vi} from 'vitest';
import {writeFile,mkdir} from 'node:fs/promises';
vi.mock('server-only',()=>({}));
import {journal} from '../../lib/server/journal';
import {nationalWatch} from '../../lib/server/national-watch';
import {archiveCatalogue} from '../../lib/server/weather-archives';
// Explicit opt-in, authenticated read-only acceptance. No fixture substitution.
it.skipIf(process.env.TASK31_REAL!=='1')('builds a traceable edition from verified archives',async()=>{
 const edition=await journal(),s=await nationalWatch(),catalogue=await archiveCatalogue();
 expect(edition.edition_id).toHaveLength(64);expect(edition.regional_sections).toHaveLength(13);
 for(const f of edition.evidence.facts){const e=s.events.find(e=>e.text===f.text);expect(e).toBeDefined();expect(f.value).toBe(e!.value);expect(f.provenance).toEqual(e!.provenance);}
 expect(edition.source_cycles).toEqual([s.run]);
 const output='../../docs/codex/task31/evidence';await mkdir(output,{recursive:true});
 await writeFile(`${output}/real-edition.json`,JSON.stringify(edition,null,2));
 await writeFile(`${output}/archive-inventory.json`,JSON.stringify({weather:catalogue?.weather.map(e=>({run:e.run_at??e.run_date,sha256:e.sha256,method:e.method_version})),era5:catalogue?.era5.map(e=>({dates:e.dates,sha256:e.sha256,method:e.method_version}))},null,2));
},60000);
