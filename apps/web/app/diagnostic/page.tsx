import { CattleWorkspace } from '../../features/cattle/workspace';
import { loadDiagnostic } from '../../components/diagnostic/load-diagnostic';
import { ScientificDiagnostic } from '../../components/diagnostic/scientific-diagnostic';
import { BrandLockup } from '../../components/shell/brand';
import { ThemeToggle } from '../../components/shell/theme-toggle';
import { Panel } from '../../components/ui/primitives';
import { observationHref, sharedContext } from '../../lib/integration-context';
import { WheatWorkspace } from '../../features/wheat/workspace';

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') params.append(key, value);
    else if (Array.isArray(value)) for (const item of value) params.append(key, item);
  }
  if (params.get('mode') === 'wheat') return <WheatWorkspace params={params} view="diagnostic" />;
  if (params.get('production') === 'cattle' && params.get('mode') === 'live_meteofrance') return <CattleWorkspace params={params} view="diagnostic" />;
  const data = await loadDiagnostic(params);
  const back = observationHref(params);
  const watch = sharedContext(new URL(back, 'http://localhost').searchParams);
  return <>
    <a href="#main" className="skip-link">Aller au contenu</a>
    <header className="app-header diagnostic-header"><BrandLockup /><nav aria-label="Espaces produit" className="badges"><a href={back}>Observation</a><a href={`/watch?${watch}`}>Veille</a><a href={`/diagnostic?${params}`} aria-current="page">Diagnostic</a></nav><ThemeToggle /></header>
    <main id="main" className="app-main diagnostic-layout" tabIndex={-1}>
      <aside className="diagnostic-context"><h1>Diagnostic scientifique</h1>
        <p>Auditer un résultat, ses données et ses limites.</p>
        <p><a className="button button-secondary" href={back}>Retour à l’observation</a></p>
        <p><strong>{data.mode === 'demo' ? 'Mode démo · données fictives' : 'Mode live · sans remplacement fictif'}</strong></p>
        <dl className="diagnostic-facts">{['cell', 'production', 'indicator', 'date', 'rule', 'version'].map(key => <div key={key}><dt>{key}</dt><dd>{params.get(key) || 'Non renseigné'}</dd></div>)}</dl>
        <nav aria-label="Sections du diagnostic"><ul>{[['composition', 'Résultat'], ['confidence', 'Confiance'], ['temporal', 'Fenêtre temporelle'], ['quality', 'Qualité'], ['provenance', 'Provenance'], ['method', 'Règle et niveaux'], ['limits', 'Limites']].map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}</ul></nav>
      </aside>
      <Panel title="Explicabilité du résultat" className="diagnostic-panel">
        {data.state === 'available' && <form action="/diagnostic" className="diagnostic-range">
          {Array.from(params).filter(([key]) => !['start', 'end'].includes(key)).map(([key, value], index) => <input key={index} type="hidden" name={key} value={value} />)}
          <label className="field">Période consultée · début<input type="date" name="start" required defaultValue={params.get('start') ?? params.get('date') ?? ''} /></label>
          <label className="field">Période consultée · fin<input type="date" name="end" required defaultValue={params.get('end') ?? params.get('date') ?? ''} /></label>
          <button type="submit" className="button button-secondary">Consulter la série</button>
        </form>}
        <ScientificDiagnostic data={data} />
      </Panel>
    </main>
  </>;
}
