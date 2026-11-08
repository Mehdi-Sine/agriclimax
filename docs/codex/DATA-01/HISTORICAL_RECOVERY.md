# Récupération historique et compatibilité

## Cause et inventaire vérifié

Le lecteur de calcul historique utilisait exclusivement `catalogue.era5` : cinq
blobs, quatorze dates indexées du 19 octobre au 1er novembre. Ce n'est pas une
preuve de suppression de toutes les anciennes données. Le chemin RPC legacy
conserve réellement trente jours du 1er au 30 octobre : **21 390 lignes**, 713
identités par jour, **645 PRA complètes communes aux trente jours**, 67 partielles
et Crozon indisponible. Les températures et précipitations sont conservées sous
leur version ERA5 d'origine. Pas d'humidité historique, pas de SAFRAN raccordée.

La récupération reprend l'outil de COUV-01 en trois étapes 14/14/2 jours, bornes
113/113/17 RPC. Les corps sont sauvegardés dans `evidence/legacy`, avec reçus SHA256
et manifeste. Le rejeu vérifie les objets locaux et ne redemande aucune journée
présente (seule la lecture de catalogue reste nécessaire). Aucun appel persist,
aucune acquisition climatique et aucune écriture distante.

`data01_history.py` vérifie les empreintes du référentiel et des poids, les cinq
blobs Storage, les enveloppes et leurs batch keys. Pour chacune des 21 390 lignes
legacy, il retrouve une identité dont le SHA256 est exactement le batch key RPC :
PRA, géométrie, poids, dataset, méthode, paramètres, destination et fenêtre de sept
jours maximum. Il n'attribue pas une identité supposée à une valeur sans cette preuve.
Les archives originales restent distinctes de l'adaptation ; le bootstrap ne
prétend pas restituer leurs octets ni les cellules natives perdues.

Le premier blob contient aussi le 20 octobre, alors que son index annonce seulement
le 19. Cette date supplémentaire n'est pas automatiquement ajoutée au calendrier.
Le blob suivant référence explicitement le 20. Les dates embarquées sont conservées
au reçu ; les sous-ensembles indexés doivent être réellement présents.

## Comparaison et séparation des séries

Sur **8 556 lignes** communes (12 jours × 713), les masques NULL, nombres de cellules,
statuts normalisés et drapeaux sont comparés. Le statut tout-NULL / zéro cellule de
Crozon est normalisé en indisponible comme dans le lecteur RPC existant.
Les identités scientifiques concordent. **32 665 scalaires** diffèrent dans la
représentation legacy et les enveloppes exactes. Écarts maximaux : Tmoy
0,000050414 °C, Tmin 0,000050000 °C, Tmax 0,000050195 °C, pluie 0,000346824 mm,
couverture 0,000000478. Ce constat est compatible avec une différence de précision
de stockage/transport ; il ne permet pas de déclarer les nombres identiques.
Les exemples et maxima sont conservés dans `evidence/history.json`.

`climateHistoryWindow` choisit **une seule série pour toute la période** :

1. `exact-storage-1` si Storage couvre chaque jour ; les valeurs modernes restent inchangées.
2. `legacy-rpc-1` si l'intégralité de la période existe dans le bootstrap legacy.
3. Sinon seulement les jours modernes présents ; les calculateurs signalent une période incomplète.

Aucun raccordement à la frontière, aucune correction numérique implicite. Le
hash de résultat inclut la série, les révisions des jours et les supports indexés.
`wheatHistory` et l'API agroclimatique par défaut réutilisent cet adaptateur. Les
anciennes versions explicitement demandées conservent leur chemin de compatibilité.
Le Journal reste sur son cycle prévisionnel existant ; aucune interface modifiée.
Le lecteur Climat et ses références historiques restent inchangés dans cette tâche.

## Profondeur et supports

La fenêtre **01–30/10** est calculable sous une même méthode et une même précision
legacy pour 645 PRA. Une fenêtre récente de trente jours se terminant au 01/11
ne l'est pas via une série unique ; la profondeur récente moderne reste 14 jours.
Ne pas annoncer 32 jours homogènes à partir de l'union des catalogues.
Les preuves natives restaurées CORE-01 portent du 02/10 au 31/10. Ainsi les 67 PRA
partielles gardent leurs valeurs descriptives sur les fenêtres prouvées, notamment
02–08/10, mais le 01/10 empêche une qualification sur toute la fenêtre legacy de
30 jours. Leur valeur territoriale n'est jamais remplacée par une extrapolation.
Les familles extrêmes/séquences restent soumises aux politiques de CORE-01.

L'artefact Task29 `13571358993` est catalogué, 9 682 683 octets, expiration
14/11/2026 11:08 UTC, digest GitHub `36e4ec3b550f65e9bdf3d81a5c7a352c984c336a7dd61afe32b9f1245a233c1e`.
Son téléchargement a répondu 403 sur la destination d'artefact. Les cellules
n'ont donc pas été revérifiées à partir de cet artefact dans DATA-01. Aucun secret
ni URL de téléchargement signée n'est archivé.

## Reproduction en lecture seule

```bash
PYTHONPATH=engine/src:scripts python scripts/archive_legacy_pra_reads.py --start 2026-10-01 --end 2026-10-30 --root work/data01/legacy
# Répéter jusqu'à missing_dates=[] ; au plus 14 nouvelles journées par étape.
PYTHONPATH=engine/src:scripts python scripts/data01_history.py
NODE_USE_ENV_PROXY=1 DATA01_REAL=1 PRA_NATIONAL_ENABLED=1 pnpm --filter @agriclimax/web exec vitest run lib/server/data01.real.test.ts
```

Le bootstrap serveur est un secours durable versionné dans Git pour cette
récupération bornée, pas un instantané météo glissant à recréer chaque jour.
Les nouvelles journées suivent les objets quotidiens Storage existants.
