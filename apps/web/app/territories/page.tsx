import './territories.css';
import Link from 'next/link';
import {territoryData, type TerritoryPage} from '../../lib/server/territories';

export default async function Territories({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const raw=await searchParams;
  const params=new URLSearchParams();
  for(const [k,v] of Object.entries(raw))if(typeof v==='string')params.set(k,v);
  const reference=params.get('reference')||process.env.PRA_REFERENCE_VERSION||'';
  const dataset=params.get('dataset')||process.env.PRA_DATASET_VERSION||'';
  const department=params.get('department')||'';
  const query=params.get('q')||'';
  const date=params.get('date')||'';
  let lookup:TerritoryPage|null=null,climate:TerritoryPage|null=null;
  let state=reference?'':'Référentiel PRA non déployé : la couverture géographique et climatique reste à valider.';
  if(reference) {
    try {
      const filters=new URLSearchParams({action:'lookup',reference,q:query,limit:'50'});
      if(department)filters.set('department',department);
      if(params.get('after'))filters.set('after',params.get('after')!);
      lookup=await territoryData(filters);
      if(dataset&&date&&params.get('pra'))climate=await territoryData(new URLSearchParams({action:'read',reference,dataset,date,scope:'pra',id:params.get('pra')!}));
    } catch {state='Données territoriales indisponibles pour cette sélection. Aucune donnée de démonstration ne remplace une publication réelle.';}
  }
  const selected=climate?.data[0];
  return <main id="main" className="territories-page">
    <h1>Territoires agricoles · PRA</h1>
    <p>France métropolitaine et Corse · réanalyse ERA5-Land à la résolution source 0,1°.
      Une PRA est un territoire de synthèse, pas une précision météorologique locale.</p>
    <p><Link href="/?mode=live_meteofrance&production=wheat">Carte et diagnostic live · stations Météo-France</Link></p>
    <form method="get">
      {reference&&<input type="hidden" name="reference" value={reference}/>}
      <label>Département <input name="department" defaultValue={department} maxLength={2} placeholder="01, 2A…"/></label>{' '}
      <label>Rechercher une PRA <input name="q" defaultValue={query} maxLength={100}/></label>{' '}
      {dataset&&<input type="hidden" name="dataset" value={dataset}/>}
      <label>Date UTC <input type="date" name="date" defaultValue={date}/></label>{' '}
      <button type="submit" className="button button-primary">Rechercher</button>
    </form>
    {state&&<p role="status">{state}</p>}
    {lookup&&<section aria-label="Petites régions agricoles">
      <h2>Petites régions agricoles</h2>
      <p>Référentiel géographique : {reference}. {dataset&&<>Édition des données : {dataset}.</>}</p>
      {!lookup.data.length&&<p>Aucune PRA disponible pour ce filtre.</p>}
      <ul>{lookup.data.map(row=>{
        const link=new URLSearchParams({reference,department,q:query,dataset,date,pra:row.id});
        return <li key={row.id}><Link href={`/territories?${link}`}>{row.name} · {row.official_code}</Link> — {row.department_name}, {row.region_name} · {row.area_km2.toFixed(1)} km²</li>;
      })}</ul>
      {lookup.next_cursor&&<Link href={`/territories?${new URLSearchParams({reference,department,q:query,dataset,date,after:lookup.next_cursor})}`}>PRA suivantes</Link>}
    </section>}
    {selected&&<section aria-label="Diagnostic territorial"><h2>{selected.name} · {date}</h2>
      <p>Source : ERA5-Land · réanalyse · méthode {climate?.method_version} · poids de surface totale, sans masque agricole.</p>
      <p>Disponibilité : {selected.status} · fraîcheur : {selected.freshness}. Calcul : {selected.computed_at||'inconnu'}.</p>
      <dl><dt>Température moyenne spatiale (°C)</dt><dd>{selected.temperature??'Indisponible'}</dd>
        <dt>Minimum parmi les cellules (°C)</dt><dd>{selected.temperature_min??'Indisponible'}</dd>
        <dt>Maximum parmi les cellules (°C)</dt><dd>{selected.temperature_max??'Indisponible'}</dd>
        <dt>Précipitations · profondeur moyenne spatiale (mm)</dt><dd>{selected.precipitation??'Indisponible'}</dd>
        <dt>Couverture pondérée par variable</dt><dd>{selected.coverage?.map(v=>`${(v*100).toFixed(1)} %`).join(' · ')||'Inconnue'}</dd></dl>
      <p>Ces statistiques descriptives ne constituent pas un niveau de risque agronomique. THI bovin indisponible sans humidité et validation du support grille.</p>
      <p>Référence de provenance : {selected.batch_key||'aucune publication'}.</p>
    </section>}
    <p>Les observations Météo-France restent des points station, distincts de la réanalyse et des données fictives de la démo.</p>
  </main>;
}
