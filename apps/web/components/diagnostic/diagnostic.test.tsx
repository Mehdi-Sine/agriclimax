import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('server-only', () => ({}));
import fixture from '../../../../fixtures/contracts/risk-result.json';
import { loadDiagnostic } from './load-diagnostic';
import { ScientificDiagnostic } from './scientific-diagnostic';
import { SupabaseRiskRepository } from '../../lib/server/supabase-risk-repository';
import { diagnosticHref, supplied, timestamp, type DiagnosticResult } from '../../lib/diagnostic';
import { validateSeries } from '../../lib/server/response-validation';

const result = validateSeries([fixture])[0] as unknown as DiagnosticResult;
const demoParams = () => new URL(diagnosticHref(result, 'demo'), 'http://localhost').searchParams;
const liveParams = () => { const p = demoParams(); p.set('mode', 'live'); return p; };
const markup = (r: DiagnosticResult, mode: 'demo' | 'live' = 'demo', series = [r]) => renderToStaticMarkup(
  <ScientificDiagnostic data={{ mode, state: 'available', result: r, series }} />
);
describe('diagnostic identity and server reads', () => {
  it('loads a labelled local fixture without any network dependency', async () => {
    const repository = new SupabaseRiskRepository();
    const spy = vi.spyOn(repository, 'getRiskSeries');
    const data = await loadDiagnostic(demoParams(), repository);
    expect(data).toMatchObject({ mode: 'demo', state: 'available', result: { cell_id: 'demo-001' } });
    expect(spy).not.toHaveBeenCalled();
  });
  it.each(['cell', 'production', 'indicator', 'date', 'rule', 'version'])('never substitutes a demo result for a mismatched %s', async key => {
    const params = demoParams(); params.set(key, key === 'date' ? '2026-07-02' : 'other');
    expect(await loadDiagnostic(params)).toMatchObject({ state: 'missing' });
  });
  it.each(['cell', 'production', 'indicator', 'date', 'rule', 'version'])('rejects an absent %s before fetching live', async key => {
    const params = liveParams(); params.delete(key);
    const repository = new SupabaseRiskRepository();
    const spy = vi.spyOn(repository, 'getRiskSeries');
    expect(await loadDiagnostic(params, repository)).toMatchObject({ mode: 'live', state: 'source-error' });
    expect(spy).not.toHaveBeenCalled();
  });
  it.each(['date=2026-02-30', 'start=2026-07-02&end=2026-07-01', 'start=2020-01-01&end=2026-07-01', 'start=2026-07-02&end=2026-07-03', 'mode=invalid'])('rejects invalid dates/ranges/modes: %s', async suffix => {
    const params = demoParams();
    for (const [key, value] of new URLSearchParams(suffix)) params.set(key, value);
    expect(await loadDiagnostic(params)).toMatchObject({ state: 'source-error' });
  });
  it('rejects duplicate identities and dates in query strings', async () => {
    for (const key of ['cell', 'date', 'mode', 'start', 'rule']) {
      const params = demoParams(); params.append(key, params.get(key) ?? '2026-07-01');
      params.append(key, params.get(key)!);
      expect(await loadDiagnostic(params)).toMatchObject({ state: 'source-error' });
    }
  });
  it('renders live payloads, preserving exact rule identity and series order', async () => {
    const previous = { ...result, valid_date: '2026-06-30', hazard: { value: 0, unit: 'd' } };
    const repository = new SupabaseRiskRepository();
    const spy = vi.spyOn(repository, 'getRiskSeries').mockResolvedValue(validateSeries([result, previous]));
    const params = liveParams(); params.set('start', '2026-06-30');
    const data = await loadDiagnostic(params, repository);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ p_cell: result.cell_id, p_start: '2026-06-30', p_end: result.valid_date, p_version: result.rule.version }));
    expect(data.state).toBe('available');
    if (data.state === 'available') {
      expect(data.series.map(p => p.valid_date)).toEqual(['2026-06-30', '2026-07-01']);
      expect(markup(data.result, 'live', data.series)).not.toContain('data-demo=');
    }
  });
  it('keeps live failures and missing results explicit, without a fixture or leaked error', async () => {
    const repository = new SupabaseRiskRepository();
    const spy = vi.spyOn(repository, 'getRiskSeries').mockResolvedValue([]);
    expect(await loadDiagnostic(liveParams(), repository)).toMatchObject({ mode: 'live', state: 'missing' });
    spy.mockRejectedValue(new Error('private-upstream-sentinel'));
    const data = await loadDiagnostic(liveParams(), repository);
    const html = renderToStaticMarkup(<ScientificDiagnostic data={data} />);
    expect(html).toContain('Source indisponible');
    expect(html).not.toMatch(/private-upstream-sentinel|demo-fiction|data-demo=/);
  });
  it('does not choose arbitrarily between duplicate results', async () => {
    const repository = new SupabaseRiskRepository();
    vi.spyOn(repository, 'getRiskSeries').mockResolvedValue(validateSeries([result, result]));
    expect(await loadDiagnostic(liveParams(), repository)).toMatchObject({ state: 'source-error' });
  });
  it('rejects duplicate dates elsewhere in the series as an upstream ambiguity', async () => {
    const previous = { ...result, valid_date: '2026-06-30' };
    const repository = new SupabaseRiskRepository();
    vi.spyOn(repository, 'getRiskSeries').mockResolvedValue(validateSeries([result, previous, previous]));
    const params = liveParams(); params.set('start', previous.valid_date);
    expect(await loadDiagnostic(params, repository)).toMatchObject({ state: 'source-error' });
  });
  it('preserves map context and exact identity in a shareable link', () => {
    const url = new URL(diagnosticHref(result, 'live', new URLSearchParams('bbox=-5,43,1,49&zoom=8&territory=demo-001&view=watch')), 'http://localhost');
    expect(url.pathname).toBe('/diagnostic');
    expect(url.searchParams.get('bbox')).toBe('-5,43,1,49');
    expect(url.searchParams.get('version')).toBe(result.rule.version);
    expect(url.searchParams.get('view')).toBeNull();
  });
});

