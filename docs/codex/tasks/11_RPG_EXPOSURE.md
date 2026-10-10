# Task 11 — Rpg Exposure

**Branche :** `codex/11-rpg-exposure`

## Objectif
Ajouter l'exposition agricole à partir d'un référentiel parcellaire/occupation adapté, sans confondre présence de culture et risque.

## Scope
- ingestion versionnée ;
- mapping cultures → production IDs ;
- agrégation par cellule/territoire ;
- année de campagne ;
- surface/part exposée ;
- provenance/licence ;
- UI optionnelle “zones de production”.

## Règles communes
Lire `AGENTS.md` et la documentation liée. Ne pas modifier `contracts/` sans procédure. Travailler sur la branche indiquée. Ajouter tests et documentation. À la fin : commandes exécutées, résultats, fichiers modifiés, risques/limites, résumé PR.

## Critères d'acceptation
- exposition peut être absente sans modifier hazard ;
- millésime visible ;
- agrégations reproductibles ;
- aucune donnée individuelle sensible ajoutée.
