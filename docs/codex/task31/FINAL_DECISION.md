# Décision finale Task 31

`READY_FOR_UNATTENDED_DAILY_DEV = NO` à ce stade : les corrections et les validations sans acquisition sont livrées, mais un premier cycle quotidien complet utilisant ce nouveau code n'a pas encore été observé sur `main`. Ce verdict est indépendant de la santé actuellement positive des archives, de la réussite des tests et de la future conclusion CI.

## Résultat livré

Reprises réseau bornées et budgétées ; réutilisation des champs natifs ; restauration automatique contrôlée ; caches IFS par cycle ; export d'un seul cycle ; agrégation ERA5 avec suivi conservateur du quota ; continuations verrouillées sur la journée du checkpoint ; séparation publication/workflow ; fraîcheur du cycle ; retard estimé du cron ; erreurs par source, échecs consécutifs, rapport de consommation et notification technique native Actions.

## Validation

| Exigence | Preuve |
| --- | --- |
| Interruption réseau | Injection WCS indisponible puis réponse valide ; retries limités ; 401/403 sans répétition ; IFS backoff/Retry-After et refus de range invalide |
| Reprise checkpoint | Nouveau provider WCS sans requête ni modification des fichiers ; corruption refusée ; dernier artifact ERA5 préféré, téléchargement connu en erreur bloquant |
| Rejeu sans acquisition/écriture distante | Rejeux **réels** météo et ERA5 : `evidence/*replay-real.json` ; écriture locale des reçus seulement |
| Échec préservant l'ancien cycle | Tests de frontières existants et panne injectée dans le pipeline, avec ancien pointeur fichier conservé : `evidence/publication-local.json` |
| Reprise ERA5 | Checkpoint natif conservé, agrégation/rejeu sans acquisition ; incident réel repris avec 713 lignes et zéro requête source ; continuation explicite de la même journée |
| Statuts/fraîcheur | Tests indépendants publication saine / workflow échoué, ERA5 récupéré, retard 395 min, file runner, échecs successifs, âge de cycle plutôt qu'âge du téléchargement |
| Publication et lecture d'un nouveau cycle | Deux vrais cycles conservés publiés successivement et relus intégralement dans un **stockage local isolé**, via le vrai code de publication et de validation ; candidat invalide et rejeu sans écriture. Aucune nouvelle publication distante de recette |

Les commandes de rejeu et relance sont dans `RETRY_AND_RESUME.md`. Le script `evidence/verify_publication.py` reproduit l'acceptation avec trois lectures d'archives DEV puis un transport fichier local ; il ne publie jamais à distance. Les valeurs des cycles ne sont pas modifiées.

## Conditions pour passer à YES

1. CI finale verte sur le SHA livré et revue de la PR, conservée en draft pendant Task 31.
2. Après intégration autorisée, observer un schedule ou dispatch DEV borné utilisant ce code : nouveau cycle valide publié et relu, ou reprise du cycle interrompu à partir d'un artifact disponible, puis rapport quotidien cohérent. Ne pas relancer une acquisition nationale complète pour cette seule preuve.
3. Vérifier la réception des notifications natives GitHub Actions chez l'opérateur. Un événement schedule totalement absent nécessite encore une observation externe/manuelle ; GitHub ne garantit pas une heure de lancement.

Il n'est pas nécessaire de recréer une infrastructure de planification pour valider ces conditions. Aucune autorisation ni aucun secret supplémentaire n'a été demandé ; aucune fusion, modification d'historique ou activation de service payant n'est réalisée.

## Contrôles finaux

Voir `evidence/validation.json` pour les résultats ciblés, les contrôles statiques, la CI finale et ses SHA. Les limites du verdict ne sont pas remplacées par un contrôle de fraîcheur positif.
