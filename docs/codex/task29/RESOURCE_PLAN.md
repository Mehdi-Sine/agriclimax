# Validation interne des limites — complément ciblé 2–18 octobre

## Nécessité démontrée

Inventaire paginé des1951artefacts Actions au7novembre : checkpointsERA à partir du19octobre restaurés ; aucun checkpoint natif Task19D2–18octobre trouvé. Le rapport historique décrit les caches locaux `work/task19d/real`, absents du workspace. Les agrégats PRA NULL ne permettent pas de retrouver les cellules. Aucun jour19–31 n’est réacquis. Les quatre archives explicitement fournies sont sauvegardées intactes avant cette décision.

## Limites acceptées pour l’exécution interne

Plan déterministe `evidence/targeted-recovery-plan.json` :67PRA dont le support observé est positif,1391cellules à coordonnées nécessaires,44tuiles1° regroupées en19emprises2°,17jours,57groupes de sept jours maximum. Crozon n’est pas réacquis pour tenter de remplir son masque nul.

La récupération réutilise `Era5LandProvider`, `acquire_windows`, `write_native_tiles`, cache et clés existants. Une option **inactive par défaut** limite la journée suivante à00UTC pour la pluie ; aucune journée de température du19octobre n’est redemandée. La voie quotidienne conserve exactement son mode de requête antérieur.

Plafonds inchangés par étape :128appels logiques CDS,128Mio de corps reçus,16Mio par fichier,448Mio workspace,4Gio mémoire,1320secondes,64groupes maximum. Valeurs brutes float32 estimées27,55Mo pour le complément entier ; jusqu’à114requêtes logiques avec les heures00 séparées. Ce sont des estimations de charge utile, pas des compteurs de trafic HTTP/polls/retries ou une garantie de durée. Exécution par16groupes avec checkpoints et reprise, arrêt borné sans hausse automatique. La progression réelle et les octets mesurés sont consignés après chaque étape.

Calcul long sur GitHub Actions : ajout d’un job **dispatch-only**, activable uniquement sur la branche Task29, au point d’entrée manuel legacy Task12 déjà enregistré. `allow_dev_write=false` et la garde exclusive empêchent toute exécution du job legacy. Aucun workflow météo quotidien/opérationnel n’est modifié, aucune source réelle n’est ajoutée aux workflows CI. Même verrou de concurrence `pra-climate-batches`. La voie utilise seulement la clé CDS ; aucun client DB, clé Supabase, persistance, source opérationnelle ou publication automatique. Les sorties demeurent des checkpoints à valider avant restitution.

GitHub Actions standard d’un dépôt public et CDS existants ; aucun nouveau service ou abonnement. Artefacts limités à7jours ; les checkpoints natifs et reçus sont conservés, jamais publiés comme mesures complètes. Aucune reconstruction Crozon n’est incluse dans cette étape.
