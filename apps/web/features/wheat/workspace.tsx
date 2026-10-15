import { BrandLockup } from '../../components/shell/brand';
import Link from 'next/link';
import { ThemeToggle } from '../../components/shell/theme-toggle';
import { Callout } from '../../components/ui/primitives';
import { DataState, FreshnessBadge } from '../../components/ui/scientific';
import { ApiError } from '../../lib/server/query';
import { loadWheat } from './server';
import { INDICATORS, STAGES, type WheatPortfolio } from './model';
import shapes from './basemap.json';
import './wheat.css';

export async function WheatWorkspace({params, view}: {params:URLSearchParams;view:'observation'|'diagnostic'|'watch'}) {
  let portfolios: WheatPortfolio[] = [], failure = '';
  try { portfolios = await loadWheat(params); }
  catch(error) { failure = error instanceof ApiError && error.code === 'INVALID_QUERY'
    ? 'Contexte invalide : période terminée de 1 à 366 jours, station et version explicites.'
    : 'Source indisponible. Aucun résultat de remplacement ; réessayez ultérieurement.'; }
  function href(path: string, station?: string) {
    const next = new URLSearchParams(params);
    if (station) next.set('station',station); else next.delete('station');
    return `${path}?${next}`;
  }
  const selected = portfolios.find(p => p.station_id === params.get('station')) ?? portfolios[0];
  const title = view === 'observation' ? 'Observation Map · blé tendre'
    : view === 'diagnostic' ? 'Scientific Diagnostic · blé tendre' : 'Watch · indicateurs blé';
  return <>
    <a href="#main" className="skip-link">Aller au contenu</a>
    <header className="app-header"><BrandLockup /><nav aria-label="Espaces produit" className="badges">
      <a href={href('/')} aria-current={view==='observation'?'page':undefined}>Observation</a>
      <a href={href('/diagnostic',selected?.station_id)} aria-current={view==='diagnostic'?'page':undefined}>Diagnostic</a>
      <a href={href('/watch')} aria-current={view==='watch'?'page':undefined}>Veille</a>
      <Link href="/?mode=demo">Démonstration fictive</Link>
    </nav><ThemeToggle /></header>
    <main id="main" className="app-main wheat-workspace" tabIndex={-1}>
      <h1>{title}</h1>
      <Callout title="Données réelles · statut exploratoire">Indicateurs climatiques pour blé tendre. Aucun risque agronomique complet, conseil de conduite ou stade déduit. Points station Météo-France : aucune couverture continue de la France.</Callout>
      <p>{process.env.WHEAT_STORAGE==='supabase' ? 'Lecture des calculs persistés sur Supabase.' : 'Instantanés vérifiés issus de l’ingestion réelle Météo-France ; mise à jour manuelle, aucune actualisation météo en temps réel.'}</p>
      <form action={view==='observation'?'/':`/${view==='diagnostic'?'diagnostic':'watch'}`} className="wheat-filters">
        <input type="hidden" name="mode" value="wheat" />
        {params.has('fingerprint') && <input type="hidden" name="fingerprint" value={params.get('fingerprint')!} />}
        <label className="field">Début inclus<input type="date" name="start" required defaultValue={params.get('start')??'2026-09-01'} /></label>
        <label className="field">Fin incluse<input type="date" name="end" required defaultValue={params.get('end')??'2026-09-03'} /></label>
        <label className="field">Station (facultative)<input name="station" pattern="[0-9]{8}" defaultValue={params.get('station')??''} placeholder="Identifiant à 8 chiffres" /></label>
        <label className="field">Fenêtre phénologique<select name="stage" defaultValue={params.get('stage')??''}>
          <option value="">Calendrier explicite · aucun stade</option>{Object.entries(STAGES).map(([id,label])=><option key={id} value={id}>{label} · fourni explicitement</option>)}
        </select></label>
        <button className="button button-primary" type="submit">Consulter les calculs publiés</button>
      </form>
      <p>Les dates sont les étiquettes quotidiennes de la source. Le formulaire consulte des calculs publiés ; une période ou un stade sans calcul reste absent.</p>
      {failure ? <><DataState state="source-error" /><p role="alert">{failure}</p></>
        : portfolios.length===0 ? <><DataState state="missing" /><p>Aucun portefeuille publié pour cette fenêtre, ce stade et ces paramètres. Une donnée absente ne vaut pas zéro.</p></>
        : <>
          {portfolios.some(p=>p.results.some(r=>r.freshness==='stale')) && <DataState state="stale" />}
          {view==='watch' && <Callout title="Suivi descriptif">Consultez les indicateurs et leur fraîcheur. Aucun signal de risque, classement agronomique ou notification automatique n’est produit à partir des seuils exploratoires.</Callout>}
          {view==='observation' && <section className="scientific-card" aria-labelledby="wheat-map-title">
            <h2 id="wheat-map-title">Stations disponibles · somme de températures</h2>
            <p>Points seuls, sans interpolation. La couleur repère une station, sans niveau de risque. Tableau accessible sous la carte.</p>
            <svg className="wheat-map" viewBox="0 0 560 550" role="group" aria-label="Carte des stations Météo-France disposant de calculs blé">
              <title>Localisation des stations · GDD en degrés Celsius jours</title>
              {shapes.map((d,i)=><path d={d} key={i} className="wheat-land" />)}
              {portfolios.map(p=><a key={p.station_id} href={href('/diagnostic',p.station_id)} aria-label={`${p.station_name} : ouvrir le diagnostic`}>
                <circle cx={(p.longitude+6)*35} cy={(52-p.latitude)*50} r="7" className="wheat-station" />
                <title>{`${p.station_name} · ${p.results[0].value??'indisponible'} ${p.results[0].unit}`}</title>
              </a>)}
            </svg><p className="muted">Fond Natural Earth · domaine public · projection de repérage simplifiée.</p>
          </section>}
          <div className="wheat-table-wrap" tabIndex={0} role="region" aria-label="Indicateurs par station"><table>
            <caption>Points station réels · {portfolios[0].period.start} au {portfolios[0].period.end} inclus · {portfolios.length} station(s) reçue(s)</caption>
            <thead><tr><th scope="col">Station</th><th scope="col">GDD · °C jours</th><th scope="col">Pluie · mm</th><th scope="col">Fraîcheur</th><th scope="col">Diagnostic</th></tr></thead>
            <tbody>{portfolios.map(p=><tr key={p.station_id}><th scope="row">{p.station_name} · {p.station_id}</th>
              <td>{format(p.results.find(r=>r.indicator==='gdd')?.value)}</td><td>{format(p.results.find(r=>r.indicator==='precipitation_sum')?.value)}</td>
              <td><FreshnessBadge freshness={p.results[0].freshness} /></td><td><a href={href('/diagnostic',p.station_id)}>Voir les preuves</a></td></tr>)}</tbody>
          </table></div>
          {selected && <section className="stack" aria-labelledby="wheat-details">
            <h2 id="wheat-details">{selected.station_name} · portefeuille climatique</h2>
            <p>Fenêtre : {selected.period.start} — {selected.period.end} inclus. Stade : {selected.period.stage ? STAGES[selected.period.stage] : 'Non fourni'}.</p>
            {selected.period.stage_source && <p>Source du stade fourni : {selected.period.stage_source}</p>}
            <p>Calcul du {new Date(selected.computed_at).toLocaleString('fr-FR',{timeZone:'Europe/Paris'})} (Europe/Paris) · confiance faible, faute de validation experte.</p>
            <details className="scientific-card"><summary>Paramètres, versions et contexte historique</summary>
              <dl>{Object.entries(selected.parameters).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
              <p>Empreinte des paramètres : <code>{selected.parameter_fingerprint}</code></p>
              <p>Cellule ERA5-Land explicitement associée : {selected.grid_cell??'Aucune'}. {selected.grid_mapping_source}</p>
              <p>Les références du smoke test 1991 ne suffisent pas à une normale 1991–2020. La comparaison station/grille n’est ni harmonisée ni corrigée du biais.</p>
            </details>
            <div className="wheat-indicators">{selected.results.map(r=><article key={r.indicator} className="scientific-card">
              <h3>{INDICATORS[r.indicator]}</h3><p className="wheat-value">{format(r.value)} <span>{r.unit}</span></p>
              {r.value===null && <p>Données insuffisantes · aucune valeur substituée.</p>}
              <p>Couverture exploitable : {r.available_days}/{r.expected_days} jours. {r.sequence_count!==null && `${r.sequence_count} séquence(s) qualifiée(s).`}</p>
              <p>Statut : {r.scientific_status} · confiance faible · niveau agronomique non attribué.</p>
              <FreshnessBadge freshness={r.freshness} />
              <details><summary>Méthode, seuils, sources et limites</summary>
                <p>Règle : {r.rule_id} · {r.rule_version} · production {r.production}</p>
                <p>Seuil éventuel : {r.threshold?JSON.stringify(r.threshold):'Sans seuil'}</p>
                <p>Drapeaux qualité : {r.quality_flags.join(', ')||'Aucun signalé'}</p>
                <ul>{r.scientific_sources.map(s=><li key={s}>{s.startsWith('https://')?<a href={s}>{s}</a>:s}</li>)}</ul>
                <ul>{r.limits.map(l=><li key={l}>{l}</li>)}</ul>
                <details><summary>Provenance ({r.provenance.length} reçus)</summary><pre>{JSON.stringify(r.provenance,null,2)}</pre></details>
              </details>
            </article>)}</div>
          </section>}
        </>}
      <p><a href="https://github.com/Mehdi-Sine/agriclimax/blob/codex/13-wheat-mvp/docs/codex/verification/task13/METHODS.md">Définitions, formules, paramètres et limites scientifiques</a></p>
    </main>
  </>;
}

function format(value:number|null|undefined) { return value===null || value===undefined ? 'Indisponible' : new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(value); }
