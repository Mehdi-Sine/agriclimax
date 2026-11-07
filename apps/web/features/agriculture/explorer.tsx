'use client';
import {semanticPalette} from '../cartography/registry';
import {usePaletteColors} from '../cartography/use-palette';
import {SemanticLegend} from '../cartography/legend';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { type PraCollection } from '../national/map';
import { agriculturalValue, type AgriculturalDataset, type AgriculturalCatalog, type PraAgriculturalContext } from './model';

export function useAgriculturalData<T>(url: string | null) {
  const [resource, setResource] = useState<{ url: string; data: T | null; error: string | null }>({ url: '', data: null, error: null });
  useEffect(() => {
    if (!url) return;
    const abort = new AbortController();
    fetch(url, { signal: abort.signal }).then(async r => {
      if (!r.ok) throw new Error('Source indisponible pour cette sélection.');
      return r.json() as Promise<T>;
    }).then(data => {if(!abort.signal.aborted)setResource({ url, data, error: null });}).catch((e: unknown) => {
      if (!abort.signal.aborted) setResource({ url, data: null, error: e instanceof Error ? e.message : 'Source indisponible.' });
    });
    return () => abort.abort();
  }, [url]);
  return resource.url === url ? resource : { data: null, error: null };
}
const fmt = (v: number | null | undefined) => v == null ? 'Indisponible' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(v);
const GROUPS: Record<string, string> = { COP: 'Céréales, oléagineux et protéagineux', FOU: 'Fourrages et prairies', EFA: 'Bovins, porcins, ovins et caprins', EFV: 'Volailles', LAI: 'Productions laitières', VIG: 'Vignoble', RPG: 'Déclarations PAC · RPG 2025' };
export function useAgriculturalExplorer(enabled: boolean) {
  const search = useSearchParams();
  const manifest = useAgriculturalData<AgriculturalCatalog>(enabled ? '/api/agriculture?action=catalog' : null);
  const indicators = manifest.data?.indicators ?? [];
  const requestedProduction = search.get('agri_production') ?? 'saa-cop-03';
  const production = indicators.find(i => i.production === requestedProduction)?.production ?? indicators[0]?.production;
  const productionIndicators = indicators.filter(i => i.production === production);
  const variable = search.get('agri_variable') ?? 'SURF';
  const scale = search.get('echelle') ?? productionIndicators.find(i => i.variable === variable)?.scale ?? (production?.startsWith('rpg-') ? 'pra' : 'departement');
  const indicator = productionIndicators.find(i => i.scale === scale && i.variable === variable)
    ?? productionIndicators.find(i => i.scale === scale) ?? productionIndicators[0];
  const sourceMetadata = manifest.data?.sources.find(s => s.source_id === indicator?.source_id);
  const requestedYear = Number(search.get('annee') ?? 2025);
  const year = indicator?.years.includes(requestedYear) ? requestedYear : indicator?.years.at(-1) ?? 2025;
  const invalid = !!manifest.data && ((search.has('agri_production') && production !== requestedProduction)
    || (search.has('annee') && (!Number.isInteger(requestedYear) || !indicator?.years.includes(requestedYear)))
    || (search.has('echelle') && indicator?.scale !== scale)
    || (search.has('agri_variable') && indicator?.variable !== variable));
  const dataset = useAgriculturalData<AgriculturalDataset>(indicator && !invalid ? `/api/agriculture?action=dataset&indicator=${encodeURIComponent(indicator.id)}` : null);
  const geometry = useAgriculturalData<PraCollection>(indicator ? indicator.scale === 'pra' ? '/maps/pra-national.geojson' : `/maps/agriculture-${indicator.scale}.geojson` : null);
  const selected = search.get('territoire') ?? (indicator?.scale === 'pra' ? search.get('pra') ?? '' : '');
  const profile = useAgriculturalData<PraAgriculturalContext>(indicator?.scale === 'pra' && selected.startsWith('pra:') && !invalid ? `/api/agriculture?action=wheat-context&pra=${encodeURIComponent(selected)}` : null);
  const [query, setQuery] = useState('');
  const semantic=semanticPalette('agriculture',indicator?.unit??'');
  const palette=usePaletteColors(semantic);
  const rows = dataset.data?.rows ?? [];
  const values = rows.map(row => {
    const v = agriculturalValue(row, indicator?.years ?? [], year);
    return { territoryId: `${indicator?.scale === 'pra' ? 'pra' : indicator?.scale === 'departement' ? 'dep' : 'reg'}:${row.code}`, value: v.value, normal: null, anomaly: null, status: v.status };
  });
  const bounds=semantic.bounds;
  const current = rows.find(r => selected.endsWith(`:${r.code}`));
  const currentValue = agriculturalValue(current, indicator?.years ?? [], year);
  const feature = geometry.data?.features.find(f => f.id === selected);
  const matches = useMemo(() => {
    const normalized = query.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    return normalized.trim() ? geometry.data?.features.filter(f => `${f.properties.name} ${f.properties.code}`.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().includes(normalized)).slice(0, 8) ?? [] : [];
  }, [query, geometry.data]);
  function change(patch: Record<string, string>) {
    const next = new URLSearchParams(search.toString());
    Object.entries(patch).forEach(([k, v]) => v ? next.set(k, v) : next.delete(k));
    window.history.pushState(null, '', `/productions?${next}`);
  }
  function select(id: string) {
    if (!geometry.data?.features.some(f => f.id === id)) return;
    change({ territoire: id, ...(id.startsWith('pra:') ? { pra: id } : {}) });
    setQuery('');
  }
  const prefix = indicator?.scale === 'pra' ? 'pra:' : indicator?.scale === 'departement' ? 'dep:' : 'reg:';
  const scaleLabel = indicator?.scale === 'pra' ? 'PRA' : indicator?.scale === 'departement' ? 'département' : 'région';
  const label = indicator ? `${indicator.label} · ${indicator.variable_label}` : 'Productions agricoles';
  const filters = <>
    <section className="unified-filters filters-open" aria-label="Filtres agricoles">
      <label>Production<select value={production ?? ''} disabled={!indicators.length} onChange={e => change({ agri_production: e.target.value, agri_variable: '', annee: '', echelle: '', territoire: '' })}>
        {Object.entries(GROUPS).map(([sheet, title]) => <optgroup key={sheet} label={title}>{indicators.filter((i, n, all) => i.sheet === sheet && all.findIndex(j => j.production === i.production) === n).map(i => <option key={i.production} value={i.production}>{i.label}</option>)}</optgroup>)}
      </select></label>
      <label>Variable<select value={indicator?.variable ?? ''} disabled={!indicator} onChange={e => change({ agri_variable: e.target.value, echelle: '', territoire: '' })}>{productionIndicators.filter((i, n, all) => all.findIndex(j => j.variable === i.variable) === n).map(i => <option key={i.variable} value={i.variable}>{i.variable_label} ({i.unit})</option>)}</select></label>
      <label>Année<select value={year} disabled={!indicator} onChange={e => change({ annee: e.target.value })}>{[...(indicator?.years ?? [])].reverse().map(y => <option key={y}>{y}</option>)}</select></label>
      <label>Maille publiée<select value={indicator?.scale ?? ''} disabled={!indicator} onChange={e => change({ echelle: e.target.value, territoire: '' })}>{[...new Set(productionIndicators.filter(i => i.variable === indicator?.variable).map(i => i.scale))].map(s => <option key={s} value={s}>{s === 'departement' ? 'Département' : s === 'region' ? 'Région' : 'PRA'}</option>)}</select></label>
    </section>
    <p className="unified-source-banner">{indicator?.source_id.startsWith('rpg') ? 'IGN / ASP · surfaces RPG déclarées à la PAC' : 'Agreste / SSP · SAA annuelle'} · {year} {year === 2025 && indicator?.source_id.startsWith('saa') ? 'provisoire' : ''} · maille {scaleLabel}. {indicator?.source_id.startsWith('saa') ? 'Diffusion du 10/07/2026 ; séries historiques révisées.' : sourceMetadata?.coverage === 'national' ? 'Référence agricole 2025. Couverture nationale · surfaces par PRA.' : `Référence agricole 2025. Couverture partielle : ${sourceMetadata?.completed_regions?.length ?? 0}/13 régions acquises. Les valeurs décrivent uniquement ces lots.`}</p>
    {invalid && <p role="alert" className="unified-alert">Sélection agricole invalide. <button onClick={() => change({ agri_production: '', agri_variable: '', annee: '', echelle: '', territoire: '' })}>Réinitialiser les filtres agricoles</button></p>}
    {(manifest.error || dataset.error || geometry.error) && <p role="alert">{manifest.error ?? dataset.error ?? geometry.error} Aucune valeur de remplacement.</p>}
    {!!manifest.data?.source_errors.length && <p role="status">Une source agricole est indisponible ({manifest.data.source_errors.map(s => s.startsWith('saa') ? 'SAA' : 'RPG').join(', ')}). Les autres sources restent consultables.</p>}
    <div className="unified-search"><label htmlFor="agriculture-search">Rechercher un {scaleLabel}</label><input id="agriculture-search" type="search" value={query} maxLength={100} onChange={e => setQuery(e.target.value)} placeholder="Nom ou code géographique…" />{query && <div className="unified-results">{matches.map(f => <button key={String(f.id)} onClick={() => select(String(f.id))}>{f.properties.name} · {f.properties.code}</button>)}{!matches.length && <p>Aucun résultat.</p>}</div>}</div>
  </>;
  const mapTitle = <>        <div className="unified-map-title"><strong>{label} · {indicator?.unit}</strong><span>{year} · {scaleLabel} · {indicator?.source_id}</span></div></>;
  const mapState = <>        {!geometry.data && !geometry.error && <p role="status">Chargement des contours…</p>}
        {!dataset.data && !dataset.error && !invalid && <p role="status">Chargement des statistiques officielles…</p>}
</>;
  const legend=<SemanticLegend palette={semantic}/>;
  const panel = <>        {feature ? <><div className="panel-top"><span className="eyebrow">{scaleLabel} · {feature.properties.code}</span><button aria-label="Fermer la fiche agricole" onClick={() => change({ territoire: '', ...(indicator?.scale === 'pra' ? { pra: '' } : {}) })}>×</button></div><h2>{feature.properties.name}</h2>
          <div className="unified-value"><small>{label} · {year}</small><strong>{currentValue.status === 'suppressed' ? 'Secret statistique' : fmt(currentValue.value)} <em>{currentValue.value !== null ? indicator?.unit : ''}</em></strong></div>
          {indicator?.scale !== 'pra' && <p>Valeur pour {scaleLabel === 'département' ? 'le département' : 'la région'} {feature.properties.code} — non disponible à la PRA. Une PRA sélectionnée ailleurs reste un contexte de navigation.</p>}
          {current && indicator?.scale !== 'pra' && <><p>Statut qualité SSP : {current.quality_code ?? 'Non renseigné'} (code source, sans conversion en niveau de risque).</p><AnnualHistory dataset={dataset.data!} code={current.code} /></>}
          {indicator?.scale === 'pra' && <><p>{currentValue.status === 'partial' ? 'Surface partielle : seuls les lots régionaux acquis sont comptés.' : 'Surface géométrique des déclarations PAC.'} Une absence de déclaration connue ne signifie pas absence d’agriculture.</p>{profile.data?.data && <><p>Total des surfaces RPG dans les lots acquis : {fmt(profile.data.data.total_rpg_ha)} ha. Part de la culture sélectionnée : {fmt(currentValue.value === null ? null : currentValue.value / profile.data.data.total_rpg_ha * 100)} % dans ces déclarations.</p><h3>Principales cultures déclarées · 2025</h3><ul>{profile.data.distribution.filter(r => r.area_ha !== null && r.area_ha > 0).sort((a, b) => b.area_ha! - a.area_ha!).slice(0, 8).map(r => <li key={r.id}>{r.label} : {fmt(r.area_ha)} ha</li>)}</ul></>}{profile.error && <p role="alert">Répartition agricole indisponible.</p>}<p>Un seul millésime RPG chargé ; aucun historique interannuel.</p></>}
          <details><summary>Source, statut et méthode</summary><p>{indicator?.unit_note}</p>{indicator?.scale === 'pra' && <p>Les invalidités géométriques sont réparées en copie de travail, sans modifier le référentiel PRA officiel. Les recouvrements sont retirés une seule fois selon un ordre déterministe des livraisons et des parcelles ; ce choix de comptage ne tranche pas la culture réelle d’une zone litigieuse. Les catégories source ambiguës restent dans le total RPG sans être proposées comme culture qualifiée.</p>}{indicator?.scale !== 'pra' && <><p>{year === 2025 ? 'Données SAA 2025 provisoires, arrêtées au 30/03/2026.' : 'Série historique révisée ; statut définitif non déduit.'}</p><p>Les années 2010–2019 ont été rétropolées après mise en cohérence avec le recensement 2020. Aucune actualisation mensuelle.</p></>}{sourceMetadata?.quality_flags?.includes('cross_region_distinct_id_overlap_not_checked') && <p>Limite de contrôle : les recouvrements entre parcelles d’identifiants distincts provenant de régions différentes ne sont pas vérifiés. Les recouvrements au sein de chaque lot sont exclus et mesurés.</p>}<p>Empreinte source : {indicator?.sha256}</p><p>Règle : {sourceMetadata?.rule_version} · acquisition {sourceMetadata?.acquired_at} · licence {sourceMetadata?.license}</p></details>
        </> : <><h2>Les productions dans leur territoire</h2><p>Sélectionnez un {scaleLabel} sur la carte ou recherchez son nom. La fiche restitue la maille publiée, sans répartir les statistiques SAA entre PRA.</p><p>{manifest.data?.indicators.length ?? '…'} indicateurs effectivement alimentés.</p></>}
        <p><a href={indicator?.source_id.startsWith('rpg') ? 'https://www.data.gouv.fr/datasets/rpg' : 'https://agreste.agriculture.gouv.fr/agreste-web/disaron/SAA-SeriesLongues/detail/'} target="_blank" rel="noreferrer">Source officielle et millésimes ↗</a></p></>;
  const method = <>    <details id="sources" className="unified-method"><summary>Sources, méthodes et limites</summary><p>Agreste / SSP · SAA, diffusion du 10 juillet 2026. Licence Ouverte. Millésime 2025 provisoire ; statistiques arrêtées au 30 mars 2026. Les unités et statuts qualité sont ceux des fichiers officiels. Les valeurs absentes restent absentes ; aucune valeur départementale attribuée à une PRA.</p><p>Contours administratifs Etalab 2025, simplifiés à 100 m par le producteur ; carte de France métropolitaine et Corse. Le référentiel des 713 PRA reste inchangé dans les espaces Climat et Analyse. La SAA et les déclarations PAC RPG mesurent des concepts différents.</p></details></>;
  const mapProps = {
    selected, onSelect: select,
    geography: { prefix, label: `${geometry.data?.features.length ?? 0} ${scaleLabel}s`, attribution: indicator?.scale === 'pra' ? 'PRA · OFB / MASA · géométries source inchangées' : 'Etalab · contours administratifs 2025, 100 m · Licence Ouverte 2.0' },
    quantitative: { values, field: 'value' as const, unit: indicator?.unit ?? '', bounds, colors: palette },
  };
  return { loading:enabled&&!invalid&&!dataset.data&&!dataset.error,error:dataset.error,filters, mapTitle, mapState, legend, panel, method, mapProps, collection: geometry.data, hasSelection: !!feature };
}

