# Méthodes et garde-fous scientifiques

## Correspondance

`total-area-epsg3035-1` : empreinte de chaque centre CDS 0,1° = rectangle de
±0,05°. Les cellules partiellement hors France et les centres hors d’une PRA
peuvent contribuer si leur empreinte intersecte la PRA. Parallèles et méridiens
densifiés à 0,01° avant projection EPSG:3035 ; aucune aire en degrés carrés.
Poids = aire d’intersection / aire officielle PRA. Tolérance numérique de somme
1e-4, pas de renormalisation selon la météo disponible. Aires et contrôles
administratifs dans la même projection. La correspondance est versionnée et
régénérable ; elle n’augmente pas la résolution météorologique effective.
Pas de masque agricole fiable déjà validé dans le dépôt : surface totale,
limitation portée par `total_area_not_agricultural_area`. Relief et gradients
intra-cellule non résolus ; aucune interpolation station → PRA.

## Agrégation

| Famille | Ordre / sens | Manquants |
|---|---|---|
| Moyenne spatiale | somme poids × valeur / poids valides ; la valeur pleine PRA exige toutes les cellules | valeur complète null, estimation sur support observé séparée |
| Extrema | minimum/maximum parmi les valeurs natives valides, pas moyenne des maxima | extrema observés séparés, valeur complète null |
| Cumul temporel | somme dans chaque cellule sur fenêtre complète, puis réduction spatiale | aucun cumul complet sur fenêtre incomplète |
| Fraction au seuil | condition au support natif, somme des poids affectés / surface totale PRA | fraction manquante inconnue, pas zéro ni renormalisation silencieuse |

Température journalière : moyenne spatiale de la moyenne UTC par cellule.
Minimum/maximum : extrema des minima/maxima quotidiens natifs parmi les cellules.
Précipitation : **profondeur moyenne spatiale**, jamais somme des mm entre cellules.
L’API département/région/France renvoie les statistiques PRA et leurs surfaces,
paginées ; elle ne fabrique pas une moyenne administrative non pondérée.
L’agrégation de niveau supérieur doit conserver la sémantique de chaque indicateur.

## Diagnostics existants

Les noyaux purs GDD, comptage de jours et séquences sont réutilisés depuis le
module blé existant, avec paramètres explicitement fournis et fingerprint.
Aucun nouveau seuil, stade, culture, score de risque ou calibration. Calcul
par cellule avant moyenne surfacique de l’indicateur ; les jours/séquences
territoriaux peuvent être fractionnaires et ne sont pas des événements communs
à toute la PRA. Métadonnées : `wheat-climate-1`, `exploratory`, `risk_computed:false`.
La sortie station existante garde ses contrôles et sa provenance Météo-France.
Aucune cellule ERA5 déguisée en station pour appeler le constructeur Portfolio.

L’application aux PRA reste descriptive et requiert une revue scientifique du
support territorial ; aucun diagnostic expert validé n’est déclaré.
THI : non supporté côté réanalyse, humidité absente du provider actuel et aucune
validation du support grille. Les résultats bovins station existants restent
inchangés. Anomalies 1991–2020 : non calculées ; structure sparse prête pour Task20.

## Temps, révisions, qualité

Dates quotidiennes UTC, y compris années bissextiles et changements d’heure
Europe/Paris : jamais de journée locale de 23/25 h utilisée comme journée UTC.
Tests du décodeur existant : heures incomplètes, timestamp dupliqué, unités,
accumulation pluie et source réelle. Les statistiques conservent le nombre
attendu/valide et la couverture pondérée **pour chacune des quatre variables**.
Une erreur n’est jamais remplacée par une fixture en mode réel.
Délai source configurable, garde initiale cinq jours (pas une garantie de publication).
Réanalyse récente ≠ observation live, prévision ou réussite du dernier run.
Recalcul sous une nouvelle version dataset ; aucune écriture destructive des
versions existantes. Les snapshots Task17 et l’historique station sont préservés.
