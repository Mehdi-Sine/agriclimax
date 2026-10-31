'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import NationalMap, { type PraCollection } from './map';
import { NATIONAL, DAYS, VARIABLES, availability, valueLabel } from './model';
import type { TerritoryRow } from '../../lib/server/territories';
import './national.css';

type Load<T> = { state: 'loading' | 'error' | 'ready'; data: T | null };
async function read<T>(
  url: string,
  signal: AbortSignal,
  cache: RequestCache = 'no-store',
): Promise<T> {
  const r = await fetch(url, { signal, cache });
  if (!r.ok) throw new Error('unavailable');
  return r.json() as Promise<T>;
}
const empty: Load<TerritoryRow[]> = { state: 'loading', data: null };
function coverage(row: TerritoryRow, index: number) {
  const n = row.coverage?.[index];
  return n == null
    ? 'Inconnue'
    : `${n < 1 && n > 0.9999 ? '< 100' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 }).format(n * 100)} % · ${row.valid_counts?.[index] ?? '?'} / ${row.expected_cells ?? '?'} cellules`;
}
export function NationalWorkspace({
  initialDate,
  initialPra,
}: {
  initialDate?: string;
  initialPra?: string;
}) {
  const [date, setDate] = useState(
      initialDate === undefined ? NATIONAL.end : initialDate,
    ),
    [selected, setSelected] = useState(initialPra || ''),
    [query, setQuery] = useState(''),
    [variable, setVariable] =
      useState<(typeof VARIABLES)[number]['key']>('temperature');
  const [collection, setCollection] = useState<PraCollection | null>(null),
    [geometryError, setGeometryError] = useState(false),
    [day, setDay] = useState(empty),
    [history, setHistory] = useState(empty),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    read<PraCollection>(
      `/maps/pra-national.geojson?reference=${NATIONAL.reference}`,
      c.signal,
      'force-cache',
    )
      .then((value) => {
        if (value.type !== 'FeatureCollection' || value.features.length !== 713)
          throw new Error();
        setCollection(value);
      })
      .catch(() => {
        if (!c.signal.aborted) setGeometryError(true);
      });
    return () => c.abort();
  }, []);
  useEffect(() => {
    const c = new AbortController();
    if (!DAYS.includes(date)) return () => c.abort();
    read<{ data: TerritoryRow[] }>(
      `/api/national?${new URLSearchParams({ action: 'day', date })}`,
      c.signal,
    )
      .then((value) => {
        if (!c.signal.aborted) setDay({ state: 'ready', data: value.data });
      })
      .catch(() => {
        if (!c.signal.aborted) setDay({ state: 'error', data: null });
      });
    return () => c.abort();
  }, [date, retry]);
  useEffect(() => {
    if (!selected) return;
    const c = new AbortController();
    read<{ data: TerritoryRow[] }>(
      `/api/national?${new URLSearchParams({ action: 'history', pra: selected })}`,
      c.signal,
    )
      .then((value) => {
        if (!c.signal.aborted) setHistory({ state: 'ready', data: value.data });
      })
      .catch(() => {
        if (!c.signal.aborted) setHistory({ state: 'error', data: null });
      });
    return () => c.abort();
  }, [selected, retry]);
  const valid = DAYS.includes(date),
    rows = valid && day.state === 'ready' ? day.data : null;
  const byId = useMemo(
    () => new Map(rows?.map((row) => [row.id, row])),
    [rows],
  );
  const matches = useMemo(
    () =>
      collection?.features.filter((f) =>
        `${f.properties.name} ${f.properties.code} ${f.properties.department_name}`
          .normalize('NFD')
          .replace(/\p{Diacritic}/gu, '')
          .toLowerCase()
          .includes(
            query
              .normalize('NFD')
              .replace(/\p{Diacritic}/gu, '')
              .toLowerCase(),
          ),
      ) || [],
    [collection, query],
  );
  const feature = collection?.features.find((f) => f.id === selected),
    current = byId.get(selected),
    definition = VARIABLES.find((v) => v.key === variable)!;
  const counts = rows?.reduce(
    (acc, r) => {
      acc[availability(r)]++;
      return acc;
    },
    { complete: 0, partial: 0, unavailable: 0, absent: 0 },
  );
  function choose(id: string) {
    if (id !== selected) {
      setSelected(id);
      setHistory(empty);
    }
    const p = new URLSearchParams({ date, pra: id });
    window.history.replaceState(null, '', `/territories?${p}`);
  }
  function changeDate(value: string) {
    if (value !== date) {
      setDate(value);
      setDay(empty);
    }
    window.history.replaceState(
      null,
      '',
      `/territories?${new URLSearchParams({ date: value, ...(selected ? { pra: selected } : {}) })}`,
    );
  }
  return (
    <main id="main" className="national-page">
      <header>
        <Link href="/">AgriclimaX</Link>
        <span className="national-edition">V0.3 · national DEV</span>
        <h1>Climat des territoires agricoles</h1>
        <p>
          713 PRA · France métropolitaine et Corse · ERA5-Land, réanalyse 0,1°
        </p>
        <nav aria-label="Sources">
          <Link href="/?mode=live_meteofrance&production=wheat">
            Stations Météo-France
          </Link>
          <Link href="/?mode=demo">Démonstration · données fictives</Link>
        </nav>
      </header>
      <p className="national-notice">
        Archive réelle du 19 septembre au 18 octobre 2026 UTC · fraîcheur
        historique (stale), pas une prévision. Couverture partielle sur certains
        territoires.
      </p>
      <div className="national-controls">
        <label>
          Date UTC{' '}
          <input
            type="date"
            value={date}
            min={NATIONAL.start}
            max={NATIONAL.end}
            onChange={(e) => changeDate(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={!valid || date === NATIONAL.start}
          onClick={() => changeDate(DAYS[DAYS.indexOf(date) - 1])}
        >
          Jour précédent
        </button>
        <button
          type="button"
          disabled={!valid || date === NATIONAL.end}
          onClick={() => changeDate(DAYS[DAYS.indexOf(date) + 1])}
        >
          Jour suivant
        </button>
        <label>
          Variable{' '}
          <select
            aria-label="Variable"
            value={variable}
            onChange={(e) => setVariable(e.target.value as typeof variable)}
          >
            {VARIABLES.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label} ({v.unit})
              </option>
            ))}
          </select>
        </label>
      </div>
      {!valid && (
        <p role="alert">
          {date
            ? 'Date hors de l’archive disponible.'
            : 'Sélectionnez une date pour afficher les données.'}{' '}
          Aucune valeur pour la date courante.
        </p>
      )}
      {valid && day.state === 'loading' && (
        <p role="status">Chargement des données nationales du {date}…</p>
      )}
      {valid && day.state === 'error' && (
        <p role="alert">
          Erreur réseau ou données nationales indisponibles. Aucune démo de
          remplacement.{' '}
          <button
            onClick={() => {
              setDay(empty);
              setHistory(empty);
              setRetry(retry + 1);
            }}
          >
            Réessayer
          </button>
        </p>
      )}
      <ul className="national-legend" aria-label="Disponibilité des PRA">
        {(['complete', 'partial', 'unavailable'] as const).map((s) => (
          <li key={s}>
            <span className={`national-dot ${s}`} />
            {s}
            {counts ? ` · ${counts[s]}` : ''}
          </li>
        ))}
      </ul>
      <p className="national-help">
        Les couleurs indiquent la disponibilité, pas un risque : complete =
        support entier ; partial = support incomplet ; unavailable = aucune
        valeur native. Une valeur incomplète reste NULL.
      </p>
      <div className="national-grid">
        <div>
          {collection && (
            <NationalMap
              collection={collection}
              rows={rows}
              selected={selected}
              onSelect={choose}
            />
          )}
          {geometryError && (
            <p role="alert">
              Contours indisponibles. Réessayez en rechargeant la page.
            </p>
          )}
        </div>
        <section
          className="national-search"
          aria-label="Navigation territoriale"
        >
          <h2>Choisir une PRA</h2>
          <label>
            Rechercher une PRA{' '}
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nom, code, département"
              maxLength={100}
            />
          </label>
          <label>
            PRA{' '}
            <select
              aria-label="PRA"
              size={8}
              value={selected}
              onChange={(e) => choose(e.target.value)}
            >
              <option value="" disabled>
                Choisir un territoire
              </option>
              {matches.map((f) => (
                <option key={String(f.id)} value={String(f.id)}>
                  {f.properties.name} · {f.properties.code} ·{' '}
                  {rows
                    ? availability(byId.get(String(f.id)))
                    : 'données non chargées'}
                </option>
              ))}
            </select>
          </label>
          <p>
            {matches.length} PRA dans la recherche · 713 contours conservés sur
            la carte.
          </p>
          {feature && (
            <>
              <h3>
                {feature.properties.name} · {feature.properties.code}
              </h3>
              <p>
                {feature.properties.department_name} ·{' '}
                {feature.properties.region_name}
              </p>
              <nav aria-label="PRA sélectionnée">
                <a href="#pra-diagnostic">Diagnostic descriptif</a>
                <a href="#pra-history">Historique 30 jours</a>
                <a
                  href={`/territories?${new URLSearchParams({ date, pra: selected })}`}
                >
                  Lien direct
                </a>
              </nav>
            </>
          )}
        </section>
      </div>
      {selected && (
        <section
          id="pra-diagnostic"
          className="national-panel"
          aria-label="Diagnostic descriptif"
        >
          <h2>
            Diagnostic descriptif · {feature?.properties.name || selected}
          </h2>
          {current ? (
            <>
              <p>
                Date UTC : {date} · <strong>{availability(current)}</strong> ·
                ERA5-Land · fraîcheur : {current.freshness}
              </p>
              <dl className="national-values">
                {VARIABLES.map((v, i) => (
                  <div key={v.key}>
                    <dt>
                      {v.label} ({v.unit})
                    </dt>
                    <dd>{valueLabel(current[v.key])}</dd>
                    <dd>Couverture : {coverage(current, i)}</dd>
                  </div>
                ))}
              </dl>
              <details>
                <summary>Provenance et qualité</summary>
                <p>
                  Méthode : pra-native-1 · poids de surface totale, sans masque
                  agricole.
                </p>
                <p>
                  Calcul : {current.computed_at || 'inconnu'} · publication
                  source : non documentée.
                </p>
                <p>Édition : {NATIONAL.dataset}</p>
                <p>Référentiel : {NATIONAL.reference}</p>
                <p>Lot : {current.batch_key || 'absent'}</p>
                <p>
                  Qualité :{' '}
                  {current.quality_flags?.join(', ') || 'non documentée'}
                </p>
              </details>
            </>
          ) : (
            <p>
              Aucune valeur affichée : sélection, date ou lecture à vérifier.
            </p>
          )}
          <p>
            Statistiques descriptives, sans climatologie, anomalie ni nouveau
            risque agronomique. THI bovin non calculable sur ces données sans
            humidité et validation du support grille.
          </p>
        </section>
      )}
      {selected && (
        <section
          id="pra-history"
          className="national-panel"
          aria-label="Historique 30 jours"
        >
          <h2>
            Historique · {definition.label} ({definition.unit})
          </h2>
          {history.state === 'loading' && (
            <p role="status">Chargement des 30 jours de la PRA sélectionnée…</p>
          )}
          {history.state === 'error' && (
            <p role="alert">
              Historique indisponible. Aucun résultat de remplacement.{' '}
              <button
                onClick={() => {
                  setHistory(empty);
                  setRetry(retry + 1);
                }}
              >
                Réessayer
              </button>
            </p>
          )}
          {history.state === 'ready' && history.data && (
            <>
              <HistoryChart rows={history.data} variable={variable} />
              <div className="national-table">
                <table>
                  <caption>
                    30 jours UTC · ERA5-Land · historique stale · NULL conservés
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Date UTC</th>
                      <th scope="col">État</th>
                      {VARIABLES.map((v) => (
                        <th key={v.key} scope="col">
                          {v.label} ({v.unit})
                        </th>
                      ))}
                      <th scope="col">Couverture de la variable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.data.map((r) => (
                      <tr key={r.valid_date}>
                        <th scope="row">
                          <button onClick={() => changeDate(r.valid_date!)}>
                            {r.valid_date}
                          </button>
                        </th>
                        <td>{availability(r)}</td>
                        {VARIABLES.map((v) => (
                          <td key={v.key}>{valueLabel(r[v.key])}</td>
                        ))}
                        <td>
                          {coverage(
                            r,
                            VARIABLES.findIndex((v) => v.key === variable),
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
      <footer>
        <p>
          Référentiel OFB/MASA accepté avec son périmètre documenté : PRA, pas
          couverture communale exhaustive. Réserves géographiques inchangées.
          Aucun fallback vers Météo-France ou la démo.
        </p>
      </footer>
    </main>
  );
}
function HistoryChart({
  rows,
  variable,
}: {
  rows: TerritoryRow[];
  variable: (typeof VARIABLES)[number]['key'];
}) {
  const values = rows.flatMap((r) =>
    r[variable] == null ? [] : [r[variable]!],
  );
  if (!values.length)
    return (
      <p>Aucune valeur disponible pour cette variable sur les 30 jours.</p>
    );
  const low = Math.min(...values),
    high = Math.max(...values),
    span = high - low || 1;
  const paths: string[] = [];
  let segment = '';
  rows.forEach((r, i) => {
    const v = r[variable];
    if (v == null) {
      if (segment) paths.push(segment);
      segment = '';
    } else
      segment += `${segment ? ' L' : 'M'} ${20 + i * 20} ${130 - ((v - low) / span) * 110}`;
  });
  if (segment) paths.push(segment);
  return (
    <figure className="national-chart">
      <svg
        viewBox="0 0 620 155"
        role="img"
        aria-label="Évolution des valeurs disponibles sur 30 jours ; détail dans le tableau. Les lacunes interrompent la courbe."
      >
        {paths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        ))}
        {rows.map((r, i) =>
          r[variable] == null ? null : (
            <circle
              key={i}
              cx={20 + i * 20}
              cy={130 - ((r[variable]! - low) / span) * 110}
              r="3"
              fill="currentColor"
            />
          ),
        )}
      </svg>
      <figcaption>
        {NATIONAL.start} → {NATIONAL.end} · min. {valueLabel(low)} / max.{' '}
        {valueLabel(high)} · aucune interpolation des lacunes.
      </figcaption>
    </figure>
  );
}
