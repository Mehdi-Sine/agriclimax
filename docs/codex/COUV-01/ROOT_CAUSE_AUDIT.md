# COUV-01 — audit des causes

Audit en lecture seule, 7 novembre 2026. Base : `origin/main` `0e7bcba`.
Branche dédiée ; PR #61 et #62 laissées intactes. Frontières affectées : sources,
intersections, agrégation, contrat de qualité, conservation locale et sélection
prévisionnelle expérimentale. Aucun calcul métier, écran, RPC, schéma ou workflow
quotidien existant n'est modifié.

## Résultats vérifiables

| Problème | Cause établie | Ce que l'audit ne permet pas d'affirmer |
|---|---|---|
| 68 PRA ERA5-Land incomplètes | Les 14 jours Storage vérifiés ont 645 supports complets, 67 partiels et Crozon sans valeur native. Les poids ont pour dénominateur la PRA entière. | Une absence ne démontre pas à elle seule un masque terre/mer physique. |
| Crozon | Les six cellules ERA5-Land étaient toutes non finies dans le contrôle NetCDF Task19. Le même champ ne remplit pas ce support en le téléchargeant à nouveau. | Le complément IDW Task29 ne devient pas une donnée native. |
| 30 jours Task28 contre 14 AGRO-01 | Deux catalogues distincts : les archives Storage couvrent 19/10–01/11 ; la RPC historique conserve réellement 01/10–30/10. | Un ancien résultat ne garantit pas la présence du NetCDF source. |
| Anciennes données difficiles à retrouver | Les checkpoints Actions ont une expiration ; la restauration Task29 n'a pas rendu tous les jours visibles dans le catalogue Storage. | Le contenu de chaque artefact n'a pas été redécodé dans COUV-01. |
| Discontinuité J+1–J+7 | La sélection opérationnelle privilégie successivement AROME, ARPEGE puis IFS. | Une présence numérique n'autorise ni raccordement des modèles ni qualification littorale. |
| SAFRAN non testé auparavant | Task29 avait arrêté avant acquisition : gzip récent de 19 936 780 octets, supérieur au plafond de 16 Mio. | Découper artificiellement ce fichier ne rendrait pas ce dépassement autorisé. |

COUV-01 trouve dans le catalogue actuel un transport Parquet data.gouv de
11 156 587 octets, inférieur au même plafond. Il contient 593 520 lignes :
9 892 centres × 60 dates, du 08/09 au 06/11. Les centres sont comparés au CSV
Météo-France sur chaque date. Pas de relèvement de quota.

## Géographie et 68 territoires

`COASTAL_713_MATRIX.csv` comporte les 713 identifiants et régions, les deux
couvertures, les effectifs de cellules, l'identité du support et les réserves.
`evidence/weights.json.gz` conserve les 17 681 intersections SAFRAN, leurs aires et
poids, les centres identifiables par `sim.Xhm.Yhm`, les versions et empreintes.
Le référentiel officiel n'a pas été réparé, simplifié ou déplacé pour le calcul.

`evidence/era5-68-cell-inventory.json.gz` détaille les cellules, coordonnées et
poids des 68 PRA. Le bitmap Task19 à deux instants y est explicitement historique :
il ne constitue pas une vérification de chaque cellule pour les 14 journées
actuelles. Cette inconnue reste inscrite ; aucune restriction terre/mer n'est
inventée. La comparaison Task19 au masque ECMWF avait déjà montré 39 cellules
manquantes malgré une fraction de terre ≥0,5 et 42 présentes sous 0,5.

Les surfaces SAFRAN sont calculées sur des carrés de 8 km centrés sur les
coordonnées Lambert II étendu, densifiés à 1 km puis projetés en EPSG:3035.
La somme des aires n'est pas forcée à 1. Les trous restent mesurés. La tolérance
1e-4 est celle de fermeture géométrique déjà employée, pas un nouveau seuil de
qualification scientifique. Aucun seuil de 90 % n'est adopté.

Les coordonnées géographiques du CSV divergent jusqu'à 0,0009744° de la
transformation EPSG:27572 → WGS84, mais jusqu'à seulement 0,0000696° de l'inverse
vers le datum NTF (EPSG:4275). La `.prj` officielle confirme NTF. Cela étaye une
ambiguïté de datum/arrondi des colonnes géographiques, pas une autorisation de
translater les PRA. Le pilote emploie les coordonnées projetées officielles ; une
confirmation du fournisseur reste nécessaire pour certifier les bords côtiers.
Les autres fichiers de points ne sont pas interchangeables : SIM2.shp comporte
8 813 points et SHP_SIM_FRANCE 8 981, contre 9 892 dans le CSV et le fichier réel.
Aucun de ces anciens ensembles n'est utilisé comme masque silencieux.

## Territoires contrastés

| PRA | ERA5-Land | SAFRAN | Cellules SAFRAN |
|---|---:|---:|---:|
| Crozon 29102 | 0 % | 99,8144 % | 7 |
| La Hague 50081 | 43,9270 % | 100 % | 8 |
| Camargue 13244 | 78,8809 % | 100 % | 33 |
| Corse littorale 2A258 | 46,9222 % | 96,5047 % | 28 |
| Corse montagneuse 2B260 | 99,9839 % | 100 % | 63 |
| Beauce dunoise 28341 | 100 % | 100 % | 28 |
| Montagne continentale 05236 | 100 % | 100 % | 8 |

Sur les 68 anciennes PRA problématiques, 30 atteignent la fermeture géométrique
avec SAFRAN, 38 restent partielles. Aucune des 645 autres PRA ne régresse sur ce
critère. Cinq PRA corses restent partielles, une est complète. Les surfaces
manquantes vont jusqu'à 3,4953 % ; même un petit écart de Crozon ne doit pas être
converti en observation de la PRA entière. La résolution de 8 km ne résout pas
les microclimats, gradients d'altitude ou îlots de très petites PRA.

## Travaux consultés et portée

- Task19 : `verification/task19/evidence/official/coastal-netcdf-audit.json`,
  `evidence/final/native-probe-audit.json`, `evidence/closure/ecmwf-mask-comparison.json`,
  code `territories/spatial.py` et tests associés.
- Task26 : `COASTAL_COVERAGE.md`, `ERA5_ARCHIVE_ONLY.md`, `RESOURCE_BUDGET.md`,
  `COASTAL_SPATIAL_RESTITUTION.md` ; archives et masques existants.
- Task28 : `ACCEPTANCE.md`, `COASTAL_HISTORICAL_FIX.md`, `SCIENTIFIC_RULES.md`.
- Task29 : `FINAL_DECISION.md`, `RESOURCE_PLAN.md`, `COMPLEMENT_COMPARISON.md`,
  preuves SAFRAN et récupération ciblée.
- Task30 : `NATIONAL_WATCH_ENGINE.md`, `FINAL_DECISION.md`.
- PR #62, ref lue sans merge : `agro01/NATIONAL_COVERAGE.md`,
  `agro01/SCIENTIFIC_VALIDATION.md`.

L'audit n'est pas une validation stationnelle nationale. Les inconnues sur les
cellules ERA actuelles, la datation météorologique fine et les supports littoraux
sont des limitations de preuve, pas des territoires à classer artificiellement prêts.

La voie publique de stations a ensuite fourni 84 diagnostics point/surface sur
les sept territoires ; elle évite de bloquer le pilote sur l'accès DPClim. Les
stations n'étant pas exclues de l'assimilation SAFRAN, cette comparaison ne clôt
pas la validation indépendante. Voir `SAFRAN_PILOT.md`.
