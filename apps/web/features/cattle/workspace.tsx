import { BrandLockup } from '../../components/shell/brand';
import { ThemeToggle } from '../../components/shell/theme-toggle';
import { cattleRule } from './thi';
import { loadCattle } from './load';
import { StationMap } from './station-map';
import './cattle.css';
const titles = {observation: 'Observation Map · Bovins', diagnostic: 'Scientific Diagnostic · Bovins', watch: 'Watch · Exposition thermique des bovins'};
export async function CattleWorkspace({params, view}: {params: URLSearchParams; view: keyof typeof titles}) {
  let data: Awaited<ReturnType<typeof loadCattle>>;
  try { data = await loadCattle(params); }
  catch { data = {state: 'error', station: params.get('station') ?? '29075001', start: params.get('start') ?? '', end: params.get('end') ?? '', product: params.get('product') ?? 'auto', stations: [], results: []}; }
  const result = data.results[0];
  function href(target: keyof typeof titles) {
    const next = new URLSearchParams({mode: 'live_meteofrance', production: 'cattle', indicator: 'thi', station: data.station, start: data.start, end: data.end, product: data.product});
    return `${target === 'observation' ? '/' : `/${target}`}?${next}`;
  }
  const path = view === 'observation' ? '/' : `/${view}`;
  const metrics = result?.metrics ?? [];
  const signals = metrics.filter(m => m.episodes !== null && m.episodes > 0);
  return <>
    <a className="skip-link" href="#main">Aller au contenu</a>
    <header className="app-header cattle-header"><BrandLockup /><nav aria-label="Espaces produit">{(['observation','diagnostic','watch'] as const).map(target => <a key={target} className="button button-secondary" href={href(target)} aria-current={target === view ? 'page' : undefined}>{target === 'observation' ? 'Observation' : target === 'watch' ? 'Veille' : 'Diagnostic'}</a>)}</nav><ThemeToggle /></header>
    <main id="main" className="app-main cattle-workspace" tabIndex={-1}>
      <h1>{titles[view]}</h1><p><strong>Live Météo-France · Production cattle · Statut {cattleRule.scientific_status}</strong></p>
      <p>{cattleRule.notice}</p>
      <form action={path} className="filters">
        <input type="hidden" name="mode" value="live_meteofrance" /><input type="hidden" name="production" value="cattle" /><input type="hidden" name="indicator" value="thi" />
        <label className="field">Station<select name="station" defaultValue={data.station}>{data.stations.length ? data.stations.map(s => <option key={s.id} value={s.id}>{s.name} · {s.id}</option>) : <option value={data.station}>{data.station}</option>}</select></label>
        <label className="field">Début<input name="start" type="date" required defaultValue={data.start} /></label>
        <label className="field">Fin incluse<input name="end" type="date" required defaultValue={data.end} /></label>
        <label className="field">Support temporel<select name="product" defaultValue={data.product}><option value="auto">Auto · horaire complet sinon synthèse quotidienne</option><option value="climatology">Synthèse quotidienne · TM + UM</option><option value="observations">Échantillons horaires disponibles</option></select></label>
        <button className="button button-primary" type="submit">Consulter</button>
      </form>
      <p>Points de station, sans interpolation ni localisation d’élevage. La présence de bovins et leur sensibilité ne sont pas mesurées.</p>
      {view === 'observation' && <StationMap stations={data.stations} selected={data.station} href={href('observation')} value={result?.value ?? null} />}
      {data.state === 'error' ? <p role="alert">Données indisponibles ou paramètres invalides. Aucun remplacement fictif.</p> : result && <>
        <section className="panel" aria-label="Résultat THI"><h2>THI · {result.status === 'unavailable' ? 'Indisponible' : result.status === 'insufficient' ? 'Couverture insuffisante' : 'Disponible'}</h2>
          {result.reason && <p>Raison : {result.reason === 'humidity_missing' ? 'Humidité manquante : aucun THI calculé.' : result.reason}</p>}
          <p><strong>{result.value === null ? 'Valeur indisponible' : `${result.value.toFixed(2)} THI`}</strong> · {result.resolution === 'daily' ? 'Maximum des synthèses journalières, pas un THI maximum horaire' : 'Maximum des échantillons horaires observés'}</p>
          <p>Confiance : faible · couverture {(result.confidence.coverage*100).toFixed(1)} % · fraîcheur : {result.freshness} · niveau : {result.level ?? 'indisponible'}.</p>
          <p>Les jours synthétiques utilisent THI(TM, UM). Ce calcul ne donne ni la moyenne ni le maximum des THI horaires. Les durées horaires décrivent des échantillons réguliers, sans mesure continue entre eux. Les trous interrompent les épisodes.</p>
        </section>
        {view === 'watch' && <section className="panel"><h2>Épisodes d’exposition observés</h2>{signals.length ? signals.map(m => <article key={m.threshold}><h3>THI strictement supérieur à {m.threshold}</h3><p>{m.episodes} épisode(s), durée maximale observée {m.max_episode_duration} {m.unit}. {m.partial ? 'Dépassements et durées partiels ; épisodes = fragments observés.' : 'Période complète.'}</p><a href={href('diagnostic')}>Examiner les preuves et limites</a></article>) : <p>{result.status === 'unavailable' || result.status === 'insufficient' ? 'Données insuffisantes pour conclure sur les épisodes.' : 'Aucun dépassement observé du seuil configuré sur cette période. Cela ne décrit pas l’état des animaux.'}</p>}</section>}
        <section className="panel"><h2>Exposition cumulée</h2><div className="cattle-table" tabIndex={0} role="region" aria-label="Tableau des dépassements, défilement horizontal"><table><caption>Seuils exploratoires contextuels · dépassement strict &gt; · {result.confidence.coverage < 1 ? 'dépassements et durées = bornes inférieures ; épisodes = fragments observés' : 'période complète'}</caption><thead><tr><th>Seuil THI</th><th>Nombre {result.resolution === 'hourly' ? 'd’heures' : 'de jours'}</th><th>Jours concernés</th><th>Épisodes</th><th>Durée max.</th><th>Cumul</th></tr></thead><tbody>{metrics.map(m => <tr key={m.threshold}><td>{m.threshold}</td><td>{m.count ?? 'indisponible'}</td><td>{m.days_above ?? 'indisponible'}</td><td>{m.episodes ?? 'indisponible'}</td><td>{m.max_episode_duration ?? 'indisponible'} {m.unit}</td><td>{m.cumulative_exposure?.toFixed(2) ?? 'indisponible'} {m.exposure_unit}</td></tr>)}</tbody></table></div></section>
        <section className="panel"><h2>Récupération nocturne climatique</h2><p>{result.night_recovery.nights_without_recovery === null ? 'Indisponible : série horaire couvrant une nuit entière requise.' : `${result.night_recovery.nights_without_recovery} nuit(s) sans passage sous ${result.night_recovery.threshold} THI, sur ${result.night_recovery.complete_nights} nuit(s) complète(s).`}</p><p>Nuit conventionnelle {cattleRule.night_start_hour} h–{cattleRule.night_end_hour} h, {cattleRule.night_timezone}. Seuil exploratoire. Ce constat ne mesure pas la récupération physiologique.</p><p>Anomalie THI indisponible : Task 12 ne fournit pas de référence historique d’humidité ou de THI homologue.</p></section>
        <section className="panel"><h2>Synthèses journalières · UTC</h2><div className="cattle-table" tabIndex={0} role="region" aria-label="Tableau quotidien, défilement horizontal"><table><thead><tr><th>Date</th><th>THI moyen horaire</th><th>THI max. horaire</th><th>THI synthétique</th><th>Couverture</th></tr></thead><tbody>{result.daily.map(d => <tr key={d.date}><td>{d.date}</td><td>{d.thi_mean?.toFixed(2) ?? 'indisponible'}</td><td>{d.thi_max?.toFixed(2) ?? 'indisponible'}</td><td>{d.thi_synthetic?.toFixed(2) ?? 'indisponible'}</td><td>{(100*d.coverage).toFixed(0)} %</td></tr>)}</tbody></table></div></section>
        <section className="panel"><h2>Scientific Diagnostic · méthode et provenance</h2><p>{result.rule_id} · version {result.rule_version} · {result.scientific_status}</p><p>Formule {result.formula_id} : <code>{result.formula}</code>. T en °C ; RH en % ; indice sans dimension.</p><p>Classes : {cattleRule.classes.map(c => `${c.level} à partir de ${c.minimum} inclus`).join(' ; ')}. L’égalité au seuil appartient à cette classe mais n’est pas un dépassement strict.</p><p>Source : <a href={result.scientific_source.url}>{result.scientific_source.title}</a> · {result.scientific_source.authors} ({result.scientific_source.year}). {result.scientific_source.scope}</p><details><summary>Résultat structuré complet, période, qualité et preuves source</summary><pre className="cattle-json">{JSON.stringify(result, null, 2)}</pre></details></section>
      </>}
      <section className="panel"><h2>Limites à conserver dans toute interprétation</h2><p>Non pris en compte : {cattleRule.limits.join(' ; ')}.</p><p>{cattleRule.notice}</p></section>
    </main>
  </>;
}
