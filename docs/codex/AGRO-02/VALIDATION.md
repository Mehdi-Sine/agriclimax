# Validation, volumétrie et performances

Exécution : 2026-11-10T15:02:22.039Z. Contrat `multiproduction-descriptive-1.0.0`. Les résultats chiffrés sont conservés dans `evidence/report.json`, `matrix.json`, `samples.json.gz` et `live.json`.

## Périmètre mesuré

Six productions, vingt recettes déclarées, dix-neuf calculs distincts par PRA et période après mutualisation. Soixante-cinq applicabilités production × indicateur : **46 345 mesures préparées par lot national**, pour **13 547 calculs** et **32 798 réutilisations** (70,8 %). Les 713 identités PRA sont toujours conservées, dont les résultats nuls.

Le rejeu couvre six plans : réanalyse 1/7/14/30 jours et prévision J+1 / 7 jours, soit **278 070 mesures** préparées et **85 560 résultats recette × PRA × période** comparés au programme Python indépendant. **Zéro écart**, tolérance absolue 1e−9 ou relative 1e−12 ; concordance exacte des valeurs nulles. Les données proviennent des entrées opérationnelles gelées CORE-01 ; leur SHA-256 est enregistré. Aucune météo synthétique dans ces exemples.

| Nature | Période UTC | Calcul national (s) |
|---|---|---|
| reanalysis | 2026-11-01 → 2026-11-01 | 2.194 |
| reanalysis | 2026-10-26 → 2026-11-01 | 6.941 |
| reanalysis | 2026-10-19 → 2026-11-01 | 4.719 |
| reanalysis | 2026-10-03 → 2026-11-01 | 4.665 |
| forecast | 2026-11-08 → 2026-11-08 | 0.571 |
| forecast | 2026-11-08 → 2026-11-14 | 1.472 |

Le banc complet (lecture/décompression, six lots, contributions, oracle Python et préparation des preuves) dure **42.39 s**. L’augmentation RSS du processus de test est **1141.8 Mio**. Cette mesure inclut les archives décompressées, les échantillons et la sérialisation du contrôle indépendant ; ce n’est pas la mémoire du seul noyau, ni un pic certifié. Le runtime Node 24 partageait la machine avec d’autres contrôles ; ces durées ne sont pas un engagement de latence.

Les résultats scientifiques et les origines sont partagés en lecture seule, figés récursivement. Les empreintes SHA-256 remplacent les longues signatures transportées répétitivement. La réutilisation est bornée à un lot et une PRA ; les sélections de sources de deux lots ne peuvent pas contaminer leur cache. Pour 50 à 100 productions réutilisant les mêmes recettes, le nombre de calculs distincts reste identique ; le nombre de références d’applicabilité augmente. Aucun pilote de 100 productions distinctes ni déploiement quotidien n’est revendiqué. Une extension avec beaucoup de nouvelles recettes devra mesurer ses propres volumes.

## Archives actuelles en lecture seule

Contrôle séparé : 2026-11-10T15:02:29.232Z.359Z. Les lecteurs existants vérifient enveloppes, schémas, identités et sommes d’archives. Le SHA-256 du document national de prévision est conservé dans `live.json`. Aucun RPC d’écriture ni lancement d’acquisition.

- reanalysis, 2026-11-03 : 713 PRA parcourues, calcul 0.592 s. Pluie : `{'native_complete': 645, 'observed_partial': 67, 'unavailable': 1}`. THI : `{'unavailable': 713}`.
- forecast, 2026-11-10 : 713 PRA parcourues, calcul 0.621 s. Pluie : `{'native_complete': 713}`. THI : `{'unavailable': 713}`.

Le replay historique de 14 jours est calculable sur les supports homogènes ; celui de 30 jours reste nul pour période incomplète. La prévision intégrée de 7 jours gelée reste nulle pour rupture de modèle/source/support. Les mesures J+1 sont séparément calculables. Aucune disponibilité nationale du THI n’est annoncée. Crozon reste explicitement indisponible dans la réanalyse inspectée.

## Recette informatique

- Tests web de régression, API et anciennes éditions : 601 réussis, 7 tests réels distincts laissés opt-in, dans le passage global hors pilote. Après consolidation finale de la façade : 26 tests multi-productions réussis, incluant pilote national, contrat, épisodes T33 et archives actuelles. Le nouveau test d’isolation des caches est inclus dans ces 26.
- Python : **441 tests réussis** dans le passage complet final (63 avertissements de bibliothèques). Les dépendances de test absentes (`xarray`, `openpyxl`, `py7zr`) ont été installées localement avant cette recette ; aucun code Python opérationnel modifié.
- TypeScript strict, lint complet puis lint des fichiers finaux, build Next.js : réussis. Aucun changement graphique, donc aucune recette responsive nouvelle requise.
- Schémas/configurations, automatisation, migrations forward-only, recherche de secrets source et bundle, audit des exceptions de dépendances et budget client : réussis.
- Qualité transversale : tests Node et 25 tests Python réussis. Référence indépendante : Ruff et mypy réussis.

Un passage intermédiaire du pilote exécuté en concurrence avec le build a dépassé son délai de 180 s ; la recette finale réussit dans ce budget. Un témoin d’épisode supposait l’ordre chronologique alors que T33 trie par ID : le témoin trie désormais les bornes documentées avant comparaison. Aucun algorithme T33 n’a été modifié.

## Représentativité et intégration différée

Ce contrôle valide les formules et les barrières de disponibilité après adaptation des archives. Il ne valide pas un risque, une phénologie, une réponse animale, une représentativité microclimatique ou une production agricole. Les faits préparés n’alimentent pas encore l’édition quotidienne : JOUR-02 devra sélectionner les lots et intégrer la fabrique. Les nouvelles interfaces restent du ressort d’UX-01. Aucun workflow nocturne, prompt ou système de publication n’est modifié.
