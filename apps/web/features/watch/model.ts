import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import watchSchema from '../../../../contracts/jsonschema/watch-signal.schema.json';
import riskSchema from '../../../../contracts/jsonschema/risk-result.schema.json';
import type { ConfidenceLevel, Freshness, RiskLevel, ScientificStatus } from '../../lib/domain';

/** Internal refinement of V1's open objects. No extra top-level contract fields. */
export interface WatchSignal {
  schema_version: '1.0';
  signal_id: string;
  created_at: string;
  validity: { date: string };
  territory: { cell_id: string };
  production_id: string;
  risk_level: RiskLevel;
  headline: string;
  summary: string | null;
  evidence: string[];
  ai: { assisted: boolean; template_version: string | null; model: string | null };
}
export interface StructuredResult {
  schema_version: '1.0';
  cell_id: string;
  valid_date: string;
  production_id: string;
  indicator_id: string;
  hazard: { value: number | null; unit: string };
  exposure?: Record<string, unknown> | null;
  sensitivity?: Record<string, unknown> | null;
  risk: { level: RiskLevel; score?: number | null };
  confidence: { level: ConfidenceLevel; scientific_status: ScientificStatus; reasons?: string[] };
  rule: { rule_id: string; version: string };
  provenance: { source_id: string; observed_at?: string | null; retrieved_at?: string | null; [key: string]: unknown }[];
  quality: { freshness: Freshness; flags: string[]; [key: string]: unknown };
}
export interface ResultEvent {
  evidence_id: string;
  recorded_at: string;
  mode: 'demo' | 'live';
  result: unknown;
}
export interface EvidenceFact {
  evidence_id: string;
  recorded_at: string;
  result: StructuredResult;
}
export interface EvidenceBundle {
  bundle_version: '1.0';
  bundle_id: string;
  signal_id: string;
  created_at: string;
  mode: 'demo' | 'live';
  facts: EvidenceFact[];
}
export interface WatchRecord { signal: WatchSignal; bundle: EvidenceBundle }

const ajv = new Ajv2020({ strict: false });
addFormats(ajv);
const validateResult = ajv.compile<StructuredResult>(riskSchema);
const validateSignal = ajv.compile<WatchSignal>(watchSchema);
export function readResult(value: unknown): StructuredResult {
  if (!validateResult(value) || value.schema_version !== '1.0') throw new Error('Résultat structuré invalide');
  return structuredClone(value);
}
export function readSignal(value: unknown): WatchSignal {
  if (!validateSignal(value)) throw new Error('WatchSignal V1 invalide');
  return structuredClone(value);
}
