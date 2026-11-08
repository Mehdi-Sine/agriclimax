# Catalogue blé tendre — AGRO-01

## Inventaire réellement audité et frontières

Base : `origin/main` 0e7bcba, fusion T31/PR #60. Demande complète : [TASK.md](TASK.md).

- `features/agroclimatic/catalogue.ts` : **10** règles nationales blé, pas neuf. Calcul pur partagé `calculate.ts`; restitution partielle dans `observed-support.ts`; lectures serveur `lib/server/agroclimatic.ts`.
- `features/wheat/` et `engine/src/agriclimax/wheat/` : portefeuille **station ponctuelle**, contrat `wheat-1`, règle `wheat-climate-1`. Dix résultats également, mais inventaire différent : GDD, chaleur (compte/séquence), gel (compte/séquence), pluie, sec (compte/séquence), deux anomalies. Pas de pluie forte ni de moyenne thermique brute dans ce portefeuille. `territories/aggregate.py:wheat_native` réutilise ces noyaux au support natif avant agrégation ; ne pas confondre avec le dépassement de la statistique territoriale nationale.
- `complement-calculate.ts` / complément côtier : reconstruction spatiale distincte, jamais utilisée par la liste blanche de publication AGRO-01.
- Frontières affectées : nouvelle qualification métier blé ; adaptateur éditorial ; composition serveur ; export additif des contributeurs par défaut. Aucun contrat de risque, migration, acquisition, workflow, composant Journal ou autre production modifié.

## Les dix mesures nationales

Pour chaque ligne, la formule est appliquée aux **statistiques quotidiennes de la PRA fournies par la source**, puis agrégée dans le temps. T = température moyenne quotidienne ; Tx/Tn = extrema échantillonnés territoriaux ; P = précipitation quotidienne. Les comparaisons sont strictes. Les séquences sont tronquées aux bornes de la fenêtre, sans continuation présumée.

| ID stable | Objectif descriptif | Entrée | Formule temporelle exacte | Paramètre fixé pour publication | Unité | Référence |
|---|---|---|---|---|---|---|
| `gdd` | Quantité thermique au-dessus d'une base conventionnelle | T, °C | Σ max(0,T−b) | b=0 °C, sans plafond | °C·j | R1 ; convention, pas phénologie validée |
| `hot` | Exposition à des maxima chauds | Tx, °C | Σ 1(Tx>25) | 25 °C | jours | R2, seuil personnalisé |
| `hot_sequence` | Persistance des maxima chauds | Tx, °C | Plus longue suite calendaire Tx>25 | 25 °C ; minimum 1 jour | jours | R2 |
| `frost` | Exposition au gel météorologique | Tn, °C | Σ 1(Tn<0) | 0 °C | jours | R2 ; pas gel de la plante |
| `frost_sequence` | Persistance du gel météorologique | Tn, °C | Plus longue suite calendaire Tn<0 | 0 °C ; minimum 1 jour | jours | R2 |
| `rain` | Apport de précipitation sur fenêtre | P, mm | Σ P | Aucun seuil | mm | R2/R3 |
| `heavy_rain` | Fréquence de fortes précipitations quotidiennes | P, mm | Σ 1(P>20) | 20 mm/j | jours | R2, borne personnalisée stricte |
| `dry` | Fréquence de jours sans pluie significative | P, mm | Σ 1(P<1) | 1 mm/j | jours | R2 |
| `dry_sequence` | Persistance sans pluie significative | P, mm | Plus longue suite calendaire P<1 | 1 mm/j ; minimum 1 jour | jours | R2 |
| `temperature_mean` | Niveau thermique moyen de la fenêtre | T, °C | (Σ T)/N | Aucun seuil ; jours de poids égal | °C | R3 |

## Période, espace et qualité communs aux dix lignes

Ces rubriques complètent les treize attributs de l'inventaire pour **chaque** ligne ci-dessus.

