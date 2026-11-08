import {it,expect,vi} from 'vitest';
import {writeFile} from 'node:fs/promises';
vi.mock('server-only',()=>({}));
import {nationalWeatherDocument} from '../../lib/server/weather-archives';
import {wheatForecast} from '../../lib/server/wheat';
import {packMetrics,detectQualifiedNational} from '../national-watch/model';
import {nationalWatch} from '../../lib/server/national-watch';
import places from '../../data/operational/pra-watch-places.json';
import {trailingStart} from '../national/daily-availability';
it.skipIf(process.env.CORE01_RUNTIME!=='1')('isolated real cold computation, response cost and memoized replay',async()=>{
 const t=performance.now(),before=process.memoryUsage().rss,document=await nationalWeatherDocument();expect(document).not.toBeNull();const read=performance.now(),loaded=process.memoryUsage().rss;
 const summaries=await wheatForecast(document!),calculated=performance.now(),repeat=await wheatForecast(document!),warm=performance.now();expect(repeat).toBe(summaries);
 const start=trailingStart(document!.run.slice(0,10),0),end=trailingStart(document!.run.slice(0,10),-6),watch=detectQualifiedNational(document!.selected_indices.map(i=>document!.rows[i]),places.places,start,end),watched=performance.now();
 const packed=packMetrics(watch.metrics);
 const published=await nationalWatch(document!.run);
 expect(Buffer.byteLength(JSON.stringify(published))).toBeLessThan(4_000_000);
 expect(Buffer.byteLength(JSON.stringify(summaries))).toBeLessThan(300000);
 await writeFile('../../docs/codex/CORE-01/evidence/runtime.json',JSON.stringify({executed_at:new Date().toISOString(),archive_sha256:document!.archive_sha256,archive_read_validate_ms:read-t,wheat_compute_ms:calculated-read,wheat_memoized_ms:warm-calculated,watch_compute_ms:watched-warm,initial_rss_bytes:before,loaded_rss_bytes:loaded,final_rss_bytes:process.memoryUsage().rss,peak_rss_bytes:process.resourceUsage().maxRSS*1024,wheat_summary_bytes:Buffer.byteLength(JSON.stringify(summaries)),watch_packed_bytes:Buffer.byteLength(JSON.stringify(packed)),watch_summary_bytes:Buffer.byteLength(JSON.stringify(published)),watch_parts:{metrics:Buffer.byteLength(JSON.stringify(packed.metrics)),evidence:Buffer.byteLength(JSON.stringify(packed.evidence)),quality:Buffer.byteLength(JSON.stringify(packed.quality)),quality_count:Object.keys(packed.quality).length}},null,2));
},60000);
