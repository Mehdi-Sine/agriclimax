# Task 04 — Postgis Api

**Branche :** `codex/04-postgis-api`

## Objectif
Établir la persistance, RLS et une API serveur géospatiale efficace, compatible avec un futur passage aux tuiles.

## Scope
- migrations core supplémentaires : observations, indicators, run manifests, parameter/rule metadata ;
- RLS explicite ;
- vues/RPC de lecture publique strictement nécessaires ;
- server repository Next.js ;
- requêtes bbox + simplification adaptée au zoom ;
- agrégations territoriales ;
- EXPLAIN sur jeux synthétiques ;
- stratégie retention/indexes.
Service role uniquement serveur/CI.

## Règles communes
Lire `AGENTS.md` et la documentation liée. Ne pas modifier `contracts/` sans procédure. Travailler sur la branche indiquée. Ajouter tests et documentation. À la fin : commandes exécutées, résultats, fichiers modifiés, risques/limites, résumé PR.

## Critères d'acceptation
- tests SQL ;
- pas de table scientifique mutable depuis client ;
- requête carte filtrée production/date/indicateur/bbox ;
- contrat d'erreur stable ;
- performance documentée sur seed synthétique.