function AnnualHistory({ dataset, code }: { dataset: AgriculturalDataset; code: string }) {
  const row = dataset.rows.find(r => r.code === code)!;
  const numbers = row.values.filter((v): v is number => v !== null);
  const min = numbers.length ? Math.min(...numbers) : 0, max = numbers.length ? Math.max(...numbers) : 1;
  const line = row.values.map((v, n) => v === null ? '' : `${n > 0 && row.values[n - 1] !== null ? 'L' : 'M'} ${25 + n * 19} ${120 - 95 * (v - min) / (max - min || 1)}`).join(' ');
  return <><figure className="unified-chart"><svg viewBox="0 0 340 150" role="img" aria-label={`Évolution annuelle ${dataset.indicator.label}, ${dataset.indicator.unit}`}><text x="0" y="15">{fmt(max)}</text><text x="0" y="140">{fmt(min)}</text><path className="observed-line" d={line} /></svg><figcaption>{dataset.indicator.years[0]} → {dataset.indicator.years.at(-1)} · {dataset.indicator.unit} · ruptures de ligne : valeurs absentes</figcaption></figure><details><summary>Valeurs annuelles accessibles · {dataset.indicator.unit}</summary><div className="history-table"><table><caption>{dataset.indicator.label} · série officielle annuelle</caption><thead><tr><th>Année</th><th>Valeur ({dataset.indicator.unit})</th><th>État</th></tr></thead><tbody>{dataset.indicator.years.map((y, n) => <tr key={y}><th>{y}</th><td>{fmt(row.values[n])}</td><td>{row.statuses[n] === 'suppressed' ? 'Secret statistique' : row.values[n] === null ? 'Indisponible' : y === 2025 ? 'Provisoire' : 'Historique révisé'}</td></tr>)}</tbody></table></div></details></>;
}
