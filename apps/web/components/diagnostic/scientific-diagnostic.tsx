import type { ReactNode } from 'react';
import { SCIENTIFIC_STATUSES, supplied, timestamp, type DiagnosticData, type DiagnosticResult } from '../../lib/diagnostic';
import { Badge, Callout } from '../ui/primitives';
import { ConfidenceBadge, DataState, EvidenceList, FreshnessBadge, Metric, RiskBadge, RiskLegend } from '../ui/scientific';

function Section({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return <section className="scientific-card" aria-labelledby={id}><h2 id={id}>{title}</h2>{children}</section>;
}

function Composition({ label, definition, value }: { label: string; definition: string; value: Record<string, unknown> | null | undefined }) {
  return <section className="diagnostic-factor"><h3>{label}</h3><p className="muted">{definition}</p>
    {value && Object.keys(value).length ? <dl className="diagnostic-facts">{Object.entries(value).map(([key, item]) =>
      <div key={key}><dt>{key}</dt><dd>{supplied(item)}</dd></div>)}</dl>
      : <p><strong>Non disponible</strong> · aucune valeur fournie, ne vaut pas zéro.</p>}
  </section>;
}

function Provenance({ result }: { result: DiagnosticResult }) {
  return <Section title="Provenance" id="provenance">
    {result.provenance.length ? result.provenance.map((source, index) => <article key={index} className="diagnostic-source">
      <h3>{source.source_id || 'Source non renseignée'}</h3>
      <dl className="diagnostic-facts">
        <div><dt>Observation</dt><dd>{timestamp(source.observed_at)}</dd></div>
        <div><dt>Récupération</dt><dd>{timestamp(source.retrieved_at)}</dd></div>
        {Object.entries(source).filter(([key]) => !['source_id', 'observed_at', 'retrieved_at'].includes(key)).map(([key, value]) =>
          <div key={key}><dt>{key}</dt><dd>{supplied(value)}</dd></div>)}
      </dl>
    </article>) : <p>Source non renseignée</p>}
    <p className="muted">Les identifiants de source ne constituent pas à eux seuls une référence bibliographique ou une validation.</p>
  </Section>;
}

export function ScientificDiagnostic({ data }: { data: DiagnosticData }) {
  if (data.state !== 'available') return <div className="stack"><DataState state={data.state} /><p>{data.message}</p></div>;
  const { result, series } = data;
  const quality = result.quality;
  return <div className="stack" data-demo={data.mode === 'demo' || undefined}>
    {data.mode === 'demo' && <DataState state="demo" />}
    <Section title="Résultat et composition" id="composition">
      <p>Cellule <strong>{result.cell_id}</strong> · {result.production_id} · {result.indicator_id}</p>
      <p>Validité : <time dateTime={result.valid_date}>{result.valid_date}</time> · date calendaire</p>
      <div className="badges"><RiskBadge level={result.risk.level} /><ConfidenceBadge level={result.confidence.level} /><FreshnessBadge freshness={quality.freshness} /></div>
      {result.risk.level === 'unavailable' && <Callout title="Résultat indisponible — conclusion impossible">Un risque indisponible ne signifie pas un risque faible ou nul. Vérifiez les données insuffisantes et les flags qualité ci-dessous.</Callout>}
      {quality.flags.includes('missing_data') && <DataState state="insufficient" />}
      {quality.freshness === 'stale' && <DataState state="stale" />}
      <div className="diagnostic-factors">
        <section className="diagnostic-factor"><h3>Hazard · aléa</h3><p className="muted">Intensité ou probabilité du phénomène climatique.</p>
          <Metric label={result.indicator_id} value={result.hazard.value} unit={result.hazard.unit || 'Unité non renseignée'} kind={data.mode === 'demo' ? 'Valeur fictive · nature observation/prévision non renseignée' : 'Nature observation / calcul / prévision non renseignée'} />
          {result.hazard.value === null && <p>Aléa non disponible.</p>}
          <p>Classe d’aléa : {supplied(result.hazard.class)}</p>
          {Object.entries(result.hazard).filter(([key]) => !['value', 'unit', 'class'].includes(key)).map(([key, value]) => <p key={key}>{key} : {supplied(value)}</p>)}
        </section>
        <Composition label="Exposure · exposition" definition="Présence ou importance de la production concernée." value={result.exposure} />
        <Composition label="Sensitivity · sensibilité" definition="Dépendance au stade et au contexte biologique." value={result.sensitivity} />
        <section className="diagnostic-factor"><h3>Risk · risque</h3><RiskBadge level={result.risk.level} />
          <p>Score fourni : {supplied(result.risk.score)} · unité/échelle non renseignées.</p>
          <p className="muted">Résultat explicite de la règle versionnée. La composition n’est pas recalculée ici.</p></section>
      </div>
    </Section>
    <Section title="Confidence · confiance et statut scientifique" id="confidence">
      <ConfidenceBadge level={result.confidence.level} />
      <p>La confiance décrit la qualité et la complétude des données et le niveau de validation scientifique ; elle ne décrit pas l’intensité du risque.</p>
      <Badge>{result.confidence.scientific_status}</Badge><p>{SCIENTIFIC_STATUSES[result.confidence.scientific_status]}</p>
      <h3>Motifs fournis</h3>{result.confidence.reasons?.length ? <EvidenceList items={result.confidence.reasons} /> : <p>Motifs non renseignés.</p>}
      <p className="muted">Le statut de la règle elle-même n’est pas fourni séparément par RiskResult V1.</p>
    </Section>
    <Section title="Fenêtre temporelle et série de résultats" id="temporal">
      <dl className="diagnostic-facts"><div><dt>Début de fenêtre de calcul</dt><dd>{supplied(quality.window_start)}</dd></div>
        <div><dt>Fin de fenêtre de calcul</dt><dd>{supplied(quality.window_end)}</dd></div></dl>
      <p className="muted">Bornes fournies par le moteur, dates calendaires. La période consultée n’est pas la fenêtre de calcul. Aucun jour manquant n’est interpolé.</p>
      {series.length < 2 && <p>Série temporelle insuffisante : un seul résultat disponible, aucune tendance déduite.</p>}
      <div className="diagnostic-table-wrap"><table className="diagnostic-table"><caption>Valeurs reçues · aucune courbe ou prévision reconstruite</caption>
        <thead><tr><th scope="col">Validité</th><th scope="col">Aléa · unité</th><th scope="col">Risque</th><th scope="col">Confiance</th><th scope="col">Fraîcheur</th></tr></thead>
        <tbody>{series.map((point, index) => <tr key={index}><th scope="row">{point.valid_date}</th><td>{supplied(point.hazard.value)} {point.hazard.unit}</td><td><RiskBadge level={point.risk.level} /></td><td><ConfidenceBadge level={point.confidence.level} /></td><td><FreshnessBadge freshness={point.quality.freshness} /></td></tr>)}</tbody>
      </table></div>
    </Section>
    <Section title="Freshness · fraîcheur et qualité des données" id="quality">
      <FreshnessBadge freshness={quality.freshness} /><p>Fraîcheur fournie par le moteur ; aucune durée limite déduite dans l’interface.</p>
      <dl className="diagnostic-facts">
        <div><dt>Couverture · fraction fournie, de 0 à 1</dt><dd>{supplied(quality.coverage)}</dd></div>
        <div><dt>Résolution source</dt><dd>{supplied(quality.source_resolution)}</dd></div>
        <div><dt>Données imputées</dt><dd>{supplied(quality.imputed)}</dd></div>
        {Object.entries(quality).filter(([key]) => !['freshness', 'flags', 'coverage', 'source_resolution', 'imputed', 'window_start', 'window_end'].includes(key)).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{supplied(value)}</dd></div>)}
      </dl><h3>Flags qualité fournis</h3>{quality.flags.length ? <EvidenceList items={quality.flags} /> : <p>Aucun flag signalé ; cela ne garantit pas l’absence de limites.</p>}
    </Section>
    <Provenance result={result} />
    <Section title="Règle, version et explication des niveaux" id="method">
      <dl className="diagnostic-facts"><div><dt>rule_id</dt><dd>{result.rule.rule_id}</dd></div><div><dt>Version exacte</dt><dd>{result.rule.version}</dd></div></dl>
      <RiskLegend /><p>Faible, modéré, élevé et critique sont les classes transmises par cette règle. « Indisponible » signifie qu’aucune classe exploitable n’est fournie.</p>
      <Callout title="Seuils et méthode non renseignés">RiskResult V1 ne transporte pas les seuils, paramètres, équation ou lien de méthode de cette version. Les couleurs n’en définissent aucun ; ces niveaux ne sont pas comparables entre règles sans leur documentation.</Callout>
      <p><a href="https://github.com/Mehdi-Sine/agriclimax/blob/main/docs/science/SCIENTIFIC_GOVERNANCE.md">Lire la gouvernance scientifique</a> · principes généraux, pas la méthode de cette règle.</p>
    </Section>
    <Section title="Limites d’interprétation" id="limits">
      <EvidenceList items={[
        'Limites spécifiques de méthode non renseignées dans le contrat V1.',
        'La nature observation, indicateur calculé ou prévision n’est pas garantie par ce payload.',
        ...(!result.exposure ? ['Exposition non disponible : aucune contribution ne peut être vérifiée.'] : []),
        ...(!result.sensitivity ? ['Sensibilité non disponible : aucun stade biologique ne peut être vérifié.'] : []),
        'Une valeur faible n’est pas une absence de risque ; une donnée absente ne vaut pas zéro.',
        ...(data.mode === 'demo' ? ['Résultat fictif, exploratoire ; ne pas utiliser pour une décision agronomique.'] : []),
      ]} />
    </Section>
  </div>;
}
