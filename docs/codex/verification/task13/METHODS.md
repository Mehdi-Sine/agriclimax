# Méthodes Wheat MVP · wheat-climate-1

Tous les résultats sont **exploratory**, pour la production `wheat` (blé tendre).
Ils ne combinent ni exposition, ni sensibilité biologique, ni modèle de dommage.
Aucun niveau agronomique n'est attribué (`level=null`), aucune recommandation.
La confiance reste faible, même avec une fenêtre complète, faute de validation
métier experte. Elle ne mesure pas l'intensité du phénomène.

## Définitions et formules effectivement implémentées

Pour une fenêtre quotidienne inclusive D, TM = moyenne quotidienne **fournie par
Météo-France**, TX = maximum quotidien, TN = minimum quotidien, P = pluie en mm.
On ne reconstruit pas TM par `(TX+TN)/2`. Les étiquettes quotidiennes de Task11
sont conservées ; stockage UTC n'implique pas harmonisation des fenêtres source.

| Indicateur (`wheat.<id>`) | Définition / formule | Paramètres par défaut | Unité / source méthodologique |
| --- | --- | --- | --- |
| `gdd` | Σ max(TM − base, 0), sans plafond | base 4 °C, configurable | °C jour ; S1 `growing_degree_days` |
| `heat_days` | Σ 1(TX > seuil) | 25 °C ; égalité exclue | jour ; S1 `tx_days_above` |
| `heat_spell_max` | plus longue suite de TX > seuil, de longueur ≥ minimum ; sinon 0 si données complètes | 25 °C, minimum 3 jours | jour + nombre de suites qualifiées ; S1 `hot_spell_max_length`, regroupement explicite Wheat MVP |
| `frost_days` | Σ 1(TN < seuil) | 0 °C ; égalité exclue | jour ; S1 `tn_days_below` |
| `frost_spell_max` | même algorithme de suites appliqué à TN < seuil | 0 °C, minimum 3 jours | jour + nombre de suites ; définition exploratoire Wheat MVP |
| `precipitation_sum` | Σ P quotidien, sans conversion de flux ni cumul horaire | aucun | mm ; agrégation arithmétique des quantités quotidiennes Task11, S2 |
| `dry_days` | Σ 1(P < seuil), « sans pluie significative » ne signifie pas P exactement nul | 1 mm/jour ; égalité exclue | jour ; S1 `dry_days`, seuil aligné ici sur `maximum_consecutive_dry_days` |
| `dry_spell_max` | plus longue suite P < seuil, y compris bords de fenêtre | 1 mm/jour ; minimum 1 jour | jour + nombre de suites ; S1 `maximum_consecutive_dry_days` |
| `temperature_anomaly` | moyenne sur D des anomalies absolues quotidiennes Task12 : TM(d) − moyenne des TM ERA5 homologues | période et minimum d'années du Dataset Task12, inchangés | °C ; S3/S4 |
| `precipitation_anomaly` | somme sur D des anomalies absolues quotidiennes Task12 : P(d) − moyenne des P ERA5 homologues | mêmes exigences de référence | mm ; S3/S4 ; pas de pourcentage sur une normale nulle |

Les seuils ne sont **pas des seuils de dégâts du blé**. Les valeurs 4/25/0/1 sont
des exemples descriptifs compatibles avec les conventions citées. Le minimum de
suite 3 jours est un choix explicite de ce jeu d'exemple, pas une calibration
agronomique. Les références sanitaires citées dans les notes xclim des vagues de
chaleur ne sont pas utilisées comme références de sensibilité du blé.

## Paramètres, fenêtres et versionnement

`config/wheat-mvp.json` définit la version d'algorithme, le nom du jeu de paramètres,
les valeurs et leur source. Le SHA-256 canonique des paramètres normalisés est
transporté dans chaque portefeuille, vérifié côté web, et distingue toute
modification de seuil même si le nom du jeu est conservé. Une modification de
formule nécessite une nouvelle `rule_version`. Les résultats gardent les seuils
effectivement utilisés. Aucun changement des contrats V1 de risque.

`Window` exige début/fin inclus et 1 à 366 jours terminés. `explicit_calendar`
ne porte aucun stade. `supplied_stage` exige `stage` et `stage_source` pour l'un des
cinq stades : tallage, montaison, épiaison, anthèse, remplissage. Le stade n'affecte
pas automatiquement les seuils ; aucune date biologique n'est inférée.
`ValidatedPhenologyProvider` est seulement un protocole futur, sans implémentation
active ; il impose identifiant/version et référence de validation du modèle.

## Données absentes et séquences

