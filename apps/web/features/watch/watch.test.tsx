import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('server-only', () => ({}));
import fixture from '../../../../fixtures/contracts/risk-result.json';
import { deriveSignal, closeBundle } from './server/evidence';
import { FixtureWatchRepository, StructuredResultWatchRepository } from './server/repository';
import { narrate, DeterministicTemplateProvider } from './server/narrative';
import { readSignal } from './model';
import { watchFilters, contextLink } from './context';
import { WatchSignalDetail } from './signal-detail';
import { WatchSignalCard } from './signal-card';
import WatchPage from '../../app/watch/page';

const event = { evidence_id: 'demo-risk-result-001', recorded_at: '2026-07-01T00:00:00Z', mode: 'demo' as const, result: fixture };
const record = () => deriveSignal(event);
const filters = (query = '') => watchFilters(new URLSearchParams(query));

describe('contract-first structured signals', () => {
  it('projects V1 without recalculating risk, confidence or freshness; preserves the full evidence', () => {
    const { signal, bundle } = record();
    expect(readSignal(signal)).toEqual(signal);
    expect(signal).toMatchObject({ risk_level: fixture.risk.level, ai: { assisted: false }, validity: { date: fixture.valid_date }, evidence: [event.evidence_id] });
    expect(bundle.facts[0].result).toEqual(fixture);
    expect(bundle.bundle_version).toBe('1.0');
    expect(bundle.mode).toBe('demo');
    expect(Object.isFrozen(bundle.facts[0].result.provenance)).toBe(true);
    expect(() => readSignal({ ...signal, confidence: 'high' })).toThrow();
    expect(() => deriveSignal({ ...event, result: { ...fixture, risk: { level: 'invented' } } })).toThrow();
  });
  it('rejects invalid evidence timestamps, keys and demo data labelled live', () => {
    expect(() => deriveSignal({ ...event, recorded_at: 'yesterday' })).toThrow();
    expect(() => deriveSignal({ ...event, recorded_at: '2026-02-30T00:00:00Z' })).toThrow();
    expect(() => deriveSignal({ ...event, evidence_id: '<script>' })).toThrow();
    expect(() => deriveSignal({ ...event, mode: 'live' })).toThrow();
  });
  it('has stable content IDs independent of object key order and changes identity with evidence', () => {
    expect(deriveSignal({ ...event, result: Object.fromEntries(Object.entries(fixture).reverse()) })).toEqual(record());
    expect(deriveSignal({ ...event, recorded_at: '2026-07-02T00:00:00Z' }).signal.signal_id).not.toBe(record().signal.signal_id);
    const changed = structuredClone(fixture); changed.quality.freshness = 'stale';
    expect(deriveSignal({ ...event, result: changed }).bundle.bundle_id).not.toBe(record().bundle.bundle_id);
  });
  it('closes a cloned snapshot and detects payload or reference tampering', () => {
    const input = structuredClone(record().bundle);
    const closed = closeBundle(input);
    input.facts[0].result.hazard.value = 999;
    expect(closed.facts[0].result.hazard.value).toBe(3);
    expect(() => closeBundle(input)).toThrow();
    expect(() => closeBundle({ ...record().bundle, signal_id: 'other' })).toThrow();
    expect(() => closeBundle({ ...record().bundle, facts: [] })).toThrow();
  });
});

describe('watch repositories and context', () => {
  it('filters independently by production, territory, risk, date and indicator', async () => {
    const repo = new FixtureWatchRepository();
    expect(await repo.list(filters('production=wheat_soft&territory=demo-001&risk=moderate&date=2026-07-01&indicator=tmax_days_above'))).toHaveLength(1);
    for (const query of ['production=dairy_cattle', 'territory=other', 'risk=critical', 'date=2026-07-02', 'indicator=other']) expect(await repo.list(filters(query))).toHaveLength(0);
    expect(filters('risk=not-a-level&date=2026-02-30').riskLevel).toBeNull();
    expect(filters('date=2026-02-30').date).toBeNull();
  });
  it('does not share mutable fixture data and propagates source failures without fallback', async () => {
    const repo = new FixtureWatchRepository();
    const first = await repo.list(filters());
    first.length = 0;
    expect(await repo.list(filters())).toHaveLength(1);
    const failed = new StructuredResultWatchRepository({ async readEvents() { throw new Error('unavailable'); } });
    await expect(failed.list(filters())).rejects.toThrow('unavailable');
    const duplicated = new StructuredResultWatchRepository({ async readEvents() { return [event, event]; } });
    await expect(duplicated.list(filters())).rejects.toThrow('dupliqués');
  });
  it('accepts structured live events with provided statuses without inferring them', async () => {
    const result = structuredClone(fixture); result.quality.flags = [];
    result.quality.freshness = 'unknown'; result.risk.level = 'unavailable';
    const repo = new StructuredResultWatchRepository({ async readEvents() { return [{ ...event, mode: 'live', result }]; } });
    const [item] = await repo.list(filters());
    expect(item.bundle.mode).toBe('live');
    expect(item.signal.risk_level).toBe('unavailable');
    expect(item.bundle.facts[0].result.quality.freshness).toBe('unknown');
  });
  it('preserves canonical context, compare and explicit live query selectors on navigation', () => {
    const context = filters('production=wheat_soft&territory=demo-001&date=2026-07-01&indicator=tmax_days_above&compare=2026-06-30');
    const url = contextLink(context, 'diagnostic', 'live', new URLSearchParams('rule=r&version=1&bbox=0,0,1,1'));
    const params = new URL(url, 'https://example.test').searchParams;
    expect(params.get('territory')).toBe('demo-001');
    expect(params.get('compare')).toBe('2026-06-30');
    expect(params.get('view')).toBe('diagnostic');
    expect(params.get('mode')).toBe('live');
    expect(params.get('version')).toBe('1');
  });
});

