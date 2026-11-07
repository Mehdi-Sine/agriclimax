# Supervision quotidienne

Le job final `weather-health`, exécuté même après échec des acquisitions, contrôle deux axes :

| Axe | Preuve / règle |
| --- | --- |
| Dernière publication | Archive relue et validée pour 713 PRA ; pointeur présent et égal au dernier cycle vérifié ; âge du cycle entre 0 et 36 h ; acquisition non future ; ERA5 au plus sept jours ; garde Storage |
| Traitement courant | Résultats réels de `national-weather`, `era5-archive`, `era5-resume-1`, `era5-resume-2`, incluant échec/annulation ; `acquisition_success=null` si aucun traitement demandé ; `workflow_success` inclut aussi le verdict final de supervision |
| ERA5 récupéré | Dernier stage non skipped réussi après échec initial ; l'échec initial reste visible dans le résultat du workflow |
| Sources | Dernière heure de modèle et d'acquisition par source publiée ; erreurs WCS avec source, opération, statut et tentative dans les reçus du traitement |
| Cron | `created_at` moins le créneau 08:20 UTC du même jour ; séparément, `run_started_at - created_at` pour l'attente du runner |
| Répétition | Échecs consécutifs parmi au plus 20 schedules terminés de la même branche ; nombre borné, pas une histoire exhaustive |

`published_cycle_at` donne l'identité réelle du cycle publié ; `acquired_at` donne la dernière acquisition de son document. `publication_timestamp=null` est explicite : le catalogue legacy n'enregistre pas l'heure exacte d'écriture ; elle n'est pas inventée. Les heures propres à chaque source évitent de confondre cycle WCS et IFS.

Le rapport `daily-monitoring/report.json` et le résumé Actions donnent causes, résultats des jobs, retard, reprise ERA5, compteurs et complétude du compte. Les artifacts d'évidence de chaque continuation sont conservés 30 jours. Une interruption du subprocess IFS peut rendre la consommation incomplète : le rapport l'annonce, sans afficher le compteur partiel comme une mesure totale. Les invocations CDS ne sont pas un comptage des appels HTTP internes du SDK.

## Notification technique

Le job final émet une annotation `::error` et échoue pour : échec/annulation d'un stage, publication illisible/invalide/périmée, retard observé supérieur à 120 minutes, ou échecs successifs. Un échec de collecte de métadonnées reste un échec de supervision. Les notifications natives GitHub Actions (web/email, selon les réglages personnels du propriétaire) portent alors le lien du run et son résumé. Aucun webhook, secret nouveau, destinataire externe ou infrastructure supplémentaire n'est ajouté. Vérifier dans GitHub les notifications Actions de l'opérateur ; leur réception n'a pas été simulée par un envoi externe pendant Task 31.

## Limites de GitHub schedule et secours

GitHub schedule est best-effort, sur la branche par défaut ; il peut être retardé ou omis. Le 7 novembre, le retard existait avant la création du run. Les logs ne démontrent pas sa cause interne chez GitHub. Le créneau 08:20 reste hors pointe de l'heure, sans nouvelle infrastructure ni double cron immédiat.

L'heure théorique n'est pas fournie par GitHub : le retard calculé est une estimation du créneau du même jour, sans attribution fiable au jour précédent. Un workflow qui ne démarre jamais ne peut pas se notifier lui-même. La concurrence sérialisée protège les écritures, mais un run peut attendre une exécution antérieure.

Secours privilégié : vérifier l'historique GitHub après une absence prolongée, puis dispatch explicite du même workflow avec checkpoint, sans historique national redondant. Si les retards/omissions se répètent et qu'une heure de disponibilité devient contractuelle, envisager seulement alors un watchdog externe quotidien unique, lecture seule d'abord, puis `workflow_dispatch` idempotent et authentifié ; pas de second pipeline ni de nouveau calcul. Ce secours n'est pas déployé ici. Un second créneau GitHub ne garantit pas davantage un SLA et peut avancer le cycle à traiter : ne pas l'ajouter sans budget et règle de rattrapage explicites.
