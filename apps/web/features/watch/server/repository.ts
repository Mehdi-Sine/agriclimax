import 'server-only';
import fixture from '../../../../../fixtures/contracts/risk-result.json';
import type { AppContext, RiskLevel } from '../../../lib/domain';
import type { ResultEvent, WatchRecord } from '../model';
import { deriveSignal } from './evidence';

export interface WatchFilters extends AppContext { riskLevel: RiskLevel | null }
export interface WatchRepository {
  list(filters: WatchFilters): Promise<WatchRecord[]>;
}
export interface StructuredEventSource { readEvents(): Promise<ResultEvent[]> }

/** Adapter seam for validated structured events. Never reads a raw database. */
export class StructuredResultWatchRepository implements WatchRepository {
  constructor(private readonly source: StructuredEventSource) {}
  async list(filters: WatchFilters): Promise<WatchRecord[]> {
    const records = (await this.source.readEvents()).map(deriveSignal);
    if (new Set(records.map(item => item.signal.signal_id)).size !== records.length) throw new Error('Signaux dupliqués');
    return records.filter(({ signal, bundle }) =>
      (!filters.productionId || signal.production_id === filters.productionId) &&
      (!filters.territoryId || signal.territory.cell_id === filters.territoryId) &&
      (!filters.date || signal.validity.date === filters.date) &&
      (!filters.indicatorId || bundle.facts[0].result.indicator_id === filters.indicatorId) &&
      (!filters.riskLevel || signal.risk_level === filters.riskLevel))
      .sort((a, b) => b.signal.created_at.localeCompare(a.signal.created_at));
  }
}
export class FixtureWatchRepository extends StructuredResultWatchRepository {
  constructor() {
    super({ async readEvents() {
      return [{ evidence_id: 'demo-risk-result-001', recorded_at: '2026-07-01T00:00:00Z', mode: 'demo', result: fixture }];
    } });
  }
}
