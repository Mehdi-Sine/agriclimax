# Santé de la chaîne

## Responsabilités et frontières

`pra-climate.yml` conserve acquisition nationale, agrégation PRA, archivage et publication. `daily-live.yml` possède les observations et calculs stationnels ; `meteofrance-ingestion.yml` reste manuel. `data-ingestion.yml` ne valide que des fixtures. Agriculture annual possède les références annuelles. Quality/security contrôlent le code. Aucun nouveau cron ni seconde acquisition ajouté. Aucun changement scientifique, CORE-01, Journal ou graphique.

Le groupe `pra-climate-batches`, sans annulation en cours, sérialise les writers Actions. Il ne verrouille pas les écrivains externes : les interdire pendant le pilote. Les reprises ERA sont séquentielles après échec. Les checkpoints sont temporaires (3 jours ERA/météo, 7 jours anciens batches), les preuves 30 jours ; Storage reste pérenne. Restaurer avec même identité, date, dataset, référence et empreintes ; ne jamais vider un dossier pour contourner un échec d'identité.

## Exécution vérifiée

`evidence/pra-runs.json`, `pra-jobs.json`, `daily-runs.json` sont des lectures GitHub nouvelles. Le 8 novembre, PRA est créé à 15:17:33 UTC pour 08:20 nominal : **417,55 minutes** de retard. national-weather réussit de 15:17:36 à 15:29:13. ERA échoue de 15:29:15 à 15:50:53 ; resume-1 réussit de 15:50:55 à 15:52:36. Le verdict indépendant échoue dans weather-health (payload de l'artefact refusé 403, cause interne non certifiée) : ne pas assimiler cette reprise à un workflow réussi. Durée des jobs inclut installation et attente, pas uniquement calcul. Pas de cause fournisseur inventée à partir du nom de l'étape échouée.

Les variables actuelles sont illisibles (403). Les conditions observées ont permis ces jobs lors de ce run ; aucune preuve que tous les prochains schedules seront autorisés.

## Diagnostic renforcé

Le health relit et décode l'archive, valide les 713 identités officielles, la matrice source et la sélection, puis compare current au dernier cycle. OPS-01 ajoute le contrôle des trous historiques DATA-01 au verdict ; une dernière journée fraîche ne masque plus une lacune. Identité path/SHA256, disponibilité par variable/jour, couverture partielle, absence de vérification agroclimatique et statut de livraison fournisseur sont transmis au rapport quotidien. Les comptes de valeurs disponibles ne prouvent pas des supports territoriaux complets ; conserver les supports CORE-01.

La supervision expose durée écoulée start→contrôle (inclut attentes), durées de stage lorsqu'elles sont présentes, reçus des tentatives et échecs. Tous les stages sautés ne sont plus considérés comme une chaîne réussie. Un HTTP 200 ne remplace ni décodage, empreinte, identité ni fraîcheur. Alertes Actions : causes structurées, résumé lisible, sortie en échec ; aucune notification externe envoyée.

Le dernier cycle valide reste servi après une panne. Les blobs et métadonnées sont vérifiés avant remplacement du pointeur. La publication multi-objets n'est pas transactionnelle ; la réparation explicite catalogue/current et l'unicité du writer restent requises. La qualification distante d'une interruption reste en attente.
