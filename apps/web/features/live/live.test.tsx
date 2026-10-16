import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('server-only',()=>({}));
import portfolio from '../../../../supabase/tests/wheat-portfolio.json';
import { isLiveWorkspace, liveContext, liveHref } from './context';
import { loadLive } from './load';
import { LiveWorkspace } from './workspace';
const query = 'mode=live_meteofrance&production=wheat&indicator=gdd&start=2026-09-01&end=2026-09-03';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
function setup(payload:unknown=[portfolio]) {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://example.supabase.co');
  vi.stubEnv('SUPABASE_SECRET_KEY','test-only-private-key');
  // This setting must never enable snapshot reads in the unified live workspace.
  vi.stubEnv('WHEAT_STORAGE','snapshots');
  const transport=vi.fn<typeof fetch>().mockImplementation(async input => Response.json(String(input).endsWith('agriclimax_weather_stations') ? [] : payload));
  vi.stubGlobal('fetch',transport);
  return transport;
}
describe('Live context and real-result boundary',()=>{
  it('defaults to real indicators while preserving explicit demo, snapshots and versioned risk routes',()=>{
    expect(isLiveWorkspace(new URLSearchParams())).toBe(true);
    expect(isLiveWorkspace(new URLSearchParams('mode=live_meteofrance&production=cattle'))).toBe(true);
    for(const query of ['mode=demo','mode=wheat','mode=live&rule=versioned-risk&version=1']) expect(isLiveWorkspace(new URLSearchParams(query))).toBe(false);
  });
  it('preserves station, metric, window and parameters across all views',()=>{
    const context=liveContext(new URLSearchParams(`${query}&station=35281001&stage=anthese`));
    for (const view of ['observation','diagnostic','history','watch'] as const) {
      const url=new URL(liveHref(view,context.query),'https://app.test');
      expect(url.searchParams.get('station')).toBe('35281001');
      expect(url.searchParams.get('indicator')).toBe('gdd');
      expect(url.searchParams.get('end')).toBe('2026-09-03');
      expect(url.searchParams.get('stage')).toBe('anthese');
    }
  });
  it.each(['production=other','indicator=thi','start=2026-02-30','station=x','end=2099-01-01','start=2024-01-01','stage=inferred','fingerprint=latest'])('rejects invalid scientific context without a source call: %s', async change=>{
    const transport=setup();const params=new URLSearchParams(query);const [key,value]=change.split('=');params.set(key,value);
    expect((await loadLive(liveContext(params))).failure).toContain('Contexte invalide');
    expect(transport).not.toHaveBeenCalled();
  });
  it('uses persisted results regardless of the snapshot setting and maps the selected metric',async()=>{
    const transport=setup();
    const html=renderToStaticMarkup(await LiveWorkspace({params:new URLSearchParams(query.replace('indicator=gdd','indicator=precipitation_sum')),view:'observation'}));
    expect(transport.mock.calls.some(([url])=>String(url).endsWith('agriclimax_wheat_portfolios'))).toBe(true);
    expect(html).toContain('Cumul de précipitations');
    expect(html).toContain('Source : Météo-France');
    expect(html).toContain('stale');expect(html).toContain('exploratory');expect(html).toContain('/history?');
    expect(html).not.toContain('test-only-private-key');
  });
  it('does not replace empty or failed live sources with known snapshot values',async()=>{
    const transport=setup([]);
    const context=liveContext(new URLSearchParams(query));
    expect((await loadLive(context)).portfolios).toEqual([]);
    transport.mockRejectedValue(new Error('private exception'));
    const html=renderToStaticMarkup(await LiveWorkspace({params:new URLSearchParams(query),view:'diagnostic'}));
    expect(html).toContain('Aucun instantané ni fixture');
    expect(html).not.toContain('private exception');expect(html).not.toContain('wheat.gdd');
  });
  it('keeps an explicitly selected station absent instead of selecting the first result',async()=>{
    setup();
    const html=renderToStaticMarkup(await LiveWorkspace({params:new URLSearchParams(`${query}&station=99999999`),view:'history'}));
    expect(html).toContain('Historique absent');expect(html).toContain('Aucun calcul publié');
    expect(html).not.toContain('Date du calcul');
  });
});
