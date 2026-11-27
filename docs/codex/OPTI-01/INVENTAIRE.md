# OPTI-01 · Inventaire

Photographie du 27 novembre 2026 à 08 h UTC pour le patrimoine créé avant cette heure. Le bucket privé `pra-climate-archives` contient 1 414 objets et 823 463 484 o, soit 582 365 o par objet en moyenne. Le relevé exhaustif des clés, tailles, ETags et dates a été exporté hors Git dans `storage-inventory.ndjson`. Son empreinte est `cee17353b9bbfdbb2d73ee0394d1e1a02cf8e895235b2d8dc83ac6ae38fa4397`. Les contrôles d’empreinte de chaque objet s’effectuent sur les octets de la sauvegarde. Voir [Sauvegarde](SAUVEGARDE.md).

| Famille | Objets | Octets | Moyenne o | Créés et retenus sur 7 j | Octets 7 j | o/j | Projection 30 j | Projection 365 j |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `forecast-native` | 525 | 342 555 761 | 652 487 | 525 | 342 555 761 | 48 936 537 | 1 468 096 119 | 17 861 836 109 |
| `forecast-masks` | 723 | 316 881 462 | 438 287 | 244 | 5 453 898 | 779 128 | 23 373 849 | 284 381 824 |
| `editorial-inputs` | 19 | 90 829 072 | 4 780 477 | 7 | 14 258 122 | 2 036 875 | 61 106 237 | 743 459 219 |
| `edition-maps` | 32 | 53 461 285 | 1 670 665 | 14 | 39 536 675 | 5 648 096 | 169 442 893 | 2 061 555 196 |
| `weather` | 20 | 11 217 721 | 560 886 | 6 | 3 354 791 | 479 256 | 14 377 676 | 174 928 388 |
| `era5` | 24 | 6 026 935 | 251 122 | 7 | 1 636 164 | 233 738 | 7 012 131 | 85 314 266 |
| `support` | 24 | 2 250 506 | 93 771 | 7 | 91 302 | 13 043 | 391 294 | 4 760 747 |
| `candidates` | 10 | 117 408 | 11 741 | 1 | 59 479 | 8 497 | 254 910 | 3 101 405 |
| `catalogues` | 35 | 96 417 | 2 755 | 13 | 48 446 | 6 921 | 207 626 | 2 526 113 |
| `catalogue.json` | 1 | 24 842 | 24 842 | 0 | 0 | 0 | 0 | 0 |
| `current.json` | 1 | 2 075 | 2 075 | 0 | 0 | 0 | 0 | 0 |

Les projections extrapolent les nouvelles clés encore présentes du 20 au 27 novembre. Les deux importations de prévisions natives totalisent 342,6 Mo pendant la fenêtre. Leur extrapolation à 17,86 Go/an est un scénario de pression, sensible à la politique de rotation. La croissance hors natives vaut environ 9,21 Mo/jour, 0,27 Go/30 j et 3,36 Go/an sur cette cohorte. L’écriture est quotidienne pour les cartes, les inputs gelés, les supports et les deux pointeurs. Elle se fait par lot pour les masques et prévisions natives. Les mises à jour, suppressions historiques et politiques de rétention effectives nécessitent des instantanés successifs et des décomptes d’opérations. [Lectures observées](AUDIT.md)

## Classement de conservation

| Classe | Ressources | Dépendances et conservation |
|---|---|---|
| 1 · scientifiques | PRA, géométries et poids, climatologies, versions de références, archives ERA5 exactes et preuves sources | Contrats 713 PRA, seuils et périmètres, restitution historique. Conservation longue et hors fournisseur. |
| 2 · quotidiennes | Pointeurs météo actifs, catalogues, registres de production, archives en cours, watchdog, secrets référencés | Garder les chemins et versions compatibles avec les workflows. Conserver les secrets dans leur gestionnaire. |
| 3 · historiques | PostgreSQL éditorial, bundles publiés, entrées gelées, reçus, masques/versions utilisés et WebP publiés | Restaurer par identifiant d’édition et révision, y compris secours et versions de couverture. Conservation permanente des publications. |
| 4 · reconstructibles | Traces/bundles exécutables, previews, images de recette non contractuelles, diagnostics compressibles | Révision Git, version du runtime et manifestes nécessaires au rejeu. Rotation après validation. |
| 5 · temporaires et candidats | Checkpoints Actions, doublons à confirmer, dossiers candidats, sorties intermédiaires | Candidats en simulation. Références historiques et validation nécessaires. |

## Surface hors Storage

