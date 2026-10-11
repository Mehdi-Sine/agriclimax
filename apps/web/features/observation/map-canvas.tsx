"use client";
import { useEffect, useRef, useState } from "react";
import type { Map, GeoJSONSource, ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Collection } from "./adapter";
import { readBasemap } from "./adapter";
import type { Viewport } from "./state";
import { Button, Sheet } from "../../components/ui/primitives";
import { DataState, RiskLegend } from "../../components/ui/scientific";

export default function MapCanvas({
  collection,
  viewport,
  selected,
  riskVisible,
  indicator,
  onMove,
  onSelect,
}: {
  collection: Collection;
  viewport: Viewport;
  selected: string | null;
  riskVisible: boolean;
  indicator: string;
  onMove: (v: Viewport) => void;
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);
  const current = useRef({ onMove, onSelect, viewport });
  useEffect(() => {
    current.current = { onMove, onSelect, viewport };
  }, [onMove, onSelect, viewport]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    async function setup() {
      try {
        const [lib, basemap] = await Promise.all([
          import("maplibre-gl"),
          readBasemap(controller.signal),
        ]);
        if (disposed || !container.current) return;
        lib.setWorkerUrl("/maps/maplibre/maplibre-gl-worker.mjs");
        const css = getComputedStyle(document.documentElement);
        const color = (token: string) => css.getPropertyValue(token).trim();
        const riskColors: ExpressionSpecification = [
          "match",
          ["get", "risk_level"],
          "low",
          color("--risk-low"),
          "moderate",
          color("--risk-moderate"),
          "high",
          color("--risk-high"),
          "critical",
          color("--risk-critical"),
          color("--risk-unavailable"),
        ];
        const v = current.current.viewport;
        const instance = new lib.Map({
          container: container.current,
          bounds: v.bounds,
          fitBoundsOptions: { padding: 25 },
          minZoom: 2,
          maxZoom: 18,
          renderWorldCopies: false,
          attributionControl: false,
          style: {
            version: 8,
            sources: {},
            layers: [
              {
                id: "background",
                type: "background",
                paint: { "background-color": color("--surface-subtle") },
              },
            ],
          },
        });
        map.current = instance;
        instance.addControl(
          new lib.AttributionControl({
            compact: false,
            customAttribution: "Natural Earth · domaine public",
          }),
        );
        instance.on("load", () => {
          if (disposed) return;
          instance.addSource("land", { type: "geojson", data: basemap });
          instance.addLayer({
            id: "land",
            type: "fill",
            source: "land",
            paint: { "fill-color": color("--surface-base") },
          });
          instance.addLayer({
            id: "borders",
            type: "line",
            source: "land",
            paint: { "line-color": color("--control-border"), "line-width": 1 },
          });
          instance.addSource("risks", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          instance.addLayer({
            id: "risk-fill",
            type: "fill",
            source: "risks",
            paint: { "fill-color": riskColors, "fill-opacity": 0.8 },
          });
          instance.addLayer({
            id: "risk-outline",
            type: "line",
            source: "risks",
            paint: { "line-color": color("--text-primary"), "line-width": 2 },
          });
          instance.addLayer({
            id: "selected",
            type: "line",
            source: "risks",
            filter: ["==", ["get", "cell_id"], ""],
            paint: { "line-color": color("--focus"), "line-width": 5 },
          });
          instance.on("click", "risk-fill", (e) => {
            const id: unknown = e.features?.[0]?.properties?.cell_id;
            if (typeof id === "string") current.current.onSelect(id);
          });
          instance.on("moveend", () => {
            const b = instance.getBounds();
            current.current.onMove({
              bounds: [
                Math.max(-180, b.getWest()),
                Math.max(-85, b.getSouth()),
                Math.min(180, b.getEast()),
                Math.min(85, b.getNorth()),
              ],
              zoom: instance.getZoom(),
            });
          });
          const canvas = instance.getCanvas();
          canvas.setAttribute(
            "aria-label",
            "Carte de France. Flèches : déplacer ; plus et moins : zoomer. Sélection également disponible dans le tableau des zones.",
          );
          setReady(true);
        });
        instance.on("error", () => {
          if (!disposed) setFailed(true);
        });
      } catch {
        if (!disposed) setFailed(true);
      }
    }
    void setup();
    return () => {
      disposed = true;
      controller.abort();
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !map.current) return;
    (map.current.getSource("risks") as GeoJSONSource).setData(collection);
    map.current.setFilter("selected", [
      "==",
      ["get", "cell_id"],
      selected ?? "",
    ]);
    for (const id of ["risk-fill", "risk-outline", "selected"])
      map.current.setLayoutProperty(
        id,
        "visibility",
        riskVisible ? "visible" : "none",
      );
  }, [ready, collection, selected, riskVisible]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const b = map.current.getBounds();
    const actual = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    if (actual.some((v, i) => Math.abs(v - viewport.bounds[i]) > 0.001)) {
      map.current.fitBounds(viewport.bounds, { padding: 0, duration: 0 });
    }
  }, [ready, viewport]);
  useEffect(() => {
    if (!ready || !map.current || !container.current) return;
    const instance = map.current;
    const resize = new ResizeObserver(() => instance.resize());
    resize.observe(container.current);
    const theme = new MutationObserver(() => {
      const css = getComputedStyle(document.documentElement);
      const color = (token: string) => css.getPropertyValue(token).trim();
      instance.setPaintProperty("background", "background-color", color("--surface-subtle"));
      instance.setPaintProperty("land", "fill-color", color("--surface-base"));
      instance.setPaintProperty("borders", "line-color", color("--control-border"));
      instance.setPaintProperty("risk-outline", "line-color", color("--text-primary"));
      instance.setPaintProperty("selected", "line-color", color("--focus"));
    });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { resize.disconnect(); theme.disconnect(); };
  }, [ready]);
  return (
    <div className="observation-map-frame">
      <div ref={container} className="observation-map" />
      <div
        className="observation-map-tools"
        role="group"
        aria-label="Commandes de la carte"
      >
        <Button
          aria-label="Zoom avant"
          onClick={() => map.current?.zoomIn({ duration: 0 })}
        >
          +
        </Button>
        <Button
          aria-label="Zoom arrière"
          onClick={() => map.current?.zoomOut({ duration: 0 })}
        >
          −
        </Button>
        <Button
          onClick={() =>
            map.current?.fitBounds([-5.5, 41, 10, 51.5], {
              padding: 25,
              duration: 0,
            })
          }
        >
          France
        </Button>
      </div>
      <div className="observation-mobile-legend"><Sheet title={`Légende · ${indicator}`} trigger="Légende"><RiskLegend /><p>Classes fournies par la source. Aucun seuil déduit des couleurs.</p></Sheet></div>
      {!ready && !failed && (
        <div className="observation-map-status">
          <DataState state="loading" />
        </div>
      )}
      {failed && (
        <div className="observation-map-status">
          <DataState state="source-error" />
          <p>
            Fond cartographique indisponible. Utilisez le tableau des zones.
          </p>
        </div>
      )}
    </div>
  );
}
