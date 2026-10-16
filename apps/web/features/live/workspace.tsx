import Link from 'next/link';
import { BrandLockup } from '../../components/shell/brand';
import { ThemeToggle } from '../../components/shell/theme-toggle';
import { cattleRule } from '../cattle/thi';
import shapes from '../wheat/basemap.json';
import { liveContext, liveHref, VIEWS, type LiveView } from './context';
import { loadLive } from './load';
import { LiveFilters } from './filters';
import './live.css';

const format = (value: number | null | undefined) => value == null ? 'Indisponible' : new Intl.NumberFormat('fr-FR', {maximumFractionDigits:2}).format(value);
export async function LiveWorkspace({params, view}: {params:URLSearchParams; view:LiveView}) {
  const context = liveContext(params);
  const data = await loadLive(context);
  const isWheat = context.production === 'wheat';
  const selectedId = context.station ?? (isWheat ? data.portfolios[0]?.station_id : data.cattle?.station) ?? '';
  if (selectedId) context.query.set('station', selectedId);
  const portfolio = data.portfolios.find(p => p.station_id === selectedId);
  const wheat = portfolio?.results.find(r => r.indicator === context.indicator);
  const cattle = data.cattle?.results[0];
  const metric = cattle?.metrics[0];
  const value = isWheat ? wheat?.value : context.indicator === 'thi' ? cattle?.value : context.indicator === 'days_above' ? metric?.days_above : metric?.episodes;
  const unit = isWheat ? wheat?.unit ?? '' : context.indicator === 'thi' ? 'THI' : context.indicator === 'days_above' ? 'jours' : 'épisodes';
  const freshness = (isWheat ? wheat?.freshness : cattle?.freshness) ?? 'unknown';
  const result = isWheat ? wheat : cattle;
  const retrieved = [...new Set((result?.provenance ?? []).flatMap(p => typeof p === 'object' && p !== null && 'retrieved_at' in p && typeof p.retrieved_at === 'string' ? [p.retrieved_at] : []))].sort();
  const label = context.indicators[context.indicator] ?? context.indicator;
  const name = portfolio?.station_name ?? data.stations.find(s => s.id === selectedId)?.name ?? selectedId;
  const stations = [...data.stations];
  for (const p of data.portfolios) if (!stations.some(s=>s.id===p.station_id)) stations.push({id:p.station_id, name:p.station_name, latitude:p.latitude, longitude:p.longitude, altitude_m:0, metadata:{}, retrieved_at:p.computed_at});
  const stationValue = (id:string) => {
    if(isWheat) return data.portfolios.find(p=>p.station_id===id)?.results.find(r=>r.indicator===context.indicator)?.value;
    if(!data.cattle || context.product==='observations') return null;
    const published=data.publication?.cattle.find(c=>c.station_id===id);
    return context.indicator==='thi'?published?.value:context.indicator==='days_above'?published?.metrics[0]?.days_above:published?.metrics[0]?.episodes;
  };
  const state = data.failure ? 'error' : !result ? 'absent' : value == null ? 'insufficient' : cattle?.status === 'insufficient' ? 'insufficient' : freshness === 'stale' ? 'stale' : 'available';
  const stateLabels = {error:'Source indisponible ou contexte invalide', absent:'Aucun calcul publié pour cette sélection', insufficient:'Données insuffisantes', stale:'Données anciennes', available:'Données disponibles'};
  return <>
    <a className="skip-link" href="#main">Aller au contenu</a>
    <header className="app-header live-header"><BrandLockup /><nav aria-label="Espaces produit">{(Object.keys(VIEWS) as LiveView[]).map(target => <a key={target} href={liveHref(target,context.query)} aria-current={target===view?'page':undefined}>{VIEWS[target]}</a>)}</nav><ThemeToggle /></header>
    <main id="main" className="app-main live-workspace" tabIndex={-1}>
      <h1>{VIEWS[view]} · {isWheat?'Blé tendre':'Bovins'}</h1>
      <p><strong>Mode live · données réelles · statut scientifique : exploratory (exploratoire)</strong></p>
      <LiveFilters key={context.query.toString()} action={view==='observation'?'/':`/${view}`} production={context.production} indicator={context.indicator} start={context.start} end={context.end} station={selectedId} stations={stations} product={context.product} stage={context.query.get('stage')??''} fingerprint={context.query.get('fingerprint')??''} />
      {data.latest && <nav className="live-actions" aria-label="Dernière publication"><Link href={`/?mode=live_meteofrance&production=${context.production}&indicator=${context.indicator}`}>Consulter la dernière publication quotidienne réussie</Link></nav>}
      <section className="scientific-card" aria-label="Traçabilité de la sélection">
        <h2>{label} · {name || 'aucune station sélectionnée'}</h2>
        <p>Source : Météo-France · {isWheat?'calculs blé publiés, lecture Supabase sans instantané local':'calcul THI versionné Task 14 publié par Task 17, sans recalcul à la lecture'}. Support : points station, sans interpolation.</p>
        <p>Date / période : {context.start} — {context.end} inclus · UTC, étiquettes quotidiennes de la source.</p>
        <p>Fraîcheur : {freshness === 'stale' ? 'ancienne (stale)' : freshness === 'fresh' ? 'récente (fresh)' : 'inconnue (unknown)'}. Date de publication météo inconnue.{data.publication && ` Calcul daté du ${data.publication.computed_at} (UTC).`}</p>
        <p>Dernière publication quotidienne réussie : {data.latest ? `calcul du ${data.latest.computed_at} · UTC ; fenêtre ${data.latest.start} — ${data.latest.end}` : 'aucune publication reçue'}.</p>
        <p>Publication de la sélection : {data.publication ? `calcul du ${data.publication.computed_at} · UTC ; identifiant ${data.publication.key}` : 'aucune pour cette fenêtre exacte'}.</p>
        <p>L’instant exact de publication en base n’est pas enregistré ; la date du calcul ne le remplace pas.</p>
        <p>État du dernier run quotidien : inconnu dans cette lecture. Un échec ne remplace pas la dernière publication réussie ; les résultats conservés vieillissent selon leur période source. Publication réussie ne signifie pas dernier run réussi.</p>
        <p>Récupération source : {retrieved.length ? `${retrieved[0]}${retrieved.length > 1 ? ` — ${retrieved[retrieved.length-1]}` : ''} · UTC` : 'date inconnue, aucun reçu disponible'}.</p>
        <p role="status" data-state={state}>{stateLabels[state]} · <strong>{format(value)} {value == null ? '' : unit}</strong></p>
        {data.failure && <p role="alert">{data.failure}</p>}
        {!data.failure && !result && <p>Indisponibilité : aucun résultat pour la station, l’indicateur, la période et les paramètres demandés. Une donnée absente ne vaut pas zéro.</p>}
        {result && value == null && <p>Indisponibilité : {isWheat?'couverture ou référence historique insuffisante':cattle?.reason ?? 'paires température / humidité insuffisantes'}.</p>}
        {cattle && <><p>Support utilisé : {cattle.resolution === 'daily' ? 'synthèse quotidienne THI(TM, UM), maximum des jours disponibles ; ni moyenne ni maximum horaire' : 'échantillons horaires observés'}. Couverture : {(cattle.confidence.coverage*100).toFixed(1)} %.</p>{cattle.quality_flags.filter(f=>f.includes('daily_synthetic_used')).map(f=><p key={f}>Changement de support explicite : horaire indisponible ou incomplet, quotidien synthétique utilisé ({f}).</p>)}{metric?.partial && context.indicator !== 'thi' && <p>Comptages = bornes inférieures ; épisodes = fragments observés, les trous interrompent les séquences.</p>}</>}
        <p>Limites : indicateurs climatiques exploratoires, confiance faible ; aucun risque agronomique complet, diagnostic clinique ou conseil automatique. Catalogue disponible ≠ observations complètes. Aucune couverture continue de France.</p>
      </section>
      {data.catalogueFailure && <p role="alert">Catalogue de stations indisponible. Seuls les points des calculs publiés reçus sont représentés.</p>}
      {view === 'observation' && <section className="scientific-card" aria-labelledby="live-map-title">
        <h2 id="live-map-title">Carte · {label}</h2>
        <p>Les nombres représentent l’indicateur sélectionné ({unit || 'unité indiquée avec le résultat'}). Les points vides signalent une valeur non disponible ; pour les bovins, sélectionnez une station pour consulter son indicateur publié. La couleur ne représente pas un niveau de risque.</p>
        <svg className="live-map" viewBox="0 0 560 550" role="group" aria-label="Carte des indicateurs live par station">
          <title>France métropolitaine et Corse · points station Météo-France</title>
          {shapes.map((d,i)=><path key={i} d={d} className="live-land" />)}
          {stations.map(s => {
            const v = stationValue(s.id);
            const x=(s.longitude+6)*35, y=(52-s.latitude)*50;
            return <a key={s.id} href={liveHref('observation',context.query,s.id)} aria-label={`${s.name} · ${s.id} · ${format(v)}${v == null ? '' : ` ${unit}`} · sélectionner`} aria-current={s.id===selectedId?'true':undefined}>
              <circle cx={x} cy={y} r={s.id===selectedId?9:6} className={v==null?'live-point live-empty':'live-point'} />
              {v!=null && <text x={x+10} y={y-9}>{format(v)}</text>}
              <title>{`${s.name} · ${format(v)}${v == null ? '' : ` ${unit}`}`}</title>
            </a>;
          })}
        </svg>
        <p>Fond Natural Earth · domaine public · projection de repérage simplifiée. {stations.length} stations reçues, aucune valeur extrapolée. Les trois mailles ERA5 acquises en Task 15 restent un support distinct et ne comblent pas les stations.</p>
        {!stations.length && <p>Aucun point reçu : carte sans résultat. La source n’est pas remplacée par des fixtures.</p>}
        <div className="live-table" tabIndex={0} role="region" aria-label="Sélection accessible des stations"><table><caption>Valeurs reçues · {label}</caption><thead><tr><th>Station</th><th>Valeur</th><th>Sélection</th></tr></thead><tbody>{stations.map(s=>{const v=stationValue(s.id);return <tr key={s.id}><th scope="row">{s.name} · {s.id}</th><td>{format(v)} {v == null ? '' : unit}</td><td><a href={liveHref('observation',context.query,s.id)}>Sélectionner {s.name}</a></td></tr>;})}</tbody></table></div>
      </section>}
      {selectedId && <nav className="live-actions" aria-label="Explorer la station">{(['diagnostic','history','watch'] as const).map(target=><a className="button button-secondary" key={target} href={liveHref(target,context.query)}>{VIEWS[target]} · {name}</a>)}</nav>}
      {view === 'diagnostic' && <section className="scientific-card"><h2>Méthode, preuves et qualité</h2>{result ? <>
        <p>Règle : {result.rule_id} · version {result.rule_version} · statut {result.scientific_status}. Confiance faible.</p>
        {wheat && <><p>Couverture : {wheat.available_days}/{wheat.expected_days} jours. Paramètres : {portfolio?.parameter_fingerprint}.</p><p>Source scientifique : {wheat.scientific_sources.join(' ; ')}</p><p>Limites : {wheat.limits.join(' ; ')}</p><p>Référence ERA5-Land : {portfolio?.grid_cell ?? 'aucune cellule associée'}. Les références acquises ne constituent pas une normale nationale 1991–2020.</p></>}
        {cattle && <><p>Formule : <code>{cattle.formula}</code> · T en °C, RH en %, THI sans dimension.</p><p>Source scientifique : <a href={cattle.scientific_source.url}>{cattle.scientific_source.title}</a> ({cattle.scientific_source.year}). {cattle.scientific_source.scope}</p><p>Seuil contextuel strictement supérieur à {metric?.threshold} THI, non universel.</p><p>Limites : {cattle.limits.join(' ; ')}. {cattle.notice}</p></>}
        <p>Qualité : {result.quality_flags.join(' ; ') || 'aucun drapeau signalé'}.</p>
        <details><summary>Résultat structuré et provenance source</summary><pre>{JSON.stringify(isWheat?portfolio:cattle,null,2)}</pre></details>
      </> : <p>Diagnostic indisponible : aucun résultat reçu. Aucune méthode ou preuve inventée.</p>}</section>}
      {view === 'history' && <section className="scientific-card"><h2>Historique · {label}</h2>
        {isWheat ? <><p>Calcul publié pour la fenêtre sélectionnée. Changez les dates pour consulter une autre fenêtre publiée ; aucun calcul journalier n’est déduit d’un cumul.</p>{wheat && <div className="live-table"><table><caption>Historique des calculs reçus pour la sélection</caption><thead><tr><th>Période source</th><th>Valeur</th><th>Date du calcul · UTC</th><th>Fraîcheur</th></tr></thead><tbody><tr><td>{portfolio?.period.start} — {portfolio?.period.end}</td><td>{format(wheat.value)} {wheat.unit}</td><td>{portfolio?.computed_at}</td><td>{wheat.freshness}</td></tr></tbody></table></div>}{!wheat && <p>Historique absent pour cette fenêtre. Aucun point interpolé.</p>}</> : <><p>Synthèses quotidiennes publiées par le pipeline depuis les observations de la période, jours absents conservés. Les épisodes et dépassements restent des métriques de période, sans ventilation artificielle.</p>{cattle && <div className="live-table" tabIndex={0} role="region" aria-label="Série THI quotidienne"><table><caption>THI quotidien · UTC · {cattle.resolution === 'daily'?'synthétique TM + UM':'horaire complet requis pour chaque jour'}</caption><thead><tr><th>Date</th><th>THI synthétique</th><th>THI moyen horaire</th><th>THI maximum horaire</th><th>Couverture</th></tr></thead><tbody>{cattle.daily.map(d=><tr key={d.date}><td>{d.date}</td><td>{format(d.thi_synthetic)}</td><td>{format(d.thi_mean)}</td><td>{format(d.thi_max)}</td><td>{(d.coverage*100).toFixed(0)} %</td></tr>)}</tbody></table></div>}{!cattle && <p>Historique indisponible : source non reçue.</p>}</>}
      </section>}
      {view === 'watch' && <section className="scientific-card"><h2>Veille descriptive · {label}</h2><p>Suivi de la station et de la période sélectionnées. Aucun signal fictif, notification automatique ou classement de risque agronomique.</p>{!result || value == null ? <p>Veille indisponible pour cette sélection : données absentes ou insuffisantes, aucune conclusion sur une absence de risque.</p> : isWheat ? <p>Valeur publiée : {format(value)} {unit}. Consultez la fraîcheur et les preuves avant interprétation. Les seuils exploratoires ne produisent pas d’alerte agronomique.</p> : <p>{metric?.episodes == null ? 'Épisodes indisponibles.' : metric.episodes > 0 ? `${metric.episodes} épisode(s) observé(s) au-dessus de ${metric.threshold} THI ; durée maximale ${metric.max_episode_duration} ${metric.unit}.` : 'Aucun dépassement observé du seuil configuré sur les données disponibles ; cela ne décrit pas l’état des animaux.'} {metric?.partial ? 'Couverture partielle : fragments observés uniquement.' : ''}</p>}<a href={liveHref('diagnostic',context.query)}>Examiner les preuves et limites</a></section>}
      <section className="scientific-card"><h2>Limites scientifiques et disponibilité</h2><p>{isWheat?'Blé : fenêtres calendaires ou stades explicitement fournis, aucun stade inféré. Anomalies seulement si référence homologue suffisante ; une absence ne vaut jamais zéro.':'Bovins : '+cattleRule.notice+' Facteurs non mesurés : '+cattleRule.limits.join(', ')+'.'}</p><p>Station et grille ERA5-Land distinctes ; aucune interpolation, présence de production ou sensibilité biologique inférée. Pas de remplacement par des instantanés locaux en mode live.</p></section>
      <p><Link href="/?mode=demo">Ouvrir la démonstration · données fictives explicites</Link></p>
    </main>
  </>;
}
