# Inconnus et refus résiduels

La géométrie commune est désormais qualifiée pour les 758 632 lignes du cycle étudié : **zéro inconnu spatial**. La qualification numérique exhaustive accepte **730 387 valeurs** et laisse **28 245 valeurs non qualifiées**, toujours NULL.

La jointure entre la matrice numérique et la matrice spatiale établit les distinctions suivantes :

| Qualification résiduelle | Lignes | Conséquence |
| --- | ---: | --- |
| THI sur support partiel, hors tolérance de complétude | 26 400 | Inadmissible selon la politique `specific` existante ; aucune extrapolation ni modification de règle. |
| Intersection native vide démontrée | 660 | Absence de support commun, pas absence du phénomène ; valeur NULL. |
| THI proche de la complétude, cellules d'entrée différentes | 240 | Qualification numérique inconnue : recalcul natif sur l'intersection requis, malgré la tolérance surfacique. |
| Recettes de pluie avec supports changeants ou entrée agrégée inexploitable | 945 | Qualification numérique inconnue : recalcul natif sur le support commun requis. |
| **Total** | **28 245** | Aucun agrégat sur une surface différente n'est réutilisé. |

**1 185 valeurs restent donc à qualifier numériquement par un recalcul natif**, dont 240 THI et 945 dérivées de pluie. Leurs preuves spatiales ne manquent pas. Cette PR ne prétend pas que ces recalculs seraient scientifiquement impossibles : elle ne les réalise pas et ne les remplace pas par un calcul sur des agrégats incompatibles. Le checkpoint original contient des champs natifs réutilisables ; un traitement borné, vérifié et persistant sur l'intersection, puis sa liaison à l'archive exacte, restent nécessaires avant activation.

Les 945 cas de pluie représentent 105 cas par recette : `rain`, `heavy_rain`, `dry`, `dry_sequence`, `rain_frequency`, `wet_days1`, `wet_sequence1`, `rain10_days`, `rain_max1day`. Les 240 cas THI représentent 80 cas par recette THI. Aucun catalogue, seuil ou comportement scientifique n'est modifié pour les faire passer.

Les **2 577 anciens inconnus spatiaux** sont tous des THI partiels, de fraction commune ≤98,6168 %. Ils relèvent du premier groupe et restent scientifiquement inadmissibles pour une valeur territoriale THI. Leur résolution géométrique ne produit aucune nouvelle valeur admissible.

## Pièces permettant de retrouver chaque cas

- [numeric-residuals.csv.gz](evidence/numeric-residuals.csv.gz) : les 28 245 lignes, avec modèle, cycle UTC, période, indicateur, PRA, état numérique, fraction commune, état spatial, motif du lecteur et qualification résiduelle.
- [numeric-residual-summary.json](evidence/numeric-residual-summary.json) : totaux et indicateurs.
- [numeric-matrix.csv.gz](evidence/numeric-matrix.csv.gz) : les 758 632 lignes, y compris les valeurs qualifiées.
- [resolved-matrix.csv.gz](evidence/resolved-matrix.csv.gz) : résolution des seuls 2 577 inconnus spatiaux, empreinte des cellules, entrées, géométries et identité de support par recette.

La clé de jointure est modèle/cycle UTC/début/fin/indicateur/PRA. Les noms de modèle d'archive (`arome-0p025`, `arpege-0p1`, `ifs-oper-0p25`) sont normalisés vers les noms des preuves. `common_fraction` provient de l'intersection native vérifiée, jamais du minimum des fractions des agrégats. La classification utilise la tolérance de complétude existante (0,0001), sans changer cette tolérance.

Le motif technique du lecteur n'est pas confondu avec le diagnostic scientifique après jointure. Par exemple, 402 intersections vides réunissent des entrées individuellement non vides : le lecteur d'agrégats les refuse pour changement de cellules ; la preuve spatiale démontre ensuite que leur intersection est vide. Les 258 autres absences sont directement détectées comme entrée native vide. Toutes restent NULL, jamais zéro.

## Autres limites du GO

Les contrôles navigateur portent sur les composants partagés en recette locale et les rasters serveur. Ils ne certifient pas tous les parcours complets du produit, les temps réseau réels, plusieurs exports successifs et la rétention Storage inter-cycles. Les éditions publiées ne sont pas retraitées. Le bilan reste **PARTIAL / NO-GO pour activation**, sans fusion ni activation automatique.
