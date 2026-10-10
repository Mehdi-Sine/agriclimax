# Task 08 — Scientific Diagnostic

**Branche :** `codex/08-diagnostic`

## Objectif
Construire la vue d'explicabilité qui permet à un expert d'auditer un risque.

## Scope
- valeur observée/calculée/prévision clairement distinguées ;
- série temporelle ;
- seuils et classes ;
- rule_id/version/status ;
- sources ;
- fraîcheur/couverture/quality flags ;
- confidence séparée ;
- limites ;
- lien documentation méthode ;
- layout desktop drawer/panel et mobile full sheet.

## Règles communes
Lire `AGENTS.md` et la documentation liée. Ne pas modifier `contracts/` sans procédure. Travailler sur la branche indiquée. Ajouter tests et documentation. À la fin : commandes exécutées, résultats, fichiers modifiés, risques/limites, résumé PR.

## Critères d'acceptation
- aucune information scientifique essentielle cachée derrière couleur seule ;
- unités/dates visibles ;
- source absente = explicitement “source non renseignée”, jamais inventée ;
- tests états complets.
