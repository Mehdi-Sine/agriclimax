'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import NationalMap, { type PraCollection } from './map';
import {
  NATIONAL,
  DAYS,
  VARIABLES,
  availability,
  anomalyBand,
  anomalyLabel,
  valueLabel,
  type ClimateContextRow,
  type ClimateVariable,
} from './model';
import type { TerritoryRow } from '../../lib/server/territories';
import './national.css';

type Load<T> = { state: 'loading' | 'error' | 'ready'; data: T | null };

async function read<T>(
  url: string,
  signal: AbortSignal,
  cache: RequestCache = 'no-store',
): Promise<T> {
  const response = await fetch(url, { signal, cache });
  if (!response.ok) throw new Error('unavailable');
  return response.json() as Promise<T>;
}

const emptyTerritory: Load<TerritoryRow[]> = {
  state: 'loading',
  data: null,
};
const emptyContext: Load<ClimateContextRow[]> = {
  state: 'loading',
  data: null,
};

function coverage(row: TerritoryRow, index: number) {
  const n = row.coverage?.[index];
  return n == null
    ? 'Inconnue'
    : `${
        n < 1 && n > 0.9999
          ? '< 100'
          : new Intl.NumberFormat('fr-FR', {
              maximumFractionDigits: 4,
            }).format(n * 100)
      } % · ${row.valid_counts?.[index] ?? '?'} / ${row.expected_cells ?? '?'} cellules`;
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
    [variable, setVariable] = useState<ClimateVariable>('temperature'),
    [mapMode, setMapMode] = useState<'availability' | 'anomaly'>('availability');

  const [collection, setCollection] = useState<PraCollection | null>(null),
    [geometryError, setGeometryError] = useState(false),
    [day, setDay] = useState(emptyTerritory),
    [contextDay, setContextDay] = useState(emptyContext),
    [history, setHistory] = useState(emptyTerritory),
    [contextHistory, setContextHistory] = useState(emptyContext),
    [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    read<PraCollection>(
      `/maps/pra-national.geojson?reference=${NATIONAL.reference}`,
      controller.signal,
      'force-cache',
    )
      .then((value) => {
        if (value.type !== 'FeatureCollection' || value.features.length !== 713)
          throw new Error();
        setCollection(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setGeometryError(true);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (!DAYS.includes(date)) return () => controller.abort();
    read<{ data: TerritoryRow[] }>(
      `/api/national?${new URLSearchParams({ action: 'day', date })}`,
      controller.signal,
    )
      .then((value) => {
        if (!controller.signal.aborted)
          setDay({ state: 'ready', data: value.data });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setDay({ state: 'error', data: null });
      });
    return () => controller.abort();
  }, [date, retry]);

  useEffect(() => {
    const controller = new AbortController();
    if (!DAYS.includes(date)) return () => controller.abort();
    setContextDay(emptyContext);
    read<{ data: ClimateContextRow[] }>(
      `/api/national?${new URLSearchParams({
        action: 'context-day',
        date,
        variable,
      })}`,
      controller.signal,
    )
      .then((value) => {
        if (!controller.signal.aborted)
          setContextDay({ state: 'ready', data: value.data });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setContextDay({ state: 'error', data: null });
      });
    return () => controller.abort();
  }, [date, variable, retry]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setHistory(emptyTerritory);
    setContextHistory(emptyContext);
    void Promise.all([
      read<{ data: TerritoryRow[] }>(
        `/api/national?${new URLSearchParams({
          action: 'history',
          pra: selected,
        })}`,
        controller.signal,
      ),
      read<{ data: ClimateContextRow[] }>(
        `/api/national?${new URLSearchParams({
          action: 'context-history',
          pra: selected,
        })}`,
        controller.signal,
      ),
    ])
      .then(([observed, context]) => {
        if (!controller.signal.aborted) {
          setHistory({ state: 'ready', data: observed.data });
          setContextHistory({ state: 'ready', data: context.data });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setHistory({ state: 'error', data: null });
          setContextHistory({ state: 'error', data: null });
        }
      });
    return () => controller.abort();
  }, [selected, retry]);

  const valid = DAYS.includes(date),
    rows = valid && day.state === 'ready' ? day.data : null,
    contextRows =
      valid && contextDay.state === 'ready' ? contextDay.data : null;

  const byId = useMemo(
    () => new Map(rows?.map((row) => [row.id, row])),
    [rows],
  );
  const matches = useMemo(
    () =>
      collection?.features.filter((feature) =>
        `${feature.properties.name} ${feature.properties.code} ${feature.properties.department_name}`
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

  const selectedContext = useMemo(() => {
    const currentRows =
      contextHistory.state === 'ready' && contextHistory.data
        ? contextHistory.data.filter((row) => row.date === date)
        : [];
    return new Map(
      currentRows
        .filter((row) => row.variable)
        .map((row) => [row.variable!, row]),
    );
  }, [contextHistory, date]);

  const counts = rows?.reduce(
    (acc, row) => {
      acc[availability(row)]++;
      return acc;
    },
    { complete: 0, partial: 0, unavailable: 0, absent: 0 },
  );

  function choose(id: string) {
    if (id !== selected) {
      setSelected(id);
      setHistory(emptyTerritory);
      setContextHistory(emptyContext);
    }
    const params = new URLSearchParams({ date, pra: id });
    window.history.replaceState(null, '', `/territories?${params}`);
  }

  function changeDate(value: string) {
    if (value !== date) {
      setDate(value);
      setDay(emptyTerritory);
      setContextDay(emptyContext);
    }
    window.history.replaceState(
      null,
      '',
      `/territories?${new URLSearchParams({
        date: value,
        ...(selected ? { pra: selected } : {}),
      })}`,
    );
  }

  return (
    <main id="main" className="national-page">
      <header>
        <Link href="/">AgriclimaX</Link>
        <span className="national-edition">V0.4 · contexte climatique DEV</span>
        <h1>Climat des territoires agricoles</h1>
        <p>
          713 PRA · ERA5-Land · observations récentes mises en perspective avec
          la normale 1991–2020.
        </p>
        <nav aria-label="Sources">
          <Link href="/?mode=live_meteofrance&production=wheat">
            Stations Météo-France
          </Link>
          <Link href="/?mode=demo">Démonstration · données fictives</Link>
        </nav>
      </header>

      <p className="national-notice">
        Archive réelle du 19 septembre au 18 octobre 2026 UTC · normale
        climatique 1991–2020. Les anomalies sont calculées côté serveur comme
        valeur observée − normale ; aucune interpolation des données manquantes.
      </p>

      <div className="national-controls">
        <label>
          Date UTC
          <input
            type="date"
            value={date}
            min={NATIONAL.start}
            max={NATIONAL.end}
            onChange={(event) => changeDate(event.target.value)}
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
          Variable
          <select
            aria-label="Variable"
            value={variable}
            onChange={(event) =>
              setVariable(event.target.value as ClimateVariable)
            }
          >
            {VARIABLES.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label} ({item.unit})
              </option>
            ))}
          </select>
        </label>
        <label>
          Mode carte
          <select
            aria-label="Mode carte"
            value={mapMode}
            onChange={(event) =>
              setMapMode(event.target.value as 'availability' | 'anomaly')
            }
          >
            <option value="availability">Disponibilité</option>
            <option value="anomaly">Anomalie 1991–2020</option>
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
          Erreur réseau ou données nationales indisponibles. Aucun fallback
          démo.{' '}
          <button
            onClick={() => {
              setDay(emptyTerritory);
              setContextDay(emptyContext);
              setHistory(emptyTerritory);
              setContextHistory(emptyContext);
              setRetry(retry + 1);
            }}
          >
            Réessayer
          </button>
        </p>
      )}
      {mapMode === 'anomaly' && contextDay.state === 'error' && (
        <p role="alert">
          Contexte climatique indisponible : la carte d’anomalie ne peut pas
          être calculée. Les observations restent accessibles.
        </p>
      )}

      {mapMode === 'availability' ? (
        <>
          <ul className="national-legend" aria-label="Disponibilité des PRA">
            {(['complete', 'partial', 'unavailable'] as const).map((state) => (
              <li key={state}>
                <span className={`national-dot ${state}`} />
                {state}
                {counts ? ` · ${counts[state]}` : ''}
              </li>
            ))}
          </ul>
          <p className="national-help">
            Les couleurs indiquent la disponibilité, pas un risque.
          </p>
        </>
      ) : (
        <>
          <ul className="national-legend" aria-label="Anomalie climatique">
            <li>
              <span className="national-dot anomaly-below" /> en dessous de la
              normale (&lt; −1 {definition.unit})
            </li>
            <li>
              <span className="national-dot anomaly-near" /> proche de la
              normale (±1 {definition.unit})
            </li>
            <li>
              <span className="national-dot anomaly-above" /> au-dessus de la
              normale (&gt; +1 {definition.unit})
            </li>
          </ul>
          <p className="national-help">
            Mode exploratoire : seuil visuel simple de ±1 {definition.unit}.
            Une référence ou observation absente reste sans classe.
          </p>
        </>
      )}

      <div className="national-grid">
        <div>
          {collection && (
            <NationalMap
              collection={collection}
              rows={rows}
              contextRows={contextRows}
              mode={mapMode}
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

        <section className="national-search" aria-label="Navigation territoriale">
          <h2>Choisir une PRA</h2>
          <label>
            Rechercher une PRA
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nom, code, département"
              maxLength={100}
            />
          </label>
          <label>
            PRA
            <select
              aria-label="PRA"
              size={8}
              value={selected}
              onChange={(event) => choose(event.target.value)}
            >
              <option value="" disabled>
                Choisir un territoire
              </option>
              {matches.map((item) => (
                <option key={String(item.id)} value={String(item.id)}>
                  {item.properties.name} · {item.properties.code} ·{' '}
                  {rows
                    ? availability(byId.get(String(item.id)))
                    : 'données non chargées'}
                </option>
              ))}
            </select>
          </label>
          <p>{matches.length} PRA dans la recherche · 713 contours.</p>
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
                <a href="#pra-diagnostic">Diagnostic climatique</a>
                <a href="#pra-history">Historique 30 jours</a>
              </nav>
            </>
          )}
        </section>
      </div>

      {selected && (
        <section
          id="pra-diagnostic"
          className="national-panel"
          aria-label="Diagnostic climatique"
        >
          <h2>
            Diagnostic climatique · {feature?.properties.name || selected}
          </h2>
          {current ? (
            <>
              <p>
                Date UTC : {date} · <strong>{availability(current)}</strong> ·
                ERA5-Land · fraîcheur : {current.freshness}
              </p>
              <dl className="national-values">
                {VARIABLES.map((item, index) => {
                  const climate = selectedContext.get(item.key);
                  return (
                    <div key={item.key}>
                      <dt>
                        {item.label} ({item.unit})
                      </dt>
                      <dd>Observé : {valueLabel(current[item.key])}</dd>
                      <dd>
                        Normale 1991–2020 :{' '}
                        {valueLabel(climate?.normal_1991_2020)}
                      </dd>
                      <dd>
                        Anomalie : {anomalyLabel(climate?.anomaly, item.unit)} ·{' '}
                        {anomalyBand(climate?.anomaly)}
                      </dd>
                      <dd>Couverture actuelle : {coverage(current, index)}</dd>
                      <dd>
                        Référence :{' '}
                        {climate?.sample_years == null
                          ? 'indisponible'
                          : `${climate.sample_years}/${climate.expected_years} années`}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              <details>
                <summary>Provenance et qualité</summary>
                <p>Observation : ERA5-Land, méthode pra-native-1.</p>
                <p>
                  Référence : ERA5-Land 1991–2020, édition{' '}
                  {NATIONAL.climatology}.
                </p>
                <p>Référentiel : {NATIONAL.reference}</p>
                <p>Lot observation : {current.batch_key || 'absent'}</p>
              </details>
            </>
          ) : (
            <p>Aucune valeur affichée pour la PRA/date sélectionnée.</p>
          )}
          <p>
            Contexte climatique exploratoire. L’anomalie est NULL si
            l’observation ou la normale est absente. THI bovin non calculé.
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
          {(history.state === 'loading' ||
            contextHistory.state === 'loading') && (
            <p role="status">Chargement des observations et normales…</p>
          )}
          {(history.state === 'error' || contextHistory.state === 'error') && (
            <p role="alert">
              Historique ou référence indisponible. Aucun résultat de
              remplacement.{' '}
              <button
                onClick={() => {
                  setHistory(emptyTerritory);
                  setContextHistory(emptyContext);
                  setRetry(retry + 1);
                }}
              >
                Réessayer
              </button>
            </p>
          )}
          {history.state === 'ready' &&
            history.data &&
            contextHistory.state === 'ready' &&
            contextHistory.data && (
              <>
                <HistoryChart
                  rows={history.data}
                  context={contextHistory.data}
                  variable={variable}
                />
                <div className="national-table">
                  <table>
                    <caption>
                      Observé vs normale 1991–2020 · NULL conservés
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Date UTC</th>
                        <th scope="col">État</th>
                        <th scope="col">Observé</th>
                        <th scope="col">Normale</th>
                        <th scope="col">Anomalie</th>
                        <th scope="col">Référence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.data.map((row) => {
                        const climate = contextHistory.data!.find(
                          (item) =>
                            item.date === row.valid_date &&
                            item.variable === variable,
                        );
                        return (
                          <tr key={row.valid_date}>
                            <th scope="row">
                              <button onClick={() => changeDate(row.valid_date!)}>
                                {row.valid_date}
                              </button>
                            </th>
                            <td>{availability(row)}</td>
                            <td>{valueLabel(row[variable])}</td>
                            <td>
                              {valueLabel(climate?.normal_1991_2020)}
                            </td>
                            <td>
                              {anomalyLabel(
                                climate?.anomaly,
                                definition.unit,
                              )}
                            </td>
                            <td>
                              {climate?.sample_years == null
                                ? climate?.normal_status || 'indisponible'
                                : `${climate.sample_years}/${climate.expected_years}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
        </section>
      )}

      <footer>
        <p>
          Référentiel OFB/MASA avec réserves géographiques documentées. Aucun
          fallback vers Météo-France ou la démo.
        </p>
      </footer>
    </main>
  );
}

function HistoryChart({
  rows,
  context,
  variable,
}: {
  rows: TerritoryRow[];
  context: ClimateContextRow[];
  variable: ClimateVariable;
}) {
  const normals = new Map(
    context
      .filter((item) => item.variable === variable && item.date)
      .map((item) => [item.date!, item.normal_1991_2020]),
  );
  const values = rows.flatMap((row) => {
    const normal = row.valid_date ? normals.get(row.valid_date) : null;
    return [
      ...(row[variable] == null ? [] : [row[variable]!]),
      ...(normal == null ? [] : [normal]),
    ];
  });
  if (!values.length)
    return <p>Aucune valeur ni normale disponible sur les 30 jours.</p>;

  const low = Math.min(...values),
    high = Math.max(...values),
    span = high - low || 1;

  const pathFor = (kind: 'observed' | 'normal') => {
    const paths: string[] = [];
    let segment = '';
    rows.forEach((row, index) => {
      const value =
        kind === 'observed'
          ? row[variable]
          : row.valid_date
            ? normals.get(row.valid_date)
            : null;
      if (value == null) {
        if (segment) paths.push(segment);
        segment = '';
      } else {
        segment += `${segment ? ' L' : 'M'} ${20 + index * 20} ${
          130 - ((value - low) / span) * 110
        }`;
      }
    });
    if (segment) paths.push(segment);
    return paths;
  };

  const observedPaths = pathFor('observed'),
    normalPaths = pathFor('normal');

  return (
    <figure className="national-chart">
      <svg
        viewBox="0 0 620 155"
        role="img"
        aria-label="Comparaison des valeurs observées et de la normale 1991–2020 sur 30 jours."
      >
        {normalPaths.map((path, index) => (
          <path
            key={`n-${index}`}
            className="normal-line"
            d={path}
            fill="none"
            strokeWidth="2"
            strokeDasharray="6 4"
          />
        ))}
        {observedPaths.map((path, index) => (
          <path
            key={`o-${index}`}
            className="observed-line"
            d={path}
            fill="none"
            strokeWidth="2"
          />
        ))}
      </svg>
      <figcaption>
        Trait plein : observé · pointillé : normale 1991–2020 · min.{' '}
        {valueLabel(low)} / max. {valueLabel(high)}.
      </figcaption>
    </figure>
  );
}