describe('bounded narrative without LLM', () => {
  it('relates every segment to evidence and retains the factual payload and versioned audit', async () => {
    const bundle = record().bundle;
    const result = await narrate(bundle, { enabled: true, now: () => new Date('2026-07-01T01:00:00Z') });
    expect(result.state).toBe('available');
    if (result.state !== 'available') throw new Error('Missing narration');
    expect(result.audit).toMatchObject({ assisted: false, model: 'deterministic-template/1.0', template_version: 'watch-facts/1.0', generated_at: '2026-07-01T01:00:00.000Z', factual_payload: bundle });
    expect(result.segments.map(s => s.evidence_id)).toEqual(bundle.facts.map(f => f.evidence_id));
    const text = result.segments.map(s => s.text).join(' ');
    const evidenceText = JSON.stringify(bundle.facts);
    for (const number of text.match(/\d+(?:\.\d+)*/g) ?? []) expect(evidenceText).toContain(number);
    for (const url of text.match(/https?:\/\/\S+/g) ?? []) expect(evidenceText).toContain(url);
  });
  it.each([' Valeur : 9999.', ' Source : https://invented.example/source.', ' Cela cause une perte de rendement.', ' Conclusion validée.'])('rejects provider additions: %s', async addition => {
    const provider = new DeterministicTemplateProvider();
    const generate = async (bundle: Parameters<typeof provider.generate>[0]) => {
      const proposal = await provider.generate(bundle); proposal.segments[0].text += addition; return proposal;
    };
    expect(await narrate(record().bundle, { enabled: true, provider: { assisted: true, model: 'test/fake', generate } })).toEqual({ state: 'unavailable' });
  });
  it('rejects new evidence IDs and tampered bundles', async () => {
    expect(await narrate(record().bundle, { enabled: true, provider: { assisted: true, model: 'test/fake', async generate() { return { segments: [{ evidence_id: 'invented', text: '' }] }; } } })).toEqual({ state: 'unavailable' });
    expect(await narrate({ ...record().bundle, bundle_id: 'other' }, { enabled: true })).toEqual({ state: 'unavailable' });
  });
  it('can be disabled without invoking a provider and handles failure without breaking signals', async () => {
    const generate = vi.fn(async () => { throw new Error('No LLM'); });
    const provider = { model: 'test/fake', assisted: true, generate };
    expect(await narrate(record().bundle, { enabled: false, provider })).toEqual({ state: 'disabled' });
    expect(generate).not.toHaveBeenCalled();
    expect(await narrate(record().bundle, { enabled: true, provider })).toEqual({ state: 'unavailable' });
    expect(readSignal(record().signal).risk_level).toBe('moderate');
  });
});

describe('watch rendering and explicit states', () => {
  it('renders provenance, UTC, confidence, freshness and assistive labels in detail', async () => {
    const item = record();
    const narrative = await narrate(item.bundle, { enabled: true, provider: { ...new DeterministicTemplateProvider(), model: 'fake-test', assisted: true, generate: bundle => new DeterministicTemplateProvider().generate(bundle) } });
    const html = renderToStaticMarkup(<WatchSignalDetail record={item} narrative={narrative} mapHref="/?territory=demo-001" diagnosticHref="/?view=diagnostic" />);
    for (const text of ['Assisté par IA', 'Confiance', 'Donnée à jour', 'demo-fiction', 'URL de source non disponible', 'EvidenceBundle fermé', 'UTC', 'demo-risk-result-001']) expect(html).toContain(text);
    expect(html).not.toContain('https://invented');
  });
  it('compact and detailed cards expose independent badges without fabricated dates', () => {
    const item = record();
    const compact = renderToStaticMarkup(<WatchSignalCard record={item} href="/watch?signal=test" detailed={false} />);
    const detailed = renderToStaticMarkup(<WatchSignalCard record={item} href="/watch?signal=test" detailed />);
    expect(compact).toContain('2026-07-01');
    expect(compact).toContain('Signal factuel');
    expect(detailed).toContain('demo_heat_wheat');
    expect(compact).not.toContain('demo_heat_wheat');
  });
  it('renders disabled/unavailable narratives and stale/insufficient independently', () => {
    const result = structuredClone(fixture); result.quality.freshness = 'stale'; result.risk.level = 'unavailable';
    const item = deriveSignal({ ...event, result });
    for (const state of ['disabled', 'unavailable'] as const) {
      const html = renderToStaticMarkup(<WatchSignalDetail record={item} narrative={{ state }} mapHref="/" diagnosticHref="/" />);
      expect(html).toContain(state === 'disabled' ? 'Narration désactivée' : 'Narration indisponible');
      expect(html).toContain('Données anciennes'); expect(html).toContain('Données insuffisantes');
    }
  });
  it('does not display fixtures in live, empty filters or unknown signal contexts', async () => {
    const live = renderToStaticMarkup(await WatchPage({ searchParams: Promise.resolve({ mode: 'live' }) }));
    expect(live).toContain('Source de veille indisponible');
    expect(live).not.toContain('demo-fiction');
    expect(live).not.toContain('Signal fictif');
    const empty = renderToStaticMarkup(await WatchPage({ searchParams: Promise.resolve({ production: 'dairy_cattle' }) }));
    expect(empty).toContain('Données absentes'); expect(empty).not.toContain('Signal fictif');
    const unknown = renderToStaticMarkup(await WatchPage({ searchParams: Promise.resolve({ signal: 'missing' }) }));
    expect(unknown).toContain('Données absentes');
  });
});
