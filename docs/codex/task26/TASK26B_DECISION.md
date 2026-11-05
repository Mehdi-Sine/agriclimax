# Task26B — décision de jalon, à finaliser après les runs en cours

Branche `codex/26-national-daily-climate`, seule PR55 toujours draft, pas de merge ou production. Socle historique conservé.

1. `READY_FOR_ERA5_DAILY_DEV` : **NOT_READY à ce jalon**. Groupage/reprise et archive réversible implémentés et testés ; rattrapage réel en cours. Conservation12–24mois sous375Mo non démontrée, lecture historique froide et restauration DEV transactionnelle restent nécessaires avant planification.
2. `READY_FOR_OPERATIONAL_NATIONAL_SCALEUP` : **NOT_READY**. Authentification Météo-France401 confirmée sur Cloud ET GitHub pour six endpoints, aucune analyse J−1 ni comparaison stationnelle obtenue. IFS doit encore être acquis/recetté ; même un piloteIFS réussi ne suffira pas à valider une chaîne multi-sources J−1/J+7.

Jalons sauvegardés :1d67142contrat/audit,0115b9bacquisitionmulti-jours,86933f3captureIFSbornée,2ff781dlecteurpilote/archive,653b389accèsréels/stockage/probe. Le premier dispatchIFS86933f3 a été annulé pendant son attente, sans acquisition ; remplacement2ff781dpour ajouter les contrôles et la récupération des plages en échec. Aucun traitement national réussi antérieur n'est recommencé.

La tâche n'est pas présentée comme une généralisation réussie. Les mesures, dernière date nationale, journées rattrapées et recette finale sont à compléter après les exécutions bornées en cours.
