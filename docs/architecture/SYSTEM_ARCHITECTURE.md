# Architecture système AgriclimaX

## Choix V1
- **Web** : Next.js App Router, TypeScript strict.
- **Carte** : MapLibre GL JS, client-only pour l'instance de carte.
- **DB** : Supabase PostgreSQL + PostGIS.
- **Moteur** : Python 3.12+, fonctions pures + Pydantic.
- **Orchestration** : GitHub Actions planifiées et manuelles.
- **Déploiement web** : Vercel.
- **Fichiers lourds** : stockage objet / fichiers temporaires ; jamais blobs NetCDF dans Postgres.

## Flux

```text
Sources météo / climat / satellite / RPG
              │
              ▼
       ingestion adapters
              │
              ▼
     canonical observations
              │
     ┌────────┴────────┐
     ▼                 ▼
indicators        phenology/context
     └────────┬────────┘
              ▼
     versioned risk engine
              │
     ┌────────┼─────────┐
     ▼        ▼         ▼
  results  evidence   quality
     │        │         │
     └────────┴─────────┘
              ▼
       Supabase/PostGIS
              │
      server-only API layer
              │
  ┌───────────┼───────────┐
  ▼           ▼           ▼
Observation  Veille    Diagnostic
```

## Évolution géospatiale
- V0 : fixtures GeoJSON.
- V1 : requêtes PostGIS bornées/simplifiées + GeoJSON.
- V1.5 : RPC d'agrégation et géométries pré-simplifiées.
- V2 : tuiles vectorielles si métriques de charge le justifient.
- Raster/COG pour couches continues Sentinel/climat si pertinent.

Le composant carte ne doit pas dépendre du format d'accès interne : `MapRiskLayerAdapter` masque GeoJSON/tile source.

## Cache
Pas de Redis par défaut. Utiliser d'abord cache HTTP/CDN, Next.js cache lorsque compatible avec fraîcheur scientifique et vues matérialisées/agrégations SQL.

## Décisions à documenter en ADR
Nouvelle DB, queue, service cartographique, worker permanent, framework d'orchestration, nouvelle librairie UI ou changement de moteur scientifique.
