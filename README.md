# AgriclimaX — Codex Starter v2

> **Observer. Comprendre. Anticiper.**  
> L'observatoire des risques climatiques agricoles.

Ce dépôt est le socle de développement **contract-first** d'AgriclimaX : plateforme scientifique d'observation, de veille et d'anticipation des risques climatiques pour les productions végétales et animales.

## Principes non négociables

1. **Le nom canonique du produit est `AgriclimaX`.** `agriclimax` est utilisé pour les identifiants techniques ne nécessitant pas la casse de marque.
2. **La science et la présentation sont découplées.** Les couleurs UI ne déterminent jamais les seuils scientifiques.
3. **Ne jamais confondre** : aléa (`hazard`), exposition (`exposure`), sensibilité (`sensitivity`), risque (`risk`) et confiance (`confidence`).
4. **Toute conclusion est traçable** jusqu'aux données, paramètres, versions de règles et sources.
5. **L'IA rédige, elle ne fabrique pas les faits.** Les synthèses IA sont dérivées de faits structurés et citent les sources disponibles.
6. **Desktop, tablette et mobile sont trois compositions**, pas un simple redimensionnement.
7. **Le mode démo est isolé et explicitement fictif.**
8. Commencer simple : Next.js + MapLibre + Supabase/PostGIS + Python + GitHub Actions + Vercel. Ajouter une infrastructure seulement après mesure d'un besoin réel.

## Espaces produit

- **Observation** : carte, filtres, couches, comparaison temporelle et territoriale.
- **Veille** : signaux structurés, chronologie, synthèses, fraîcheur, provenance.
- **Diagnostic** : indicateurs, séries, méthodes, seuils, sources, incertitudes.

## Démarrage Codex

Lire `START_HERE_CODEX.md`. Ne pas lancer tous les workstreams avant la fin de la Wave 0.

## Structure

```text
apps/web/                  Next.js App Router + MapLibre
engine/                    moteur scientifique Python
config/                    espèces, indicateurs, règles et sources
contracts/                 schémas versionnés partagés
supabase/                  migrations + SQL/RPC
fixtures/                  données fictives de démonstration
docs/product/              produit et architecture UX
docs/design/               marque et design system
docs/science/              gouvernance scientifique
docs/architecture/         architecture et ADR
docs/codex/tasks/          prompts exécutables par Codex
.github/workflows/          CI + pipeline quotidien
```

## Cibles MVP

Le starter vise une V0 démontrable puis une V1 scientifique. Les premières productions proposées sont blé tendre, maïs, colza, tournesol, vigne, pommier, prairie, bovin lait et bovin viande. Elles restent **provisoires tant qu'elles ne sont pas validées scientifiquement**.
