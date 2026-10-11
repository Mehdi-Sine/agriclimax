import 'server-only';
import { createHash } from 'node:crypto';
import { readResult, readSignal, type EvidenceBundle, type ResultEvent, type WatchRecord } from '../model';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function digest(value: unknown) { return createHash('sha256').update(canonical(value)).digest('hex'); }
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function validTimestamp(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);
}
/** Projection only: never computes or upgrades a scientific risk/confidence. */
export function deriveSignal(event: ResultEvent): WatchRecord {
  if (!['demo', 'live'].includes(event.mode) || !/^[a-zA-Z0-9_-]{1,128}$/.test(event.evidence_id) || !validTimestamp(event.recorded_at)) throw new Error('Événement invalide');
  const result = readResult(event.result);
  if (event.mode === 'live' && result.quality.flags.some(flag => flag === 'demo' || flag === 'fictitious')) throw new Error('Fixture interdite en live');
  const signalId = `watch-${digest({ evidence_id: event.evidence_id, recorded_at: event.recorded_at, mode: event.mode, result }).slice(0, 24)}`;
  const signal = readSignal({
    schema_version: '1.0', signal_id: signalId, created_at: event.recorded_at,
    validity: { date: result.valid_date }, territory: { cell_id: result.cell_id },
    production_id: result.production_id, risk_level: result.risk.level,
    headline: `${event.mode === 'demo' ? 'Données fictives · ' : ''}${result.indicator_id} · ${result.production_id}`,
    summary: null, evidence: [event.evidence_id],
    ai: { assisted: false, template_version: null, model: null },
  });
  const payload = {
    bundle_version: '1.0' as const, signal_id: signalId, created_at: event.recorded_at,
    mode: event.mode, facts: [{ evidence_id: event.evidence_id, recorded_at: event.recorded_at, result }],
  };
  const bundle: EvidenceBundle = { ...payload, bundle_id: `sha256:${digest(payload)}` };
  return freeze({ signal, bundle });
}
/** Closed, cloned snapshot with hash and referential integrity checked before narration. */
export function closeBundle(input: EvidenceBundle): EvidenceBundle {
  const bundle = structuredClone(input);
  const { bundle_id, ...payload } = bundle;
  if (bundle.bundle_version !== '1.0' || !validTimestamp(bundle.created_at) ||
      !['demo', 'live'].includes(bundle.mode) || bundle.facts.length !== 1 ||
      bundle_id !== `sha256:${digest(payload)}`) throw new Error('EvidenceBundle invalide ou altéré');
  const fact = bundle.facts[0];
  const derived = deriveSignal({ ...fact, mode: bundle.mode });
  if (derived.signal.signal_id !== bundle.signal_id || derived.bundle.bundle_id !== bundle_id) throw new Error('Références de preuve incohérentes');
  return freeze(bundle);
}
