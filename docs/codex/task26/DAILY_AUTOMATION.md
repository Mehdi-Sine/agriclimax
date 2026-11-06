# Task26D — fonctionnement quotidien DEV

Un seul workflow existant `pra-climate.yml` orchestre la météo nationale, ERA5archive-only et la supervision. Les acquisitions restent sur des runnersGitHub. Les CI ordinaires PR/push ne reçoivent aucun secret réel de sources/DB ; Task12 demeure dispatch-only avec autorisationDEV distincte. Aucun merge, changement de branche par défaut ou production dans cette tâche.

## Activation après revue et fusion autorisées

GitHub exécute les crons depuis la branche par défaut. Le calendrier existant08:20UTC est préparé, mais les acquisitions nouvelles restent désactivées tant que `PRA_CLIMATE_DAILY_DEV_ENABLED` n'est pas`true`. Le kill switch `PRA_CLIMATE_DAILY_KILL_SWITCH=true` interdit immédiatement les nouveaux jobs sources. La supervision reste en lecture seule pour signaler un vieillissement.

Après la revue utilisateur et une fusion décidée séparément : vérifier les secrets du projetDEV, les compteurs et budgets ; activer le seul drapeauDEV, observer la première exécution complète et vérifier la Preview. Aucun cron parallèle de branche expérimentale. Ne jamais utiliser le drapeau pour contourner le fonctionnement GitHub.

## Séquence bornée

1. Préflight du run synoptique disponible, cache dédupliqué, acquisition météo mutualisée et validation des713PRA ; anciennes publications immuables conservées.
2. Publication du cycle complet et du manifeste vivant ; la carte détecte les dates sans nouveau commit.
3. Détection de la prochaine journée ERA5 non publiée, reprise du dernier checkpoint de branche sur une recherche bornée à20runs, source puis archive-only complète.
4. En cas d'échec, au maximum deux stages supplémentaires séquentiels reprennent les checkpoints du même run. Chaque stage conserve les plafonds22minutes/128appels/128MiB/4GiB ; aucune boucle illimitée ni acquisition par PRA.
5. Healthcheck après tous les stages : intégrité713PRA, pointeur vivant correspondant à la dernière publication vérifiée, âge météo≤36h, décalage ERA≤7jours et taille indexée sous900MiB. Un échec du job signale l'incident par les mécanismesGitHub du dépôt.

Les reprises n'effacent pas les anciennes données. Seule la journée en cours est exportée, sans dupliquer les anciennes grilles. Un source indisponible ou une journée incomplète ne remplace jamais une publication complète.

## Validation réelle

Nouveau cycle météo06UTC et nouvelle journéeERA31octobre publiés ; arrêt par budget et reprise réelle effectués. Rejeu météo49910lignes et rejet d'un candidat incomplet : zéro acquisition/écriture, ancienblob identique. Le mode manuel dédié `daily-dev-check`, protégé par execute/national_authorized/publish_dev explicites, vérifie la même chaîne avec les publications existantes et le rejeu ERA713enveloppes ; il n'active pas le cron.

L'observation réelle du calendrier30→31octobre sans redeploiement est conservée. Le run complet `daily-dev-check` [42221119710](https://github.com/Mehdi-Sine/agriclimax/actions/runs/42221119710) a réussi : météo sans acquisition/écriture, restaurationERA713enveloppes sans acquisition/écriture, santé valide et reprises correctement ignorées. Rapports `daily-chain-{weather,era,health}.json`. Une réussite de ce test n'est pas une activation planifiée de la production.
