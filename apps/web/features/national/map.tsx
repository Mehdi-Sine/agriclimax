'use client';
import { useEffect, useRef, useState } from 'react';
import type { Map as LibreMap, GeoJSONSource, ExpressionSpecification } from 'maplibre-gl';
import type { FeatureCollection, Geometry } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { anomalyBand, availability, type ClimateContextRow } from './model';
import type { TerritorialValue } from '../unified/model';
import type { AgriculturalStatus } from '../agriculture/model';
import type { TerritoryRow } from '../../lib/server/territories';

export type PraProperties = {
  code: string;
  name: string;
  department_name: string;
  region_name: string;
};
export type PraCollection = FeatureCollection<Geometry, PraProperties>;

export default function NationalMap({
  collection,
  rows,
  contextRows,
  mode,
  selected,
  onSelect,
  quantitative,
  geography = { prefix: 'pra:', label: '713 PRA', attribution: 'PRA · OFB / MASA · contours source inchangés' },
}: {
  collection: PraCollection;
  rows: TerritoryRow[] | null;
  contextRows: ClimateContextRow[] | null;
  mode: 'availability' | 'anomaly';
  selected: string;
  onSelect: (id: string) => void;
  quantitative?: { values: (Pick<TerritorialValue, 'territoryId' | 'value' | 'normal' | 'anomaly'> & { status: TerritorialValue['status'] | AgriculturalStatus })[]; field: 'value' | 'normal' | 'anomaly'; unit: string; bounds: number[]; colors: string[] };
  geography?: { prefix: string; label: string; attribution: string };
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<LibreMap | null>(null),
    select = useRef(onSelect),
    modeRef = useRef(mode),
    quantRef = useRef(quantitative),
    collectionRef = useRef(collection),
    geographyRef = useRef(geography);
  const [ready, setReady] = useState(false),
    [rendered, setRendered] = useState(false),
    [failed, setFailed] = useState(false),
    [hover, setHover] = useState('');

  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    modeRef.current = mode;
    quantRef.current = quantitative;
    collectionRef.current = collection;
    geographyRef.current = geography;
  }, [mode, quantitative, collection, geography]);

  useEffect(() => {
    let disposed = false;
    async function setup() {
      try {
        const lib = await import('maplibre-gl');
        if (disposed || !container.current) return;
        lib.setWorkerUrl('/maps/maplibre/maplibre-gl-worker.mjs');
        const css = getComputedStyle(document.documentElement),
          color = (token: string) => css.getPropertyValue(token).trim();
        const fill: ExpressionSpecification = [
          'match',
          ['coalesce', ['feature-state', 'display'], 'missing'],
          'complete',
          color('--national-complete'),
          'partial',
          color('--national-partial'),
          'unavailable',
          color('--national-unavailable'),
          'above',
          color('--national-anomaly-above'),
          'near',
          color('--national-anomaly-near'),
          'below',
          color('--national-anomaly-below'),
          color('--surface-subtle'),
        ];
        const m = new lib.Map({
          container: container.current,
          bounds: [
            [-5.3, 41.3],
            [9.8, 51.2],
          ],
          fitBoundsOptions: { padding: 20 },
          renderWorldCopies: false,
          minZoom: 3,
          maxZoom: 13,
          attributionControl: false,
          style: {
            version: 8,
            sources: {},
            layers: [
              {
                id: 'background',
                type: 'background',
                paint: { 'background-color': color('--surface-subtle') },
              },
            ],
          },
        });
        map.current = m;
        const observer = new ResizeObserver(() => m.resize());
        observer.observe(container.current);
        m.on('remove', () => observer.disconnect());
        m.addControl(new lib.NavigationControl({ showCompass: false }));
        m.addControl(
          new lib.AttributionControl({
            compact: true,
            customAttribution: 'PRA · OFB / MASA ; départements et régions · Etalab 2025 · Licence Ouverte',
          }),
        );
        m.on('load', () => {
          if (disposed) return;
          m.addSource('pra', {
            type: 'geojson',
            data: collectionRef.current,
            promoteId: 'code',
          });
          m.addLayer({
            id: 'pra-fill',
            type: 'fill',
            source: 'pra',
            paint: { 'fill-color': ['coalesce', ['feature-state', 'color'], fill], 'fill-opacity': ['case', ['boolean', ['feature-state', 'suppressed'], false], 0.4, 0.9] },
          });
          m.addLayer({
            id: 'pra-outline',
            type: 'line',
            source: 'pra',
            paint: {
              'line-color': color('--text-primary'),
              'line-width': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                3,
                ['case', ['boolean', ['feature-state', 'partial'], false], 1.6, 0.5],
              ],
            },
          });
          m.on('click', 'pra-fill', (e) => {
            const code = e.features?.[0]?.properties?.code;
            if (typeof code === 'string') select.current(`${geographyRef.current.prefix}${code}`);
          });
          m.on('mousemove', 'pra-fill', (e) => {
            m.getCanvas().style.cursor = 'pointer';
            const f = e.features?.[0],
              p = f?.properties,
              display = f?.state?.display || 'missing',
              anomaly = f?.state?.anomaly;
            setHover(
              p && quantRef.current
                ? `${p.name} · ${p.code} · ${typeof f?.state?.value === 'number' ? new Intl.NumberFormat('fr-FR', {maximumFractionDigits:2}).format(f.state.value) + ' ' + quantRef.current.unit : 'Indisponible'} · ${f?.state?.quality || 'indisponible'}`
                : p
                ? modeRef.current === 'anomaly' && typeof anomaly === 'number'
                  ? `${p.name} · ${p.code} · anomalie ${anomaly > 0 ? '+' : ''}${anomaly.toFixed(2)}`
                  : `${p.name} · ${p.code} · ${display}`
                : '',
            );
          });
          m.on('mouseleave', 'pra-fill', () => {
            m.getCanvas().style.cursor = '';
            setHover('');
          });
          setReady(true);
        });
        m.on('idle', () => { if (m.getSource('pra') && m.isSourceLoaded('pra')) setRendered(true); });
        m.on('error', () => setFailed(true));
      } catch {
        if (!disposed) setFailed(true);
      }
    }
    void setup();
    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Keep the same MapLibre canvas across spaces/scales; replace only GeoJSON data.
  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.removeFeatureState({ source: 'pra' });
    (map.current.getSource('pra') as GeoJSONSource).setData(collection);
  }, [ready, collection]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const byId = new Map(rows?.map((r) => [r.id, r]));
    const quantitativeById = new Map(quantitative?.values.map(r=>[r.territoryId,r]));
    const css = getComputedStyle(document.documentElement);
    const contextById = new Map(contextRows?.map((r) => [r.pra_id, r]));
    for (const f of collection.features) {
      const id = String(f.id);
      const climate = contextById.get(id);
      const q = quantitativeById.get(id);
      const value = q && quantitative ? q[quantitative.field] : null;
      const band = value == null || !quantitative ? -1 : quantitative.bounds.findIndex(b=>value<=b);
      const ink = quantitative ? (band<0 ? quantitative.colors.at(-1)! : quantitative.colors[band]) : null;
      map.current.setFeatureState(
        { source: 'pra', id: f.properties.code },
        {
          display:
            mode === 'anomaly'
              ? anomalyBand(climate?.anomaly)
              : availability(byId.get(id)),
          color: quantitative ? (value == null ? css.getPropertyValue('--national-unavailable').trim() : ink) : null,
          value: value ?? null,
          quality: q ? ({ available: 'Disponible', partial: 'Partiel', unavailable: 'Indisponible', not_applicable: 'Non applicable', source_error: 'Erreur source', suppressed: 'Secret statistique', stale: 'Ancien millésime' }[q.status]) : 'Indisponible',
          suppressed: q?.status === 'suppressed',
          partial: q?.status === 'partial',
          anomaly: climate?.anomaly ?? null,
          selected: f.id === selected,
        },
      );
    }
  }, [ready, rows, contextRows, mode, selected, collection, quantitative]);

  useEffect(() => {
    if (!ready || !map.current || !selected || quantitative) return;
    const geometry = collection.features.find(
      (f) => f.id === selected,
    )?.geometry;
    const points =
      geometry?.type === 'MultiPolygon'
        ? geometry.coordinates.flat(2)
        : geometry?.type === 'Polygon'
          ? geometry.coordinates.flat()
          : [];
    if (!points.length) return;
    const xs = points.map((p) => p[0]),
      ys = points.map((p) => p[1]);
    map.current.fitBounds(
      [
        [Math.min(...xs), Math.min(...ys)],
        [Math.max(...xs), Math.max(...ys)],
      ],
      { padding: 45, maxZoom: 10, duration: 0 },
    );
  }, [ready, selected, collection, quantitative]);

  return (
    <section aria-label={`Carte des ${geography.label}`} className="national-map-wrap">
      <button
        type="button"
        onClick={() =>
          map.current?.fitBounds(
            [
              [-5.3, 41.3],
              [9.8, 51.2],
            ],
            { padding: 20, duration: 0 },
          )
        }
      >
        Vue nationale · {geography.label}
      </button>
      <div
        ref={container}
        className="national-map"
        data-ready={ready && rendered}
        data-feature-count={collection.features.length}
        data-mode={mode}
      />
      {!ready && !failed && <p role="status">Chargement des contours · {geography.label}…</p>}
      {failed && (
        <p role="alert">
          Carte indisponible. La recherche permet toujours de
          sélectionner une PRA.
        </p>
      )}
      <p className="national-hover" aria-live="polite">
        {hover ||
          'Survolez un territoire pour lire sa valeur. Cliquez pour ouvrir sa fiche.'}
      </p>
    </section>
  );
}
