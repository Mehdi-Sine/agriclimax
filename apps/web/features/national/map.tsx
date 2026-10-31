'use client';
import { useEffect, useRef, useState } from 'react';
import type { Map as LibreMap, ExpressionSpecification } from 'maplibre-gl';
import type { FeatureCollection, Geometry } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { availability } from './model';
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
  selected,
  onSelect,
}: {
  collection: PraCollection;
  rows: TerritoryRow[] | null;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<LibreMap | null>(null),
    select = useRef(onSelect);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [hover, setHover] = useState('');
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    let disposed = false;
    async function setup() {
      try {
        const lib = await import('maplibre-gl');
        if (disposed || !container.current) return;
        lib.setWorkerUrl('/maps/maplibre/maplibre-gl-worker.mjs');
        const css = getComputedStyle(document.documentElement),
          color = (token: string) => css.getPropertyValue(token).trim();
        const stateColor: ExpressionSpecification = [
          'match',
          ['coalesce', ['feature-state', 'availability'], 'absent'],
          'complete',
          color('--national-complete'),
          'partial',
          color('--national-partial'),
          'unavailable',
          color('--national-unavailable'),
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
        m.addControl(new lib.NavigationControl({ showCompass: false }));
        m.addControl(
          new lib.AttributionControl({
            compact: true,
            customAttribution: 'PRA · OFB / MASA · contours source inchangés',
          }),
        );
        m.on('load', () => {
          if (disposed) return;
          m.addSource('pra', {
            type: 'geojson',
            data: collection,
            promoteId: 'code',
          });
          m.addLayer({
            id: 'pra-fill',
            type: 'fill',
            source: 'pra',
            paint: { 'fill-color': stateColor, 'fill-opacity': 0.8 },
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
                0.5,
              ],
            },
          });
          m.on('click', 'pra-fill', (e) => {
            const code = e.features?.[0]?.properties?.code;
            if (typeof code === 'string') select.current(`pra:${code}`);
          });
          m.on('mousemove', 'pra-fill', (e) => {
            m.getCanvas().style.cursor = 'pointer';
            const f = e.features?.[0],
              p = f?.properties;
            setHover(
              p
                ? `${p.name} · ${p.code} · ${f?.state?.availability || 'absent'}`
                : '',
            );
          });
          m.on('mouseleave', 'pra-fill', () => {
            m.getCanvas().style.cursor = '';
            setHover('');
          });
          setReady(true);
        });
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
  }, [collection]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const byId = new Map(rows?.map((r) => [r.id, r]));
    for (const f of collection.features)
      map.current.setFeatureState(
        { source: 'pra', id: f.properties.code },
        {
          availability: availability(byId.get(String(f.id))),
          selected: f.id === selected,
        },
      );
  }, [ready, rows, selected, collection]);
  useEffect(() => {
    if (!ready || !map.current || !selected) return;
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
  }, [ready, selected, collection]);
  // Source coordinates are immutable; date changes update feature-state only.
  return (
    <section aria-label="Carte des 713 PRA" className="national-map-wrap">
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
        Vue nationale · 713 PRA
      </button>
      <div
        ref={container}
        className="national-map"
        data-ready={ready}
        data-feature-count={collection.features.length}
      />
      {!ready && !failed && <p role="status">Chargement des 713 contours…</p>}
      {failed && (
        <p role="alert">
          Carte indisponible. La recherche et la liste permettent toujours de
          sélectionner une PRA.
        </p>
      )}
      <p className="national-hover" aria-live="polite">
        {hover ||
          'Sélectionnez un contour ou utilisez la recherche et la liste.'}
      </p>
    </section>
  );
}
