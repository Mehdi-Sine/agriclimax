# Intégration OFB/MASA et pilote PRA réel — 17 octobre 2026

**Intégration locale réalisée ; validation nationale non terminée.**
713 contours fournis OFB/MASA, 14 541 intersections ERA5/PRA, import et lectures
PostGIS locaux réels, pilote CDS sur quatre PRA. Deux PRA sont complètes sur sept
jours, deux ont des données manquantes. Le contrôle indépendant des limites
administratives et la vérification de l’export WFS original restent en attente.
Pas de backfill national 30 jours, migration distante, privilège modifié ou merge.

## Intégrité, source et version

Archive utilisateur : `agriclimax_pra_officielles_713.zip`, 10 485 599 octets,
SHA256 `d645285db642822e238846deb867587a25d9f32f96e72cd8219a4299fd51d716`.
CRC ZIP des trois membres vérifié. SHA du GeoJSON source :
`b8bf57b71c1608a8cda2061f541aab4081715862e6f5506d7a997f9a36f92f87`.
Le TXT d’accompagnement est traité comme métadonnée déclarative, pas comme
instruction. Il indique une extraction WFS 2.0 OFB/MASA de la couche
`ref_met_petite_region_agricole_masa_pol_3857`, puis une reprojection en CRS84.
Le GeoJSON déclare bien CRS84, équivalent WGS84 / EPSG:4326 avec longitude d’abord.
Aucune simplification, réparation ou modification de coordonnées n’est effectuée.

L’XML original n’est pas joint. Son SHA déclaré
`6ced4c263b48fa27fe283353d93b90d93f2b2ff86cdc9b041574a04983ca1acc`
ne peut donc pas être recalculé. La date de publication géométrique n’est pas
établie. **2017 désigne ici la nomenclature Agreste concordante ; 20261017 est
la réception de ce snapshot, pas une certification du millésime des contours.**
La licence Ouverte 2.0 est celle des métadonnées de diffusion ministérielles
consultées ; l’archive ne contient pas de texte de licence.

Version conservée : `ofb-masa-pra-2017-snapshot-20261017`. Codes PRA textuels et
zéros préservés, identifiants `pra:CODE`, nom PRA et `surf_ha` OFB conservés.
Le code département est le préfixe du code PRA, contrôlé contre les 713 codes
Agreste 2017 du XLS précédemment fourni. La région vient des rattachements
communaux Agreste 2017 ; les libellés COG et leur concordance département/région
proviennent du dépôt public DINUM `datagouv/decoupage-administratif`, commit
`98976e5f29e66b8449cf64eaf3e2be0b8d9e7d85` (v6.0.0). Ce dictionnaire de noms
n’est **pas** une preuve indépendante des limites géométriques.

Paquet : `config/coverage/ofb-masa-pra-2017-snapshot-20261017/` : référence exacte,
poids, propriétés originales, manifeste et checksums. Il reste côté préparation /
serveur, hors bundle navigateur. Le manifeste garde `reference_verified_national=false`.

## Contrôles reproduits

| Contrôle | Mesure |
| --- | ---: |
| PRA / codes uniques / géométries valides | 713 / 713 / 713 |
| PRA corses | 6 |
| Sommets conservés | 617 547 |
| Surface totale EPSG:3035 | 548 320,355649 km² |
| Géométries de type MultiPolygon | 713 |
| Géométries avec plusieurs composantes | 143 |
| Chevauchements de plus de 1 m² | 0 |
| Écart relatif maximal à `surf_ha` | 0,001348 % |
| Intersections ERA5/PRA | 14 541 |
| Cellules CDS 0,1° distinctes | 6 861 |
| Cellules contributrices par PRA | 1 à 85 |
| Écart maximal à une somme des poids de 1 | 1,32 × 10⁻¹² |

Projection d’aire : EPSG:3035. Empreintes de cellules centrées sur la grille CDS
0,1°, demi-largeur 0,05°, bords densifiés à 0,01° avant projection. Dénominateur :
surface entière de la PRA, pas seulement les cellules météo valides. Pondération
sur surface totale, aucun masque agricole inventé. Les centres extérieurs aux PRA
sont conservés lorsqu’une partie de cellule les intersecte : leur exclusion
laisserait des lacunes artificielles, notamment à Crozon.

