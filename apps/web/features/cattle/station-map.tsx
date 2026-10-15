'use client';
import { useEffect, useRef, useState } from 'react';
import type { WeatherStation } from '../../lib/server/station-weather';
import { readBasemap } from '../observation/adapter';
import 'maplibre-gl/dist/maplibre-gl.css';
export function StationMap({stations, selected, href, value}: {stations: WeatherStation[]; selected: string; href: string; value: number | null}) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    const controller = new AbortController();
    async function setup() {
      try {
        const [lib, land] = await Promise.all([import('maplibre-gl'), readBasemap(controller.signal)]);
        if (disposed || !container.current) return;
        lib.setWorkerUrl('/maps/maplibre/maplibre-gl-worker.mjs');
        const css = getComputedStyle(document.documentElement);
        const color = (token: string) => css.getPropertyValue(token).trim();
        const map = new lib.Map({container: container.current, center: [2,47], zoom: 4,
          style: {version: 8, sources: {}, layers: [{id: 'background', type: 'background', paint: {'background-color': color('--surface-subtle')}}]}});
        cleanup = () => map.remove();
        map.addControl(new lib.NavigationControl());
        map.addControl(new lib.AttributionControl({customAttribution: 'Météo-France · Natural Earth (domaine public)'}));
        map.on('load', () => {
          map.addSource('land', {type: 'geojson', data: land});
          map.addLayer({id: 'land', type: 'fill', source: 'land', paint: {'fill-color': color('--surface-base')}});
          for (const station of stations) {
            const link = document.createElement('a');
            link.textContent = station.id === selected ? `● THI ${value?.toFixed(1) ?? 'indisponible'}` : '○';
            link.className = 'button button-secondary';
            link.setAttribute('aria-label', `${station.name} · ${station.id}${station.id === selected ? ` · THI ${value ?? 'indisponible'}` : ' · sélectionner pour calculer'}`);
            const url = new URL(href, location.origin); url.searchParams.set('station', station.id); link.href = `${url.pathname}${url.search}`;
            new lib.Marker({element: link}).setLngLat([station.longitude, station.latitude]).addTo(map);
          }
        });
        map.on('error', () => { if (!disposed) setFailed(true); });
      } catch { if (!disposed) setFailed(true); }
    }
    void setup();
    return () => { disposed = true; controller.abort(); cleanup?.(); };
  }, [stations, selected, href, value]);
  return <><div ref={container} className="cattle-map" role="region" aria-label="Carte des stations Météo-France, sélection aussi disponible dans le formulaire" />{failed && <p role="status">Carte indisponible. Utilisez la liste des stations ci-dessous.</p>}</>;
}
