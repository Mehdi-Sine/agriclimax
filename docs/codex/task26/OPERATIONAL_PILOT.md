# Pilote opérationnel

## Échantillon officiel

12PRA issues du référentiel versionné `ofb-masa-pra-2017-snapshot-20261017`, aucune géométrie/code inventé :28341Beauce dunoise,29102Crozon,50081LaHague,06245littoral méditerranéen partiel ERA5,13244Camargue,2A258littoral corse,2B260montagne corse,05457Briançonnais,15167Planèze deSaint-Flour,31391Lauragais,01446Bresse,14085Bessin. Inclut complète, partielle et indisponible ERA5. Les cellules IFS0,25° ont des intersections propres, EPSG3035, empreinte versionnée, total des poids vérifié à1±1e−4. Les poids ERA5 ne sont jamais réutilisés.

## Capture/restitution

`scripts/operational_weather_pilot.py` utilise un seul runIFS00UTC, champs2t/2d/TP choisis par index et plages d'octets. Sortie atomique uniquement après les12×7×5=420lignes validées par `PraWeather`. Les jours J+1àJ+7 exigent les échantillons jusqu'àH192 pour terminer le septième jour UTC. Contrôles GRIB : grille, résolution, champ, run, unités, étape et convention d'accumulation. Limites4GiB,96Mio,240requêtes,1200s. Les caches ont une empreinte ; conflits refusés. Le workflow conserve une récupération bornée après échec, sans déclencher de planification nationale.

La publication web utilise le même canevas `NationalMap`, les mêmes composants/tokens et une option explicite `/?experimental=weather`. API `/api/operational?experimental=weather`, sans secret et sans requête distante par visite. Une capture réelle revue est versionnée dans le fichier serveur `data/operational/cycle.json` ; aucun cycle artificiel n'est affiché. Le lecteur vérifie schéma, matrice complète et sémantique cycle/lead. État503 s'il n'existe pas de cycle validé. Une carte12PRA ne se prétend jamais nationale.

Dates, variables, PRA sélectionnables ; run et acquisitionUTC, couverture/qualité, cumul des pluies, NULL et fraîcheur explicites. Tmax/Tmin échantillonnées, Tmoy trapézoïdale et RH approximative sont marquées. Pas d'anomalie implicite ni transition AROME/ARPEGE/IFS non validée. Pas d'enregistrement d'une prévision comme observation.

**J−1 non démontré** : six401confirmés sur GitHub, aucune analyse ou observation actuelle acquise. Aucun substitut caché ; ce blocage empêche le critère de généralisation multi-sources. Les résultats IFS et mesures de capture sont à compléter après le run réel.
