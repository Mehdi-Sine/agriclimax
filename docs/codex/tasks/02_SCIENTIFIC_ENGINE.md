# Task 02 — Scientific Engine

**Branche :** `codex/02-scientific-engine`

## Objectif
Construire un moteur scientifique pur, testable, versionné et extensible à 50–100 productions sans dupliquer le code.

## Scope
- modèles typed pour météo, indicateurs, phénologie, règles, résultats ;
- GDD, seuils chaud/froid, séquences, cumul pluie, P-ET0, percentiles, THI ;
- fenêtres absolues et relatives à un stade ;
- evaluator générique des classes ;
- quality/confidence séparés du risk ;
- chargement config et provenance ;
- golden tests + propriétés/bornes.
Ne pas ajouter de seuil agronomique réel sans source et statut approprié.

## Règles communes
Lire `AGENTS.md` et la documentation liée. Ne pas modifier `contracts/` sans procédure. Travailler sur la branche indiquée. Ajouter tests et documentation. À la fin : commandes exécutées, résultats, fichiers modifiés, risques/limites, résumé PR.

## Critères d'acceptation
- fonctions déterministes ;
- unité explicite ;
- résultat conforme RiskResultV1 ;
- test de reproduction d'un résultat avec rule_version ;
- couverture des cas missing/stale/invalid.
