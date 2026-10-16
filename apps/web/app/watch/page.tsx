import { LiveWorkspace } from '../../features/live/workspace';
import { isLiveWorkspace } from '../../features/live/context';
import 'server-only';
import { BrandLockup } from '../../components/shell/brand';
import { ThemeToggle } from '../../components/shell/theme-toggle';
import { Sheet, Callout } from '../../components/ui/primitives';
import { DataState, RISK_LABELS } from '../../components/ui/scientific';
import { FixtureWatchRepository } from '../../features/watch/server/repository';
import { narrate } from '../../features/watch/server/narrative';
import { WatchSignalCard } from '../../features/watch/signal-card';
import { WatchSignalDetail } from '../../features/watch/signal-detail';
import { watchFilters, contextLink, signalDiagnosticLink, RISK_LEVELS } from '../../features/watch/context';
import type { WatchRecord } from '../../features/watch/model';
import './watch.css';
import { WheatWorkspace } from '../../features/wheat/workspace';

export default async function WatchPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') params.append(key, value);
    else if (Array.isArray(value)) for (const item of value) params.append(key, item);
  }
  if (isLiveWorkspace(params)) return await LiveWorkspace({params, view:'watch'});
  if (params.get('mode') === 'wheat') return <WheatWorkspace params={params} view="watch" />;
  const filters = watchFilters(params);
  const demo = !params.has('mode') || params.get('mode') === 'demo';
  const detailed = params.get('density') === 'detailed';
  let records: WatchRecord[] = [], failed = false;
  if (demo) {
    try { records = await new FixtureWatchRepository().list(filters); } catch { failed = true; }
  }
  const selected = records.find(record => record.signal.signal_id === params.get('signal'));
  function href(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) { if (value === null) next.delete(key); else next.set(key, value); }
    return `/watch?${next}`;
  }
  const filterForm = <form action="/watch" className="filters">
    <input type="hidden" name="mode" value={demo ? 'demo' : 'live'} />
    <input type="hidden" name="density" value={detailed ? 'detailed' : 'compact'} />
    {['indicator', 'compare', 'rule', 'version', 'bbox', 'zoom', 'limit'].map(key => params.has(key) ? <input key={key} type="hidden" name={key} value={params.get(key)!} /> : null)}
    <label className="field">Production<select name="production" defaultValue={filters.productionId ?? ''}><option value="">Toutes les productions</option><option value="wheat_soft">Blé tendre</option><option value="dairy_cattle">Bovin lait</option>{filters.productionId && !['wheat_soft', 'dairy_cattle'].includes(filters.productionId) && <option>{filters.productionId}</option>}</select></label>
    <label className="field">Territoire<input name="territory" defaultValue={filters.territoryId ?? ''} placeholder={demo ? 'Ex. demo-001' : 'Identifiant du territoire'} /></label>
    <label className="field">Niveau de risque<select name="risk" defaultValue={filters.riskLevel ?? ''}><option value="">Tous les niveaux</option>{RISK_LEVELS.map(level => <option key={level} value={level}>{RISK_LABELS[level]}</option>)}</select></label>
    <label className="field">Période<input type="date" name="date" defaultValue={filters.date ?? ''} /></label>
    <button className="button button-primary" type="submit">Appliquer</button>
    <a className="button button-secondary" href={`/watch?mode=${demo ? 'demo' : 'live'}`}>Réinitialiser</a>
  </form>;
  const signalContext = selected ? { ...filters, territoryId: selected.signal.territory.cell_id, productionId: selected.signal.production_id, date: selected.signal.validity.date, indicatorId: selected.bundle.facts[0].result.indicator_id } : filters;
  const signalParams = new URLSearchParams(params);
  if (selected) {
    const rule = selected.bundle.facts[0].result.rule;
    signalParams.set('rule', rule.rule_id);
    signalParams.set('version', rule.version);
  }
  const mapHref = contextLink(signalContext, 'observation', demo ? 'demo' : 'live', signalParams);
  const diagnosticHref = selected ? signalDiagnosticLink(selected, signalContext, params) : contextLink(signalContext, 'diagnostic', demo ? 'demo' : 'live', params);
  return <>
    <a href="#main" className="skip-link">Aller au contenu</a>
    <header className="app-header"><BrandLockup /><nav aria-label="Espaces produit" className="watch-navigation"><a href={mapHref}>Observation</a><a href={href({ signal: null })} aria-current="page">Veille</a><a href={diagnosticHref}>Diagnostic</a></nav><ThemeToggle /></header>
    <aside aria-label="Mode de données" className="demo-banner" data-demo={demo || undefined}>{demo ? <><strong>Données fictives</strong> · Mode démo explicite · Aucune validation scientifique</> : <><strong>Mode live</strong> · Source de veille non connectée</>}</aside>
    <main id="main" className="app-main watch-main" tabIndex={-1}>
      <div className="page-intro"><span className="eyebrow">AgriclimaX · Observer. Comprendre. Anticiper.</span><h1>{selected ? 'Vérifier un signal' : 'Veille climatique agricole'}</h1><p>Des signaux structurés. Des preuves consultables. Un contexte partagé.</p></div>
      <div className="context-bar"><div className="desktop-only">{filterForm}</div><div className="mobile-only compact-context"><span>{filters.productionId ?? 'Toutes productions'} · {filters.date ?? 'Toutes périodes'}</span><Sheet title="Filtrer la veille" trigger="Filtres">{filterForm}</Sheet></div></div>
      {!demo ? <Callout title="Source de veille indisponible">La source de veille n’est pas connectée. Aucun signal n’est disponible. <a href="/watch?mode=demo">Ouvrir la démonstration fictive</a></Callout> : failed ? <DataState state="source-error" /> : selected ? <>
        <p><a className="button button-secondary" href={href({ signal: null })}>Retour à la liste</a></p>
        <WatchSignalDetail record={selected} narrative={await narrate(selected.bundle, { enabled: process.env.WATCH_NARRATIVE_ENABLED !== 'false' })} mapHref={mapHref} diagnosticHref={diagnosticHref} />
      </> : params.has('signal') ? <><DataState state="missing" /><a href={href({ signal: null })}>Retour à la liste filtrée</a></> : <>
        <div className="row"><p role="status">{records.length} signal(s) dans ce contexte</p><nav className="badges" aria-label="Densité de la veille"><a className="button button-secondary" aria-current={!detailed ? 'true' : undefined} href={href({ density: 'compact' })}>Compacte</a><a className="button button-secondary" aria-current={detailed ? 'true' : undefined} href={href({ density: 'detailed' })}>Détaillée</a></nav></div>
        {records.length ? <div className="watch-list">{records.map(record => <WatchSignalCard key={record.signal.signal_id} record={record} detailed={detailed} href={href({ signal: record.signal.signal_id })} />)}</div> : <DataState state="missing" />}
        <Callout title="Vérifier avant d’interpréter">La classe de risque, la confiance et la fraîcheur décrivent trois informations différentes. Les signaux reprennent des résultats structurés ; aucune règle scientifique n’est calculée dans la veille.</Callout>
      </>}
    </main>
    <nav className="mobile-only mobile-nav" aria-label="Navigation mobile"><a className="button button-secondary" href={mapHref}>Carte</a><a className="button button-secondary" href={href({ signal: null })} aria-current="page">Veille</a></nav>
  </>;
}
