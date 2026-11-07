import {it,expect,vi,beforeEach} from 'vitest';
vi.mock('../../../lib/server/journal',()=>({journal:vi.fn()}));
import {journal} from '../../../lib/server/journal';
import {GET} from './route';
beforeEach(()=>vi.resetAllMocks());
it('rejects invalid calendar dates duplicate and unknown parameters',async()=>{for(const query of ['run=2026-02-30','run=','run=2026-01-01&run=2026-01-02','secret=x'])expect((await GET(new Request('https://example.test/api/journal?'+query))).status).toBe(400);expect(journal).not.toHaveBeenCalled();});
it('returns no-store 503 on archive failure',async()=>{vi.mocked(journal).mockRejectedValue(new Error('internal secret'));const r=await GET(new Request('https://example.test/api/journal'));expect(r.status).toBe(503);expect(r.headers.get('cache-control')).toBe('no-store');expect(await r.text()).not.toContain('secret');});
it('supports conditional read and does not reuse freshness validators',async()=>{vi.mocked(journal).mockResolvedValue({edition_id:'example',data_freshness:'fresh'} as Awaited<ReturnType<typeof journal>>);const r=await GET(new Request('https://example.test/api/journal'));const tag=r.headers.get('etag')!;expect(r.status).toBe(200);expect((await GET(new Request('https://example.test/api/journal',{headers:{'if-none-match':tag}}))).status).toBe(304);vi.mocked(journal).mockResolvedValue({edition_id:'example',data_freshness:'stale'} as Awaited<ReturnType<typeof journal>>);expect((await GET(new Request('https://example.test/api/journal',{headers:{'if-none-match':tag}}))).status).toBe(200);});
