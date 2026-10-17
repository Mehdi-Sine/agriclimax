import 'server-only';
import type { DiagnosticDto } from './diagnostic-dto';

export function LiveDiagnostic({data}:{data:DiagnosticDto}) {
  return <section className="scientific-card"><h2>Méthode, preuves et qualité</h2>{data ? <>
    <p>Règle : {data.rule_id} · version {data.rule_version} · statut {data.scientific_status}. Confiance faible.</p>
    {data.production==='wheat' ? <>
      <p>Seuils et règle : {data.threshold_label}</p>
      <p>Couverture : {data.available_days}/{data.expected_days} jours. Paramètres : {data.parameter_fingerprint}.</p>
      <p>Source scientifique : {data.scientific_sources.join(' ; ')}</p>
      <p>Limites : {data.limits.join(' ; ')}</p>
      <p>Référence ERA5-Land : {data.grid_cell ?? 'aucune cellule associée'}. Les références acquises ne constituent pas une normale nationale 1991–2020.</p>
    </> : <>
      <p>Formule : <code>{data.formula}</code> · T en °C, RH en %, THI sans dimension.</p>
      <p>Source scientifique : <a href={data.scientific_source.url}>{data.scientific_source.title}</a> ({data.scientific_source.year}). {data.scientific_source.scope}</p>
      <p>Seuil contextuel strictement supérieur à {data.threshold} THI, non universel.</p>
      <p>Limites : {data.limits.join(' ; ')}. {data.notice}</p>
    </>}
    <p>Qualité : {data.quality_flags.join(' ; ') || 'aucun drapeau signalé'}.</p>
  </> : <p>Diagnostic indisponible : aucun résultat reçu. Aucune méthode ou preuve inventée.</p>}</section>;
}