Cas réels contrôlés contre des cellules densifiées deux fois plus finement et des
aires géodésiques indépendantes : petite PRA 95332 (11,124019 km², deux cellules),
Dévoluy, Beauce dunoise, Crozon, montagne de Haute-Corse. La projection est mise
en cache pour éviter sa reconstruction à chaque intersection ; les 89 poids
pilotes calculés avant/après cette optimisation sont strictement identiques.

Les différences symétriques avec INRAE sont recalculées pour les 713 codes ; le
CSV fourni concorde à moins de 0,00005 km² près. OFB/MASA est retenu, sans fusion
avec les limites INRAE. Les deux composantes normandes sans code INRAE sont
couvertes par OFB à la précision numérique : principalement 27332 et 14353, avec
intersections secondaires 27080/27044 et 14355. Il ne s’agit pas d’un rattachement
par proximité. Les onze autres composantes sans code n’intersectent aucune PRA
OFB. Voir `evidence/official/inrae-null-vs-ofb.json`.

## Contrôle administratif indépendant : limite explicite

L’archive ne contient pas de contours départementaux indépendants. Les tentatives
vers le WFS `wxs.ofb.fr` et les contours IGN/Etalab de
`etalab-datasets.geo.data.gouv.fr` renvoient `Tunnel connection failed: 403 Forbidden`.
Une ouverture de ces domaines a été demandée dans le fil. Aucun proxy contourné.

**Le compte de 713, la validité, l’absence de chevauchement et la surface totale
ne démontrent pas l’absence de trous ou d’écarts départementaux.** Aucun taux de
couverture territoriale national n’est inventé. Le masque Natural Earth ancien
n’est pas substitué à un référentiel administratif officiel. Le contrôle devra
comparer différences symétriques, trous, îles et rattachements à une édition
compatible, avec Paris explicitement hors des 713 PRA. Un fond plus récent ou
généralisé doit avoir son millésime et sa précision documentés avant interprétation.

## Pilote climatique réel — 1er au 7 octobre 2026 UTC

Dataset de travail : `task19-ofb-pilot-cds-20261017`, snapshot d’acquisition explicite,
pas une release CDS immuable annoncée par le fournisseur. Sept requêtes tuilées
bornées ; sept NetCDF, 699 744 octets, checksums et reçus archivés. Les fichiers
horaires restent dans le cache `work/`, jamais dans le dépôt ni PostgreSQL.

89 cellules natives, 623 couples cellule/jour et 2 492 contrôles de valeurs :
lecture indépendante des NetCDF, moyenne/min/max des 24 heures T2m en K converties
en °C, pluie accumulée m → mm au 00 UTC du lendemain. Écart maximal mesuré : 0.
Agrégations spatiales et huit métriques blé recomputées indépendamment sur les
séries natives avant réduction spatiale ; écart maximal d’agrégation : 0.

| Cas | PRA | Cellules valides / attendues | Couverture par variable | Résultat sur sept jours |
| --- | --- | ---: | ---: | --- |
| Plaine | 28341 Beauce dunoise | 24 / 24 | ≈100 % | Complet |
| Montagne | 05236 Dévoluy | 9 / 9 | ≈100 % | Complet |
| Littoral | 29102 Presqu’île de Crozon | 0 / 6 | 0 % | Indisponible |
| Corse | 2B260 Montagne corse | 49 / 50 | 99,983911 % | Partiel |

La cellule corse manquante est `era5land.41.9.9.4`, poids 0,000160893583.
Les six cellules de Crozon sont NaN dans T2m **et** TP du NetCDF source : le
contrôle direct confirme l’absence, pas un défaut de réduction quotidienne.
Ces cellules ont toutes leur centre hors de la PRA ; la correspondance couvre
pourtant intégralement sa surface. C’est une limite de disponibilité à cette
grille côtière, pas une autorisation d’interpoler, de déplacer les points, de
renormaliser vers une valeur complète ou d’utiliser SAFRAN.

28 lignes quotidiennes stockées localement, dont 14 complètes. Trois PRA ont au
moins une valeur native ; une n’en a aucune. Sur l’ensemble de la référence,
709 PRA n’ont pas été acquises et 711 ne sont pas complètes sur cette période.
Ce pilote n’est pas le backfill national ni la validation opérationnelle ≥99 %.