describe('scientific explanation without frontend classification', () => {
  it('separates every concept, unknown metadata and exact supplied identity', () => {
    const html = markup(result);
    for (const text of ['Hazard', 'Exposure', 'Sensitivity', 'Risk', 'Confidence', 'Freshness', 'Provenance', 'Flags qualité', 'Fenêtre temporelle', 'Limites', result.rule.rule_id, result.rule.version]) expect(html).toContain(text);
    expect(html).toContain('nature observation/prévision non renseignée');
    expect(html).toContain('Seuils et méthode non renseignés');
    expect(html).toContain('Série temporelle insuffisante');
    expect(html).toContain('demo-fiction');
    expect(html).toContain('Date non renseignée ou invalide');
  });
  it('keeps zero distinct from absent exposure/sensitivity/score', () => {
    const html = markup({ ...result, exposure: { value: 0, unit: 'ha' }, sensitivity: { value: 0, unit: 'index' }, risk: { level: 'low', score: 0 }, hazard: { value: 0, unit: 'd' } });
    expect(html).toContain('<dd>0</dd>');
    expect(html).toContain('Score fourni : 0');
    const absent = markup({ ...result, exposure: undefined, sensitivity: null });
    expect(absent.match(/aucune valeur fournie, ne vaut pas zéro/g)).toHaveLength(2);
    expect(absent).toContain('Score fourni : Non disponible');
    expect(supplied(false)).toBe('false'); expect(supplied(0)).toBe('0');
  });
  it('does not infer no-risk from a low risk or unavailable hazard', () => {
    expect(markup({ ...result, risk: { level: 'low' } })).not.toContain('Risque non identifié');
    const html = markup({ ...result, hazard: { value: null, unit: 'd' }, risk: { level: 'unavailable' }, quality: { freshness: 'stale', flags: ['missing_data', 'imputed_data'], coverage: 0, imputed: true, window_start: '2026-06-27', window_end: '2026-07-01', source_resolution: '25 km' } });
    for (const text of ['Données insuffisantes', 'conclusion impossible', 'Données anciennes', 'imputed_data', '25 km', '2026-06-27', 'Aléa non disponible']) expect(html).toContain(text);
  });
  it.each(['exploratory', 'documented', 'expert_reviewed', 'validated', 'deprecated'] as const)('shows scientific status %s without inferring it', status => {
    expect(markup({ ...result, confidence: { level: 'high', scientific_status: status } })).toContain(status);
  });
  it.each(['low', 'moderate', 'high', 'critical', 'unavailable'] as const)('keeps %s risk independent from confidence', level => {
    const html = markup({ ...result, risk: { level }, confidence: { level: 'low', scientific_status: 'documented' } });
    expect(html).toContain('Confiance : faible'); expect(html).toContain(`risk-${level}`);
  });
  it('makes missing source, coverage, reasons and resolution explicit', () => {
    const html = markup({ ...result, provenance: [], confidence: { level: 'medium', scientific_status: 'documented' }, quality: { freshness: 'unknown', flags: [] } }, 'live');
    expect(html).toContain('Source non renseignée');
    expect(html).toContain('Motifs non renseignés');
    expect(html).toContain('Fraîcheur inconnue');
    expect(html).toContain('Aucun flag signalé');
    expect(html).not.toContain('data-demo=');
  });
  it('does not execute supplied markup or invent clickable source metadata', () => {
    const html = markup({ ...result, provenance: [{ source_id: '<script>alert(1)</script>', url: 'javascript:alert(1)' }] });
    expect(html).not.toContain('<script>'); expect(html).not.toContain('href="javascript:');
  });
  it('displays timestamp instants in UTC and refuses dates without a timezone', () => {
    expect(timestamp('2026-07-01T12:00:00+02:00')).toContain('10:00 UTC');
    expect(timestamp('2026-07-01T12:00:00')).toContain('non renseignée');
    expect(timestamp('2026-02-30T12:00:00Z')).toContain('invalide');
    expect(timestamp('2026-07-01T24:00:00Z')).toContain('invalide');
    expect(timestamp(null)).toContain('non renseignée');
  });
});
