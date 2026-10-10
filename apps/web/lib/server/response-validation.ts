import 'server-only';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import riskSchema from '../../../../contracts/jsonschema/risk-result.schema.json';
import mapSchema from '../../../../contracts/jsonschema/map-feature.schema.json';
import type { FeatureCollection, Polygon } from 'geojson';
import type { MapProperties } from '../repositories';
import { ApiError } from './query';

export type RiskResult = Record<string, unknown>;
export type LiveMapCollection = FeatureCollection<Polygon, Omit<MapProperties, 'demo'> & { result: RiskResult }>
  & { truncated: boolean; limit: number };
export interface TerritoryResult {
  production_id: string;
  indicator_id: string;
  rule: { rule_id: string; version: string };
  bbox: [number, number, number, number];
  aggregation: 'intersecting_cell_counts';
  groups: Array<{ valid_date: string; risk_level: string; confidence_level: string; freshness: string;
    cell_count: number; latest_computed_at: string }>;
}
const ajv = new Ajv2020({ strict: false });
addFormats(ajv);
const coordinate = { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number' } };
const properties = { ...mapSchema, required: [...mapSchema.required, 'result'],
  properties: { ...mapSchema.properties, result: riskSchema } };
const mapValidator = ajv.compile<LiveMapCollection>({
  type: 'object', additionalProperties: false, required: ['type', 'features', 'truncated', 'limit'],
  properties: { type: { const: 'FeatureCollection' }, truncated: { type: 'boolean' },
    limit: { type: 'integer', minimum: 1, maximum: 2000 },
    features: { type: 'array', maxItems: 2000, items: { type: 'object', additionalProperties: false,
      required: ['type', 'id', 'geometry', 'properties'], properties: {
        type: { const: 'Feature' }, id: { type: 'string', format: 'uuid' }, properties,
        geometry: { type: 'object', additionalProperties: false, required: ['type', 'coordinates'], properties: {
          type: { const: 'Polygon' }, coordinates: { type: 'array', minItems: 1, items: {
            type: 'array', minItems: 4, items: coordinate } } } }
      } } } }
});
const seriesValidator = ajv.compile<RiskResult[]>({ type: 'array', maxItems: 366, items: riskSchema });
const territoryValidator = ajv.compile<TerritoryResult>({
  type: 'object', additionalProperties: false,
  required: ['production_id', 'indicator_id', 'rule', 'bbox', 'aggregation', 'groups'],
  properties: { production_id: { type: 'string' }, indicator_id: { type: 'string' },
    rule: riskSchema.properties.rule,
    bbox: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'number' } },
    aggregation: { const: 'intersecting_cell_counts' },
    groups: { type: 'array', maxItems: 16470, items: { type: 'object', additionalProperties: false,
      required: ['valid_date', 'risk_level', 'confidence_level', 'freshness', 'cell_count', 'latest_computed_at'],
      properties: { valid_date: { type: 'string', format: 'date' },
        risk_level: mapSchema.properties.risk_level, confidence_level: mapSchema.properties.confidence_level,
        freshness: mapSchema.properties.freshness, cell_count: { type: 'integer', minimum: 1 },
        latest_computed_at: { type: 'string', format: 'date-time' } } } }
  }
});
export function validateMap(value: unknown): LiveMapCollection {
  if (!mapValidator(value)) throw new ApiError('INVALID_RESPONSE', 502);
  if (value.features.length > value.limit) throw new ApiError('INVALID_RESPONSE', 502);
  return value;
}
export function validateSeries(value: unknown): RiskResult[] {
  if (!seriesValidator(value)) throw new ApiError('INVALID_RESPONSE', 502);
  return value;
}
export function validateTerritory(value: unknown): TerritoryResult {
  if (!territoryValidator(value)) throw new ApiError('INVALID_RESPONSE', 502);
  return value;
}
