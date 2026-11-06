# Stockage et coût — mesures et projections séparées

## Mesures DEV

Avant toute ingestion Task26 : **145520307 octets** pour la base. Après ingestion : **148682419** ; après le rejeu sans écriture : **148821683**. La taille globale varie aussi avec les catalogues et l'entretien PostgreSQL : son delta n'est pas assimilé au poids des seules nouvelles journées.

| Relations | Avant, table + index | Après ingestion | Delta mesuré |
|---|---:|---:|---:|
| pra_daily | 21127168 | 21667840 | 540672 octets |
| pra_batches | 9699328 | 11182080 | 1482752 octets |
| pra_climatology_daily | 51740672 | 51740672 | **0** |

**716 lignes nouvelles** : 713 PRA le 19 octobre, plus les trois PRA du pilote du 20 octobre. Delta journalier + lots : **2023424 octets**. Normalisé à 713 lignes : **2014946 octets/jour**, soit environ 2,015 Mo. Cette normalisation est une estimation fondée sur une ingestion réelle ; ce n'est pas une mesure de 365 journées. Les remplissages de pages/index et métadonnées changent selon les périodes.

Les tables et index sont détaillés dans `database-before.json`, `database-after-ingestion.json` et `database-after-replay.json`. Le SQL de reproduction est dans `storage-snapshot.sql`. Les 23580 lignes historiques et 521916 normales compactes sont byte-logiquement inchangées selon leurs empreintes ordonnées. Les agrégats RPG/SAA restent des fichiers serveur, sans nouvelle table agricole.

## Projection de capacité

À croissance constante : **60,45 Mo / 30 jours** et **735,46 Mo / an** supplémentaires. Avec une base voisine de 148,8 Mo, le seuil de garde de **375000000 octets** serait atteint en environ **112 jours**, hors croissance des autres pipelines. Le contrôle SQL existant empêche de dépasser cette garde ; aucune purge, modification de climatologie ou mise à niveau payante n'est activée.

Le dernier artefact compact mesure **2012534 octets ZIP**, **3313963 octets décompressés**. Il contient les checkpoints de la journée nationale et du pilote, sans NetCDF horaires. Rétention Actions : sept jours. Les checkpoints restaurés sont cumulatifs : il faut également borner leur conservation opérationnelle avant un fonctionnement durable. Aucun cache ancien non présent n'est supposé.

**Blocage de recette quotidienne durable** : la conservation relationnelle illimitée ne tient pas dans le budget annuel. Il reste à choisir une conservation/compaction réversible, préserver la lecture des liens datés, vérifier les empreintes et la restauration en DEV, puis mesurer le nouveau volume. Aucune suppression de données scientifiques n'est proposée comme simple contournement. Toute migration de structure supplémentaire doit être justifiée par ce besoin et revue ; aucune n'a été appliquée ici.

## Exécution et prix

Mesure de la campagne (pilote, reprises, publication, rejeu) : **3460 secondes de runner**, soit **57,67 minutes** ; **61 minutes** après arrondi individuel à la minute. Les programmes représentent 3270,93 s ; l'écart contient l'installation et les étapes Actions. Détails : `workflow-consumption.json`.

Acquisition GitHub : **73 tentatives CDS**, **4402882 octets de fichiers source écrits**. L'essai local préalable a ajouté deux appels et 57171 octets ; il n'a écrit aucune donnée DEV. Les compteurs n'incluent pas les en-têtes réseau, polling et retransmissions internes du SDK. Les bornes par exécution restent 22 min de travail, concurrence CDS 1, 128 invocations maximum, fichier source 16 Mio, charge utile cumulée 128 Mio et workspace 448 Mio.

Projection indicative, non SLA : un jour froid demande normalement 30 blocs 2°, davantage lors d'une reprise partiellement en cache ou d'un changement de mois. Les latences constatées conduisent à environ **20–30 minutes de travail utile par jour**, donc **600–900 min / 30 jours**, **7300–10950 min / an**, réparties en exécutions de 22 minutes au plus. Des reprises peuvent augmenter ces valeurs. Le bootstrap mesuré n'est pas extrapolé comme coût récurrent optimisé.

Le dépôt est **public**, les runners sont `ubuntu-latest` standard : le calcul Actions est gratuit selon la [documentation GitHub vérifiée le 5 novembre 2026](https://docs.github.com/en/billing/concepts/product-billing/github-actions). L'organisation Supabase est sur le plan **Free**, vérifié via l'intégration. Aucun projet, branche payante, bucket ou abonnement n'a été créé, aucun tarif ni droit sur les tables n'a été modifié. Coût marginal d'infrastructure attendu au premier mois : **0**, sous les quotas existants. Sur un an, le calcul Actions reste à **0** selon ces règles ; **l'exploitation annuelle du stockage n'est pas validée**, car la projection dépasse le budget. Aucun coût de service payant n'est engagé pour combler cet écart. Les éventuels coûts Vercel/egress des plans existants n'ont pas été mesurés et ne sont pas présentés comme une facture nulle certifiée.
