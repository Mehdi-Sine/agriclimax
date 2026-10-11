import type { WatchRecord } from './model';
import { ConfidenceBadge, FreshnessBadge, RiskBadge, Metric } from '../../components/ui/scientific';
import { Badge } from '../../components/ui/primitives';

export function WatchSignalCard({ record, href, detailed }: { record: WatchRecord; href: string; detailed: boolean }) {
  const { signal: s, bundle } = record;
  const result = bundle.facts[0].result;
  return <article className="signal-card" data-demo={bundle.mode === 'demo' || undefined}>
    <span className="eyebrow">{bundle.mode === 'demo' ? 'Signal fictif' : 'Signal structuré'} · {s.validity.date}</span>
    <h2><a href={href}>{s.headline}</a></h2>
    <p>{s.territory.cell_id} · {s.production_id} · {result.indicator_id}</p>
    <div className="badges"><RiskBadge level={s.risk_level} /><ConfidenceBadge level={result.confidence.level} /><FreshnessBadge freshness={result.quality.freshness} /></div>
    <p>Sources : {result.provenance.map(p => p.source_id).join(', ')}</p>
    <Badge>{s.ai.assisted ? 'Assisté par IA' : 'Signal factuel · sans assistance IA'}</Badge>
    {detailed && <div className="stack">
      <Metric label="Aléa" value={result.hazard.value} unit={result.hazard.unit} kind={bundle.mode === 'demo' ? 'Valeur fictive' : 'Indicateur calculé'} />
      <p>Règle : {result.rule.rule_id}@{result.rule.version} · statut : {result.confidence.scientific_status}</p>
      <p>Qualité : {result.quality.flags.join(', ') || 'Aucun flag fourni'}</p>
    </div>}
    <footer><a className="button button-secondary" href={href}>Vérifier le signal</a></footer>
  </article>;
}