Pour chaque indicateur, une valeur manquante ou un jour absent dans la variable
requise rend **tout l'agrégat de cette fenêtre null**. Le nombre de jours utilisables
reste visible ; aucune somme partielle n'est présentée comme totale. Un lot
partiel peut fournir des variables valides ; un lot invalid ne contribue pas.
Absence de pluie connue et donnée de pluie absente restent distinctes. Zéro est
possible seulement si toute la variable requise est disponible. Les séries horaires
`meteofrance-observations` sont rejetées : leurs échantillons ne constituent pas des
moyennes/extrema ou cumuls quotidiens complets. Les calculs utilisent les archives
quotidiennes réelles de l'ingestion Task11 `meteofrance-climatology`.

Les suites restent bornées par la fenêtre demandée. On n'extrapole pas une suite
commencée avant ou continuant après. Un trou invalide le résultat de séquence ;
il n'est jamais assimilé à un jour sans événement.

## ERA5-Land et anomalies : disponibilité réelle

La comparaison appelle directement `Task12 compare_daily`, avec sa méthode
`calendar-day-type7-midrank-1` et son minimum d'années. Il faut une cellule et une
source d'association **explicites**, un seul dataset/version, une référence
suffisante pour chaque jour et la même unité. Aucun voisin le plus proche n'est
choisi silencieusement. Un garde-fou exploratoire configurable
`max_grid_distance_km=20` rend les anomalies indisponibles pour une grille trop
éloignée ; cette borne de QA n'est pas une preuve de représentativité pour les
cellules plus proches, ni une distance agronomique universelle.

La base contenait 240 révisions de références Task12 au contrôle initial et 300
au contrôle final (aucune écriture distante de cette exécution) ; une lecture
distincte par date de `era5land.48.1.-1.7` au snapshot
`cds-snapshot-2026-10-15` fournit trois jours de **1991 seulement**. Le contexte
technique de Brest utilise explicitement cette cellule distante d'environ 200 km,
avec ses reçus réels, uniquement pour vérifier le branchement. La distance et le
manque d'années rendent les anomalies **null**, avec flags explicites. Les autres
stations n'ont aucune association locale prétendue. Les 100 lignes livrées incluent
80 valeurs descriptives et 20 anomalies indisponibles ; aucune normale fictive
ni réduction du minimum 30 ans n'est introduite. Les tests synthétiques à deux
années vérifient séparément la formule des anomalies et ne constituent pas une
preuve de normale réelle.

Les supports station/grille et fenêtres quotidiennes diffèrent ; aucune correction
de biais, harmonisation, interpolation ou validation spatiale n'est revendiquée.
Une anomalie de cumul ne donne pas une fréquence ni une période de retour.

## Fraîcheur et provenance

Les résultats exposent `rule_id`, `rule_version`, `production`, `indicator`,
`period`, `value`, `unit`, `threshold`, `level`, `confidence`, `freshness`,
`data_freshness`, `provenance`, `scientific_sources`, `scientific_status`,
`limits`, `quality_flags`, couverture et nombre éventuel de séquences.
Les reçus quotidiens gardent source, station/date, récupération et checksum ;
les entrées exactes capturées conservent également source_field/source_checksum.

La fraîcheur est un repère descriptif de 48 h depuis la fin de fenêtre UTC,
recalculé à la lecture côté serveur afin qu'un instantané ne reste pas « frais »
indéfiniment. Une fenêtre passée reste calculable mais est marquée ancienne ;
cela ne change pas sa valeur ou son statut scientifique. La publication source
reste inconnue quand Task11 ne la fournit pas.

## Références effectivement utilisées

- **S1** : xclim **0.58.1**, module `_threshold.py`, fonctions citées dans la table.
  [Source consultée](https://github.com/Ouranosinc/xclim/blob/v0.58.1/src/xclim/indices/_threshold.py),
  téléchargée et lue pendant l'exécution. Les algorithmes restent de petits calculs
  purs locaux ; xclim n'est pas une dépendance ajoutée au produit.
- **S2** : [documentation du connecteur Task11](../../../../engine/src/agriclimax/ingestion/METEOFRANCE.md),
  champs quotidiens TM/TN/TX/RR et provenance effective des réponses Météo-France
  capturées dans `inputs/`. Attribution : **Source : Météo-France**.
- **S3** : [méthode Task12 existante](../../../../engine/src/agriclimax/climate/README.md)
  et [code compare_daily](../../../../engine/src/agriclimax/climate/compare.py),
  utilisés sans modification. Les références conservées dans les entrées incluent
  version dataset, requête source et checksum.
- **S4** : ERA5-Land hourly data, Copernicus Climate Data Store,
  [DOI 10.24381/cds.e2161bac](https://doi.org/10.24381/cds.e2161bac).
  Référence dataset déjà transportée par Task12, pas une validation agronomique.

Aucune publication non consultée n'est invoquée pour calibrer le blé. Une revue
experte par contexte, variété et stade reste nécessaire avant tout usage métier.