| Ressource | Quantité ou volume constaté | Lectures, écritures et rétention |
|---|---|---|
| PostgreSQL/PostGIS | 97 tables, 201 414 323 o | Compteurs cumulatifs par table. Suivre quotidiennement taille, index et écritures. |
| Archives éditoriales PostgreSQL | 27 archives, 6 119 424 o sur disque, ~226,6 ko/ligne physique. Octets JSON exacts cumulés 7 544 102 | 857 balayages séquentiels et 27 398 index scans cumulés. 9 archives et 3 753 263 o JSON sur 7 jours, ~0,54 Mo/jour, ~16,1 Mo/30 j et ~195,7 Mo/an avant compression, à cadence identique. Conserver le texte exact et les états. |
| Diagnostics éditoriaux | 696 lignes estimées, 7 151 616 o, ~10,3 ko/ligne | 8 767 balayages séquentiels, 2 404 index scans et 484 mises à jour cumulés. Politique de rétention à qualifier. |
| Cron et Edge | 1 watchdog actif, 0 Edge Function listée | `*/15 * * * *` UTC, 96 déclenchements théoriques par jour. Audit supplémentaire du statut d’exécution et du délai par invocation requis. |
| Next.js | 37 350 655 o de fichiers Git sous `apps/web` | Inclut tests et sources. Géométrie du Journal 2,55 Mo au fichier. Les builds et traces d’EDIT-09 mesurent une autre surface. |
| Vercel | Alerte Function Storage 10 Go. GitHub liste 458 déploiements Preview et 29 depuis le 20 novembre | Versions de fonctions par déploiement et historique, CPU, exécutions et transfert séparés. Conservation et croissance à relever dans le compte. |
| Actions | 3 868 artifacts non expirés, 177 noms distincts, 5 822 105 965 o en 39 pages API, ~1,51 Mo par artifact | 377 artifacts encore retenus depuis le 20 novembre et 1 116 869 956 o, ~0,16 Go/jour, 4,79 Go/30 j et 58,24 Go/an de créations à rythme fixe avant expiration. Six checkpoints prévision totalisent 467,50 Mo à rétention courte. Les rapports navigateur représentent 5,30 Go et utilisent la rétention générale avant OPTI-01. Aucun compteur de téléchargements n’est exposé par cette liste. |
| Vignettes | Aucun WebP autonome dans le bucket au relevé | Route historique à froid avec rendu, caches mémoire et HTTP. EDIT-09 a mesuré deux WebP totalisant 76 738 o. Les épreuves en dépôt relèvent de la catégorie scientifique ou de recette selon usage. |

### Principaux artifacts retenus

| Nom | Nombre | Octets |
|---|---:|---:|
| `demo-browser-report` | 421 | 5 302 360 440 |
| `t36-forecast-checkpoints` | 6 | 467 504 685 |
| `t36-era5-checkpoints` | 6 | 19 087 388 |
| `task12-era5-real-smoke` | 116 | 9 444 062 |
| `sql-public` | 495 | 8 961 572 |
| `sql-extensions` | 495 | 8 845 262 |

Les rapports navigateur concentrent 91,1 % de la taille totale exposée par l’API. Parmi eux, 333 objets antérieurs au 13 novembre totalisent 3,48 Go. La rétention de 14 jours appliquée aux nouveaux rapports réduit la durée de résidence, avec un effet progressif au fil des expirations. L’API ne fournit pas le montant facturé ni les téléchargements réels.

## Vingt objets classés par taille

| Rang | Clé dans le bucket | Octets | Date UTC |
|---:|---|---:|---|
| 1 | `editorial-inputs/d8180a44dc55….json.gz` | 7 809 249 | 2026-11-21 |
| 2 | `editorial-inputs/e5b5f2f940bb….json.gz` | 7 746 082 | 2026-11-19 |
| 3 | `editorial-inputs/9206ccb881c8….json.gz` | 7 603 288 | 2026-11-20 |
| 4 | `editorial-inputs/6e8871cc5973….json.gz` | 7 444 494 | 2026-11-18 |
| 5 | `editorial-inputs/55d66d87532a….json.gz` | 7 167 138 | 2026-11-17 |
| 6 | `editorial-inputs/8e58ed0c28a3….json.gz` | 6 897 590 | 2026-11-16 |
| 7 | `editorial-inputs/1bd4664155d5….json.gz` | 6 726 575 | 2026-11-15 |
| 8 | `editorial-inputs/ee776699d810….json.gz` | 6 389 178 | 2026-11-14 |
| 9 | `edition-maps/blobs/5e107223e33f….json.gz` | 6 331 780 | 2026-11-22 |
| 10 | `edition-maps/blobs/d16751663d04….json.gz` | 6 331 308 | 2026-11-23 |
| 11 | `edition-maps/blobs/e725177f6ad1….json.gz` | 6 331 034 | 2026-11-24 |
| 12 | `edition-maps/blobs/a12160d80687….json.gz` | 6 330 949 | 2026-11-27 |
| 13 | `edition-maps/blobs/581e9623a739….json.gz` | 6 330 917 | 2026-11-26 |
| 14 | `edition-maps/blobs/e71fb602c865….json.gz` | 6 330 586 | 2026-11-25 |
| 15 | `editorial-inputs/d2ba5fe9eb10….json.gz` | 6 038 440 | 2026-11-13 |
| 16 | `editorial-inputs/1690a79f6550….json.gz` | 5 735 797 | 2026-11-12 |
| 17 | `editorial-inputs/d2c7f1cdf4d0….json.gz` | 5 390 367 | 2026-11-11 |
| 18 | `editorial-inputs/c3a58d9eddf6….json.gz` | 4 898 530 | 2026-11-10 |
| 19 | `editorial-inputs/319bce61de5d….json.gz` | 4 533 471 | 2026-11-09 |
| 20 | `edition-maps/blobs/45751bc69a16….json.gz` | 1 554 592 | 2026-11-12 |