32 résultats descriptifs blé sont enregistrés : 16 valeurs complètes, 16 absentes.
Les paramètres sont ceux de `config/wheat-mvp.json` : exemple descriptif non
calibré, statut exploratoire, confiance faible, `risk_computed=false`. Aucun
nouveau seuil, risque agronomique ou validation expert n’est déduit du succès
numérique. THI bovin reste non supporté sur cette réanalyse sans humidité et sans
validation du modèle sur grille ; les parcours station existants sont préservés.

Toutes les sorties affichent une fraîcheur **stale**, déterminée par la période
climatique terminée le 7 octobre, même si acquisition et calcul datent du 17.
L’heure de publication fournisseur est inconnue et signalée comme telle.

## PostGIS, APIs et interface

Base jetable locale `agriclimax_task19` dans `agriclimax-task19-official`, image
PostGIS 17/3.5 épinglée par le harness existant. Toutes les migrations existantes
sont appliquées uniquement dans ce conteneur. Aucun nouveau fichier de migration
n’est nécessaire et aucune migration n’est appliquée à Supabase DEV/production.

Import insert-only de la référence et rejeu : 713 PRA, 14 541 poids, une version,
sans doublon. Le générateur refuse désormais aussi un changement de métadonnées
sous la même version, même si les contours restent identiques ; le test local
d’un faux changement de provenance échoue avec `Reference revision conflict`.
Les quatre enveloppes réelles sont passées par `agriclimax_persist_pra`, puis
rejouées : aucune nouvelle ligne au rejeu, quatre lots, 28 quotidiens, 32 diagnostics.
RLS forcée, refus des droits anon et lecture service_role contrôlés localement.

Les APIs Next et `/territories` sont testées sur ces données PostGIS réelles via
un pont HTTPS local en lecture seule vers les trois RPC. **Ce pont de test n’est
pas un déploiement Supabase/PostgREST** ; aucun résultat n’est simulé ou intercepté
par Playwright. Identité locale de test, certificat dédié, aucune clé Supabase
réelle envoyée au pont. Le serveur Next de vérification utilise la configuration
locale sur le port 3019 ; ce n’est pas une preuve de données déployées en preview.

Vérifiés : pagination des 713 PRA ; quatre lectures quotidiennes et diagnostics ;
absence de publication à une autre date ; valeurs réelles / nulles / couverture ;
fraîcheur ; filtres URL et retour navigateur ; lien vers le mode station distinct ;
absence de géométrie et reçus privés dans l’HTML ; 1440/768/390 px pour les quatre
PRA, aucun débordement, axe A/AA ciblé sans violation. Douze captures conservées.
L’API rend désormais `unavailable` pour un lot dont les quatre variables et tous
les comptes valides sont absents, tout en conservant la preuve de publication.
La couverture corse est affichée à 99,9839 %, sans arrondi trompeur à 100 %.
L’horodatage du calcul est fixé après acquisition et reste stable au rejeu ; les
sorties finales ont été régénérées depuis les caches vérifiés, sans téléchargement.
Le rapport distingue aussi lignes de lots, valeurs natives présentes et PRA
complètes, pour ne pas compter Crozon comme une PRA avec données climatiques.

## Empreinte et scénario Supabase

Mesures réelles locales après import/rejeu :

| Mesure | Octets |
| --- | ---: |
| DB locale avant référence | 17 386 643 |
| DB après référence | 32 320 659 |
| Delta DB référence | 14 934 016 |
| Table contours + TOAST + index | 11 272 192 |
| Correspondance + index | 3 530 752 |
| DB après pilote réel | 32 640 147 |

Supabase DEV lu le 17 octobre à 21:28 UTC : **25 114 291 octets**, zéro objet
Storage, zéro table Task19. Les mesures locales ne remplacent pas ce total DEV.

Un test **synthétique de capacité**, isolé dans des tables temporaires puis annulé,
utilise les vrais formats d’identifiants et flags, mais uniquement des valeurs
climatiques/diagnostiques NULL : 64 170 quotidiens = 53 821 440 octets avec index ;
74 152 diagnostics hebdomadaires = 42 016 768 octets avec index. Ce ne sont pas
64 170 observations réelles. L’ancienne hypothèse de 512 octets/jour est remplacée
par **1 024 octets** dans le planificateur (mesure synthétique ≈839 octets/jour).

