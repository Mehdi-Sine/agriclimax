# Task26D — support spatial réel et littoraux

Les713contours officiels sont conservés intégralement, avec leurs identifiants et réserves de référence existantes. Une couche complémentaire représente les intersections des cellules ERA5 réellement renseignées avec chaque PRA, projetées enEPSG:3035. Elle ne décore pas une lacune : les cellules valides ont des échantillons journaliers complets vérifiés en amont ; la fraction géographique est contrôlée contre les poids indépendants à1e−7.

## Historique

645PRA ont un support complet ;36supplémentaires ont au moins90% de support ;31ont un support positif sous90% ;Crozon a zéro cellule valide. Pour Tmoy et la profondeur moyenne de pluie, **681PRA ont une valeur qualifiée**,31une moyenne de leur seule portion renseignée,1aucune valeur historique. Les extrema, seuils, normales et anomalies ne bénéficient pas automatiquement de cette règle.

La méthode `pra-observed-area-mean-90-1` conserve le calcul strict en DB/archive et expose séparément la moyenne pondérée sur cellules disponibles. À≥90%, une estimation qualifiée apparaît ; sous90%, la carte colore seulement le support observé et la fiche indique qu'aucune valeur PRA entière n'est disponible. Une fraction spatiale n'est ni une durée complète ni une fraction de terre du modèle.

67géométries partielles non vides sont mutualisées, inchangées sur les journées27–31octobre contrôlées. Les cellules valides peuvent changer à l'avenir : un nouvel identifiant n'est créé que pour un support différent. Le blob géographique immuable est dédupliqué parSHA ; les valeurs quotidiennes sont archivées séparément. Aucune nouvelle géométrie quotidienne lorsque le masque reste identique.

Simplification d'affichage10m, topologie préservée, recoupée par le contour officiel : erreur surfacique maximale0,0667% de laPRA ; vérifications de validité et de correspondance aux poids. Le contour extérieur reste visible et sélectionnable, les portions inconnues grises. Les contours officiels ne sont pas simplifiés par cette opération.

## Masques physiques opérationnels

La [documentation officielle Météo-France](https://confluence-meteofrance.atlassian.net/wiki/spaces/OpenDataMeteoFrance/pages/621019138) fournit les champs constants AROME`constant-eurw1s40.grib2` et ARPEGE`constant-eurat01.grib2`. Deux fichiers réels ont été acquis surGitHub :1984659octets. Le décodage vérifie `lsm`, grille régulière0,025°/0,1°, valeurs[0,1], support de toutes les cellules nécessaires aux713PRA et empreintes. Les grilles brutes restent dans les checkpointsGitHub ; seuls les agrégats de fractions sont privés dansStorage.

Le masque natif IFS déjà validé est conservé. Les anciennes fractions de centres dans le référentiel sont des proxies géométriques, distincts des masques physiques ; l'interface utilise désormais les masques officiels complémentaires lorsque disponibles. Aucun poids météo n'est renormalisé silencieusement.

| PRA | Terre AROME | Terre ARPEGE | Sensibilité Tmoy terre−toute aire AROME | Idem ARPEGE |
|---|---|---|---|---|
|pra:29102|90.07%|17.54%|-0.217°C|-1.812°C|
|pra:50081|94.65%|79.77%|-0.143°C|-0.419°C|
|pra:13244|98.42%|93.07%|-0.028°C|-0.123°C|
|pra:2A258|89.41%|77.52%|-0.438°C|-0.748°C|
|pra:2B260|99.99%|100.00%|-0.001°C|+0.000°C|

29102=Crozon,50081=LaHague,13244=Camargue,2A258=Corse littorale,2B260=Corse montagneuse. Comparaison exploratoire sur le7novembre, runMF06UTC :1426moyennes toutes aires reproduites depuis les caches avant comparaison terrestre. **Zéro nouvelle acquisition**, zéro écriture, aucune valeur publiée remplacée. Les différences mesurent une sensibilité au support, pas un biais par rapport à une station.

ARPEGE Crozon ne représente que17,54% de terre au sens de son masque ; son résultat numérique ne doit pas être présenté comme une mesure terrestre validée. La moyenne terrestre calculée séparément est un diagnostic, pas un remplacement automatique. Aucun recours SAFRAN/SIM national redondant : une éventuelle comparaison ciblée nécessiterait une période et une référence compatibles, notamment pour laPRA historique sans cellule.

Preuves : `official-land-masks.json`, `coastal-sensitivity.json`, `spatial-build.json`, `era31-independent.json` dans `task26d-evidence/`.
