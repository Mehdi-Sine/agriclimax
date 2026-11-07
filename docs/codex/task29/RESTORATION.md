# Restauration native Task29 — validation intermédiaire

Base main `3fea8d2`, branche `codex/29-historical-coastal-completion`, PR draft57. Aucun appel CDS, aucune acquisition opérationnelle, aucune écriture Supabase effectués à cette étape.

## Archives existantes restaurées

Le connecteur officiel GitHub a récupéré les quatre artefacts indiqués par l’utilisateur :13447760693,13448541085,13450332612,13450584616. Les checkpoints national19octobre (13426467045, copie de rejeu13426866079) et archive31octobre (13502565431) sont également récupérés. Les ZIP et les tuiles originaux restent intacts dans `work/task29/checkpoints/` ; aucune grille brute n’est ajoutée à Git ou PostgreSQL.

L’inventaire Actions paginé trouve les checkpoints Task26 à partir du19octobre, mais aucun checkpoint Task19D19septembre–18octobre. Le rapport Task19D décrit une acquisition locale et des caches dans `work/task19d/real`, absents de cet environnement. Les valeurs PRA strictes conservées ne contiennent pas les valeurs des cellules côtières manquantes.

## Résolution scientifique des chevauchements

Un aplatissement naïf des tuiles trouve de petites divergences : maximum0,0001220703125°C sur Tmin/Tmax et0,000001862645149230957mm de pluie. Ces divergences concernent les bordures nord/est inclusives d’anciennes requêtes1° ; ce ne sont pas deux valeurs concurrentes dans la tuile qui possède réellement la cellule.

La sélection reproduit l’appartenance **semi-ouverte** du pipeline existant : une cellule de centre `(lon,lat)` appartient à `(floor(round(lon,1)),floor(round(lat,1)))`. La tuile est liée cryptographiquement à son dataset, ses dates et son origine par la clé originale `digest(dataset,start,end,west,south,compact_version=1)`. Toutes les1450clés et SHA des quatre checkpoints finaux sont vérifiés. Les lignes de bordure appartenant à la tuile adjacente sont exclues de cette tuile seulement, sans supprimer ni modifier les fichiers sources. Après cette sélection, **aucune divergence de cellule propriétaire**, aucun arbitrage par ordre de lecture, moyenne ou tolérance ne subsiste.

Pour chaque date19–31octobre, les6861coordonnées nécessaires sont présentes :6592cellules valides et269NULL natifs pour chacun des quatre champs ; Tmin≤Tmoy≤Tmax pour les valeurs renseignées. L’absence de coordonnée fait échouer la qualification et n’est jamais assimilée à un masque physique NULL. La provenance inclut référentiel, poids, masques, manifeste SHA des tuiles et empreinte du document restitué.

## Restitution et science

- Tmoy et pluie : moyenne pondérée par intersections EPSG3035, renormalisée uniquement sur la portion explicitement renseignée. Même méthode Task26D et seuil exploratoire90% ; valeur PRA qualifiée distinguée de mesure complète.
- Tmin/Tmax : minimum/maximum des extrema natifs quotidiens des cellules valides, conformément aux familles `spatial_min`/`spatial_max` de `territories/aggregate.py`. Aucun extrême inféré de Tmoy. Masques indépendants par variable, géométries existantes réutilisées si cellules identiques.
- Chaleur, gel, séquences : règles de seuil et moteurs existants, appliqués uniquement à ce support commun natif. Même à99%, aucune promotion en résultat PRA entière. Un événement sur le support ne donne ni surface touchée ni diagnostic agronomique ; zéro n’exclut rien sur la portion absente.
- Multi-jours : chaque date complète et même masque, poids et couverture ; pas d’union des surfaces, interpolation ni remplacement d’une journée absente.

`agroclimatic-1.0.0` reste stricte ; `1.1.0` reste accessible avec les supports antérieurement publiés. La restitution restaurée et les extrema sont exposés sous `1.2.0`, sans changer les formules ou seuils des13indicateurs. Le producteur de supports est réutilisé par l’archive incrémentale ERA5 existante pour les prochains champs natifs ; aucun workflow quotidien ni acquisition AROME/ARPEGE/IFS modifié.

Le bundle restauré couvre19–31octobre. Les moyennes/GDD/pluie deviennent exploitables sur7jours, tandis que les événements et extrema partiels restent des informations de portion. La validation API réelle et la matrice complète sont encore à exécuter. La fenêtre30jours reste non certifiée tant que2–18octobre n’est pas restauré ou acquis de manière ciblée après validation du budget. Crozon conserve son masque natif nul ; étude complémentaire distincte nécessaire.

## Résultat final — 2 au 31 octobre

Les 30 journées sont désormais présentes : 1 393 coordonnées côtières par jour et par variable, dont 1 124 valides et 269 NULL natifs. Aucun conflit de cellule propriétaire. Les quatre variables ont des supports compatibles et vérifiés quotidiennement. Crozon reste sans cellule native valide. Les 67 autres PRA ont des supports reconstruits ; les agrégations 7 et 30 jours sont autorisées uniquement après contrôle de chaque journée. La matrice finale, les empreintes et les limites sont dans `evidence/final-matrix-summary.json`, `evidence/final-native-integrity.json` et `FINAL_DECISION.md`.
