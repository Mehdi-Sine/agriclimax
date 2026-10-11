import type { WatchRecord } from './model';
import type { NarrativeState } from './server/narrative';
import { ConfidenceBadge, FreshnessBadge, RiskBadge, Metric, DataState } from '../../components/ui/scientific';
import { Badge, Callout, Panel } from '../../components/ui/primitives';

function sourceUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function WatchSignalDetail({ record, narrative, mapHref, diagnosticHref }: {
  record: WatchRecord; narrative: NarrativeState; mapHref: string; diagnosticHref: string;
}) {
  const { signal: s, bundle } = record;
  const fact = bundle.facts[0], r = fact.result;
  return <div className="stack">
    <Panel title={s.headline}>
      <div className="badges"><RiskBadge level={s.risk_level} /><ConfidenceBadge level={r.confidence.level} /><FreshnessBadge freshness={r.quality.freshness} /></div>
      <p>Territoire : {s.territory.cell_id} · Production : {s.production_id}</p>
      <p>Période de validité : {s.validity.date} (date calendaire). Création : {s.created_at} (UTC).</p>
      <Metric label={`Aléa · ${r.indicator_id}`} value={r.hazard.value} unit={r.hazard.unit} kind={bundle.mode === 'demo' ? 'Valeur fictive' : 'Indicateur calculé'} />
      <p>Score : {r.risk.score ?? 'indisponible'} · Exposition : {r.exposure == null ? 'indisponible' : 'fournie dans la preuve'} · Sensibilité : {r.sensitivity == null ? 'indisponible' : 'fournie dans la preuve'}</p>
      <p>Règle : {r.rule.rule_id}@{r.rule.version} · Statut scientifique : {r.confidence.scientific_status}</p>
      <p>Confiance : {r.confidence.reasons?.join(' · ') || 'Justification non fournie'}</p>
      <p>Flags qualité : {r.quality.flags.join(', ') || 'Aucun flag fourni'}</p>
      {r.quality.freshness === 'stale' && <DataState state="stale" />}
      {r.risk.level === 'unavailable' && <DataState state="insufficient" />}
      <Callout title="Limite d’interprétation">Le niveau est repris du résultat structuré et de sa règle versionnée. La confiance et la fraîcheur sont indépendantes du niveau. Aucune causalité supplémentaire n’est déduite. La fraîcheur fournie décrit la donnée à son calcul ; vérifiez aussi la période de validité.</Callout>
      <nav className="badges" aria-label="Contexte du signal"><a className="button button-secondary" href={mapHref}>Voir le contexte carte</a><a className="button button-secondary" href={diagnosticHref}>Ouvrir le diagnostic</a></nav>
    </Panel>
    <Panel title="Provenance et sources">
      <p>Preuve : <code>{fact.evidence_id}</code> · Enregistrée : {fact.recorded_at} (UTC)</p>
      <ul className="evidence-list">{r.provenance.map((p, index) => {
        const url = sourceUrl(p.url);
        return <li key={`${p.source_id}-${index}`}><strong>{p.source_id}</strong>{bundle.mode === 'demo' && ' (fictive)'}
          <p>Observation : {p.observed_at ?? 'inconnue'} · Récupération : {p.retrieved_at ?? 'inconnue'} (UTC si date fournie)</p>
          {url ? <a href={url} rel="noreferrer">Consulter la source</a> : <span>URL de source non disponible</span>}
        </li>;
      })}</ul>
    </Panel>
    <Panel title="Restitution narrative">
      {narrative.state === 'available' ? <>
        <Badge>{narrative.audit.assisted ? 'Assisté par IA' : 'Template déterministe · sans assistance IA'}</Badge>
        {narrative.segments.map(segment => <p key={segment.evidence_id}>{segment.text} <a href="#evidence">[{segment.evidence_id}]</a></p>)}
        <p>Template : {narrative.audit.template_version} · Modèle/provider : {narrative.audit.model} · Généré : {narrative.audit.generated_at} (UTC)</p>
      </> : <Callout title={narrative.state === 'disabled' ? 'Narration désactivée' : 'Narration indisponible'}>Le signal et ses preuves restent consultables.</Callout>}
    </Panel>
    <section id="evidence" className="panel"><h2>EvidenceBundle fermé · version {bundle.bundle_version}</h2>
      <p><code>{bundle.bundle_id}</code></p><p>Signal : <code>{bundle.signal_id}</code></p>
      <details><summary>Consulter le payload factuel et l’audit narratif</summary><pre>{JSON.stringify({ signal: s, evidence_bundle: bundle, narrative }, null, 2)}</pre></details>
    </section>
  </div>;
}
