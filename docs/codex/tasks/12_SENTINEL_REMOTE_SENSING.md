# Task 12 — Sentinel Remote Sensing

**Branche :** `codex/12-sentinel`

## Objectif
Ajouter une première couche de télédétection comme signal complémentaire, pas comme vérité terrain.

## Scope
- provider abstrait ;
- NDVI/NDMI ou produit retenu ;
- cloud masking/quality ;
- temporal composite ;
- stockage références/COG si approprié ;
- rendu raster/tiles ;
- provenance/quality ;
- ne pas fusionner automatiquement avec risk sans règle validée.

## Règles communes
Lire `AGENTS.md` et la documentation liée. Ne pas modifier `contracts/` sans procédure. Travailler sur la branche indiquée. Ajouter tests et documentation. À la fin : commandes exécutées, résultats, fichiers modifiés, risques/limites, résumé PR.

## Critères d'acceptation
- couche activable séparément ;
- date d'acquisition/composite et couverture nuageuse visibles ;
- absence satellite n'efface pas le risque météo.