- **Période de validité** : fenêtre explicite UTC inclusive de 1 à 30 jours, jamais un stade biologique. Voie éditoriale actuelle : J+1 et fenêtre J+1…J+7 du cycle national vérifié ; aucune publication forcée si cette dernière n'est pas homogène.
- **Restitution spatiale** : calcul à la PRA entière selon le support météorologique déclaré, avec couverture ≥0,9999. Le champ de la PRA n'est ni une parcelle de blé, ni une surface agricole pondérée. Les maxima météo proviennent d'échantillons, pas d'une mesure continue. Les comptes de dépassement de P concernent la moyenne spatiale de pluie, pas la fraction du territoire mouillée. Les GDD calculés sur Tmoy de PRA ne sont pas la moyenne de GDD par cellule ; le seuillage ne commute pas avec l'agrégation spatiale.
- **Qualité exigée** : toutes les dates, valeurs finies, pluie ≥0 ; températures entre −100 et 60 °C (garde technique conservatrice, non plage agronomique). Lorsque T/Tn/Tx sont ensemble disponibles, Tn≤T≤Tx. Couverture temporelle complète, provenance et fraîcheur explicites, support natif stable, source/nature/initialisation homogènes. L'historique exige les comptes de cellules valides attendus et le statut source disponible. Les valeurs partielles ne sont jamais renormalisées.
- **Sources** : réanalyse ERA5-Land et sélection prévisionnelle AROME/ARPEGE/IFS archivées ; aucune concaténation entre modèles pour un cumul. Nature observation prévue par le type métier mais non activée ni validée en recette nationale ici. Date d'initialisation, fraîcheur inconnue et drapeaux de représentativité restent visibles ; `publication_time_unknown` ne devient pas une date inventée.
- **Niveau du calcul** : `technically_validated` sur le protocole et les archives décrits dans [SCIENTIFIC_VALIDATION.md](SCIENTIFIC_VALIDATION.md), avec limites et tolérances explicites. Ce statut ne valide pas l'acquisition météorologique contre des instruments indépendants.
- **Statut scientifique** : `exploratory`, interprétation agronomique `not_validated`. Publication descriptive seulement, conditionnelle aux contrôles automatiques. Aucune validation de risque, dommage, rendement, variété, stade ou besoin d'irrigation.
- **Limites** : fenêtres courtes ; dépendance à la maille, à l'échantillonnage temporel et aux masques terre/mer. `source_land_mask_unavailable` et autres drapeaux ne sont pas supprimés. Couverture numérique complète ≠ représentativité terrestre ou parcellaire démontrée. Les comptes nationaux ont pour population **toutes les PRA**, pas les hectares ni uniquement les PRA déclarant du blé.

## Versions et différences de méthode préservées

| Voie | Versions | Politique |
|---|---|---|
| Ancienne API nationale | `agroclimatic-1.0.0`, moyenne `1.1.0` | Inchangée ; seuils personnalisables |
| Support observé / natif | `agroclimatic-1.1.0` / `1.2.0` | Inchangé ; estimations ≥90 % seulement pour certaines moyennes/cumuls ; événements limités à l'aire observée |
| Station Python | `wheat-climate-1` | Inchangée ; exemple GDD **base 4 °C**, séquences chaleur/gel minimum **3 jours**, sec minimum **1 jour**, fenêtre jusqu'à 366 jours |
| Nouvelle qualification éditoriale | `wheat-descriptive-2.0.0` | Liste blanche explicite des dix ID ci-dessus ; paramètres du tableau uniquement ; support complet et homogène obligatoire |

La voie 2.0 réutilise `calculate` et ajoute les barrières de provenance/support, les contrôles thermiques et une classification explicite des supports partiels. Elle ne remplace aucune valeur ancienne. Les anomalies station restent exclues de la liste blanche nationale : référence ponctuelle/grille et fenêtre journalière non homologues ; aucune normale nationale compatible et complète démontrée dans cette recette.

## Références et portée

- **R1** McMaster & Wilhelm (1997), *Growing degree-days: one equation, two interpretations*, Agricultural and Forest Meteorology. https://doi.org/10.1016/S0168-1923(97)00027-0. Méthode de somme thermique ; ne valide pas une base 0 universelle pour le blé.
- **R2** ETCCDI, conventions de comptes/séquences : https://www.wcrp-climate.org/etccdi ; implémentations inspectables xclim 0.58.1 : https://github.com/Ouranosinc/xclim/blob/v0.58.1/src/xclim/indices/_threshold.py. Nos seuils et certaines bornes ne définissent pas des indices ETCCDI homologués (par exemple pluie forte strictement >20, pas ≥20).
- **R3** Muñoz-Sabater et al. (2021), *ERA5-Land: a state-of-the-art global reanalysis dataset for land applications*, https://doi.org/10.5194/essd-13-4349-2021 ; jeu de données https://doi.org/10.24381/cds.e2161bac. Source et représentativité du champ, pas validation agronomique.
- **R4** Porter & Gawith (1999), *Temperatures and the growth and development of wheat: a review*, https://doi.org/10.1016/S1161-0301(98)00047-1. Justifie le besoin de contexte biologique ; ne calibre aucun seuil de cette livraison. Titres des DOI R1 et R4 contrôlés dans Crossref le 7 novembre 2026.
