# Task 06 — Observation Map

**Branche :** `codex/06-observation-map`

## Objectif
Construire la vue Observation cartographique experte et sa composition mobile dédiée.

## Scope
- MapLibre v6 avec chargement client adapté à Next.js ;
- `MapRiskLayerAdapter` demo + API ;
- filtres production/indicateur/date ;
- bbox/URL state ;
- légende sémantique ;
- sélection cellule/territoire ;
- résumé local ;
- layers panel ;
- états missing/stale/error/demo ;
- mobile : map + context bar + filter sheet + bottom sheet ;
- desktop : map dominante + panneau redimensionnable/repliable.
Ne pas coupler la carte au GeoJSON comme format définitif.

## Règles communes
Lire `AGENTS.md` et la documentation liée. Ne pas modifier `contracts/` sans procédure. Travailler sur la branche indiquée. Ajouter tests et documentation. À la fin : commandes exécutées, résultats, fichiers modifiés, risques/limites, résumé PR.

## Critères d'acceptation
- deep-link reproductible ;
- carte navigable clavier autant que raisonnablement possible + alternative tabulaire pour info critique ;
- pas de couleur seule ;
- tests interaction ;
- 60fps cible sur fixture raisonnable, métriques documentées.
