"use client";
import Link from "next/link";
import { useState } from "react";
import { BRAND } from "../../lib/brand";
import { BrandLockup } from "./brand";
import { ThemeToggle } from "./theme-toggle";
import {
  Button,
  Badge,
  Select,
  Combobox,
  Sheet,
  Drawer,
  Dialog,
  Panel,
  Tabs,
  Tooltip,
  Callout,
} from "../ui/primitives";
import {
  DATA_STATES,
  DataState,
  RiskLegend,
  ConfidenceBadge,
  FreshnessBadge,
  Metric,
  SourceChip,
  EvidenceList,
  IndicatorSparkline,
  ScientificMethodCard,
  MapLayerControl,
} from "../ui/scientific";
export function Catalogue() {
  const [text, setText] = useState("");
  const [tab, setTab] = useState("observation");
  const [layers, setLayers] = useState([
    { id: "climate", label: "Climat fictif", checked: true },
    { id: "production", label: "Production fictive", checked: false },
  ]);
  return (
    <>
      <header className="app-header">
        <BrandLockup />
        <div className="header-actions">
          <Link href="/">Retour au shell</Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="catalogue">
        <span className="eyebrow">Infrastructure produit · Task 05</span>
        <h1>Design system</h1>
        <p>{BRAND.descriptor}</p>
        <DataState state="demo" />
        <div className="catalogue-grid">
          <Panel title="Actions & navigation">
            <div className="badges">
              <Button variant="primary">Action principale</Button>
              <Button>Action secondaire</Button>
              <Button disabled>Indisponible</Button>
            </div>
            <Tabs
              label="Exemple de navigation"
              value={tab}
              onChange={setTab}
              options={[
                { value: "observation", label: "Observation" },
                { value: "watch", label: "Veille" },
              ]}
            />
            <p>Espace sélectionné : {tab}</p>
            <Tooltip label="Le niveau de risque ne représente pas la confiance.">
              <Badge>Information scientifique ⓘ</Badge>
            </Tooltip>
          </Panel>
          <Panel title="Filtres génériques">
            <div className="stack">
              <Select label="Production de démonstration">
                <option>Blé tendre</option>
                <option>Bovin lait</option>
              </Select>
              <Combobox
                label="Rechercher un territoire fictif"
                value={text}
                onChange={setText}
                options={["Territoire démo 001", "Territoire démo 002"]}
              />
              <MapLayerControl
                layers={layers}
                onChange={(id, checked) =>
                  setLayers(
                    layers.map((layer) =>
                      layer.id === id ? { ...layer, checked } : layer,
                    ),
                  )
                }
              />
            </div>
          </Panel>
          <Panel title="Risque ≠ confiance ≠ fraîcheur">
            <RiskLegend />
            <div className="badges">
              <ConfidenceBadge level="low" />
              <ConfidenceBadge level="high" />
              <FreshnessBadge freshness="fresh" />
              <FreshnessBadge freshness="stale" />
              <FreshnessBadge freshness="unknown" />
            </div>
          </Panel>
          <Panel title="Panneaux & détails">
            <div className="badges">
              <Sheet title="Filtres" trigger="Ouvrir sheet">
                <Callout title="Filtres génériques">
                  Les sheets conservent un contexte compact sur mobile.
                </Callout>
              </Sheet>
              <Drawer title="Sources" trigger="Ouvrir drawer">
                <EvidenceList
                  items={[
                    "Source fictive : demo-fiction",
                    "Date de collecte inconnue",
                  ]}
                />
              </Drawer>
              <Dialog title="Information" trigger="Ouvrir dialogue">
                <p>Les couleurs ne déterminent aucun seuil scientifique.</p>
              </Dialog>
            </div>
          </Panel>
          <Panel title="Indicateurs & provenance">
            <Metric label="Aléa fictif" value={3} unit="d" />
            <IndicatorSparkline values={[1, 2, 2, 3, 2, 4, 3]} />
            <SourceChip source="demo-fiction" />
          </Panel>
          <ScientificMethodCard version="0.1.0">
            <p>Fixture exploratoire, sans validation scientifique.</p>
            <EvidenceList
              items={[
                "Exposition et sensibilité indisponibles",
                "Donnée observée, indicateur calculé et prévision doivent être distingués",
                "Narration avec assistance IA : label explicite requis",
              ]}
            />
          </ScientificMethodCard>
          <Panel title="États de données">
            <div className="stack">
              {(Object.keys(DATA_STATES) as (keyof typeof DATA_STATES)[]).map(
                (state) => (
                  <DataState key={state} state={state} />
                ),
              )}
            </div>
          </Panel>
          <Panel title="Actifs de marque">
            <div className="stack">
              {[
                "logo-wordmark",
                "symbol",
                "app-icon",
                "logo-monochrome",
                "logo-dark",
              ].map((name) => (
                <a key={name} href={`/brand/${name}.svg`}>
                  {name}.svg
                </a>
              ))}
            </div>
            <p className="muted">
              Signal, horizon et point d’observation. SVG originaux et
              maintenables.
            </p>
          </Panel>
        </div>
      </main>
    </>
  );
}
