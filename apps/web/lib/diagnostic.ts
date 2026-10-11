import type { ConfidenceLevel, Freshness, RiskLevel, ScientificStatus } from './domain';

/** Read-only UI projection of RiskResult V1, after server JSON Schema validation. */
export interface DiagnosticResult {
  cell_id: string;
  valid_date: string;
  production_id: string;
  indicator_id: string;
  hazard: { value: number | null; unit: string; class?: string | null; [key: string]: unknown };
  exposure?: Record<string, unknown> | null;
  sensitivity?: Record<string, unknown> | null;
  risk: { level: RiskLevel; score?: number | null };
  confidence: { level: ConfidenceLevel; scientific_status: ScientificStatus; reasons?: string[] };
  rule: { rule_id: string; version: string };
  provenance: Array<{ source_id: string; observed_at?: string | null; retrieved_at?: string | null; [key: string]: unknown }>;
  quality: { freshness: Freshness; flags: string[]; [key: string]: unknown };
}

export type DiagnosticData =
  | { mode: 'demo' | 'live'; state: 'available'; result: DiagnosticResult; series: DiagnosticResult[] }
  | { mode: 'demo' | 'live'; state: 'missing' | 'source-error'; message: string };

export const SCIENTIFIC_STATUSES: Record<ScientificStatus, string> = {
  exploratory: 'Exploratoire : hypothèse ou démonstration, sans validation pour cet usage.',
  documented: 'Documenté : appuyé par des références identifiables.',
  expert_reviewed: 'Revu par un expert métier identifié.',
  validated: 'Validé : protocole défini et approuvé pour l’usage ciblé.',
  deprecated: 'Déprécié : ne plus utiliser pour de nouveaux calculs.',
};

/** Identity includes the scientific rule/version. No default is inferred for live. */
export function diagnosticHref(result: DiagnosticResult, mode: 'demo' | 'live', context = new URLSearchParams()) {
  const params = new URLSearchParams(context);
  params.delete('view');
  for (const [key, value] of Object.entries({ mode, cell: result.cell_id, date: result.valid_date,
    production: result.production_id, indicator: result.indicator_id, rule: result.rule.rule_id,
    version: result.rule.version })) params.set(key, value);
  return `/diagnostic?${params}`;
}

export function supplied(value: unknown): string {
  if (value === undefined || value === null || value === '') return 'Non disponible';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** Dates are displayed in UTC; absent/invalid timestamps are never repaired. */
export function timestamp(value: unknown): string {
  if (typeof value !== 'string') return 'Date non renseignée ou invalide';
  const parts = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  const calendar = parts ? Date.parse(`${parts[1]}T00:00:00Z`) : NaN;
  if (!parts || !Number.isFinite(calendar) || new Date(calendar).toISOString().slice(0, 10) !== parts[1]
    || Number(parts[2]) > 23 || Number(parts[3]) > 59 || Number(parts[4] ?? '0') > 59
    || !Number.isFinite(Date.parse(value))) return 'Date non renseignée ou invalide';
  return `${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value))} UTC`;
}