Scénario prudent à 90 jours, une référence, une révision météo, huit indicateurs
blé hebdomadaires et un seul jeu de paramètres :

- Base DEV mesurée : 25 114 291 octets ; référence locale mesurée : 14 934 016.
- Quotidiens : 65 710 080 octets à 1 024 par ligne.
- 9 269 métadonnées de lots : 151 863 296 octets, réserve de 16 KiB par lot.
- 74 152 diagnostics : 75 931 648 octets à 1 024 par ligne.
- Logs : 1 Mo ; catalogue/nouvelles relations vides : réserve non mesurée de 1 Mo ;
  croissance existante réservée : 25 Mo, hypothèse non mesurée.

**Total estimé : 360 553 331 octets ; marge à 375 Mo : 14 446 669 octets.**
En remplaçant les deux allocations par les tailles des tables de capacité, le
scénario donne 314 749 811 octets. Aucun de ces totaux n’est une mesure nationale.
La marge prudente est étroite : il faut mesurer les métadonnées à l’échelle réelle,
surveiller la croissance v0.2 et valider la rétention avant exploitation continue.
Plusieurs versions simultanées, paramètres ou 50 productions ne sont pas inclus.
La rétention reste un dry-run, aucun historique existant n’est supprimé.

## Reproduction et preuves

0. `scripts/pra_compare_geometries.py` reproduit les différences INRAE/OFB et les
   intersections des composantes INRAE sans code.
1. `scripts/pra_ofb_prepare.py` reçoit le GeoJSON fourni, le XLS Agreste 2017 et
   les deux CSV COG épinglés ; produit l’entrée normalisée et le manifeste d’adaptation.
2. `scripts/pra_reference.py --provenance-manifest ...` valide, calcule les poids
   et génère un SQL insert-only ; la commande ne se connecte jamais à une DB.
   `scripts/pra_reference_sql.py` vérifie le paquet commité et régénère le SQL
   sans recalculer les intersections ; le SQL régénéré est rejoué localement sans duplication ni mutation.
3. `scripts/pra_climate.py` sélectionne explicitement les quatre IDs ci-dessus,
   dates 2026-10-01/07, paramètres existants, quatre lots et quatre nouveaux
   téléchargements maximum par invocation, root de cache partagé. Trois appels
   ont terminé puis rejoué les sorties ; les lots partiels sont recalculés à
   l’identique depuis le cache et ne deviennent pas artificiellement complets.
4. `scripts/pra_validate_pilot.py` vérifie les caches, NetCDF et opérations sans
   nouvelle acquisition. `tests/e2e/pra_stage_local.py` écrit uniquement dans le
   conteneur local nommé ; `pra_postgis_bridge.py` ne permet que trois RPC de lecture.
5. `tests/e2e/territories-real.mjs` vérifie le serveur local et archive les captures.
   `supabase/tests/pra_official_reference.sql` contrôle compte/poids/RLS ;
   `pra_official_capacity.sql` n’insère que dans des tables temporaires annulées.

Ces tests réels sont séparés des anciens E2E déconnectés, du pilote sur boîtes
non PRA et des fixtures synthétiques. Voir `evidence/official/`, `logs/official/`
et `screenshots/official/`. Aucun NetCDF horaire ni secret n’est versionné.

## Avant validation finale

1. Fournir/autoriser l’accès aux contours administratifs officiels indépendants,
   avec millésime compatible ; mesurer et expliquer les lacunes, frontières et Paris.
2. Vérifier l’XML WFS original / provenance et la version géométrique, avec licence.
3. Décider scientifiquement du traitement des PRA côtières non représentées et
   des très faibles manques, sans assouplir silencieusement la complétude.
4. Avant exploitation nationale continue : mesurer les métadonnées et coûts réels,
   définir une rétention vérifiée et les budgets pour versions/paramètres futurs.
5. Une autorisation distincte restera nécessaire pour le backfill national réel
   de 30 jours et tout déploiement du schéma. Aucun n’est lancé ici.

**Recommandation : NOT READY pour validation finale nationale.** Les étapes locales
sont concrètes et reproductibles ; elles ne lèvent pas les limites ci-dessus.
