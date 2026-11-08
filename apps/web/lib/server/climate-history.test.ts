import {it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const archives=vi.hoisted(()=>({catalogue:vi.fn(),daily:vi.fn()}));
vi.mock('./weather-archives',()=>({archiveCatalogue:archives.catalogue,archivedEra5Day:archives.daily}));
import {climateHistoryWindow,legacyHistoryDay,legacyHistoryDates} from './climate-history';
import {calendarDays} from '../../features/national/daily-availability';

it('preserves recovered real legacy dates, values and proven support identities',()=>{
 expect(legacyHistoryDates).toHaveLength(30);
 const day=legacyHistoryDay('2026-10-01')!;
 expect(day).toHaveLength(713);
 expect(day.filter(r=>r.status==='available')).toHaveLength(645);
 expect(day.find(r=>r.pra_id==='pra:01195')?.temperature).toBe(18.0789);
 expect(day.find(r=>r.pra_id==='pra:01195')?.identity.method).toBe('pra-native-1');
 expect(legacyHistoryDay('2026-09-30')).toBeNull();
});
it('chooses a complete single series and never fills a crossing window with another precision',async()=>{
 archives.catalogue.mockResolvedValue({era5:[{dates:calendarDays('2026-10-19','2026-11-01'),sha256:'modern'}]});
 archives.daily.mockResolvedValue([]);
 const legacy=await climateHistoryWindow(calendarDays('2026-10-01','2026-10-30'));
 expect(legacy.series).toBe('legacy-rpc-1');expect(legacy.rows).toHaveLength(21390);
 expect(archives.daily).not.toHaveBeenCalled();
 const modern=await climateHistoryWindow(calendarDays('2026-10-19','2026-11-01'));
 expect(modern.series).toBe('exact-storage-1');
 const missing=await climateHistoryWindow(calendarDays('2026-10-03','2026-11-01'));
 expect(missing.series).toBe('exact-storage-1');expect(missing.complete).toBe(false);
 await expect(climateHistoryWindow(['2026-10-01','2026-10-03'])).rejects.toThrow('HISTORY_PERIOD');
});
