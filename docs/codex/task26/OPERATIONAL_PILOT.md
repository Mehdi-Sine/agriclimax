# Pilote opérationnel

## Échantillon officiel

12PRA issues du référentiel versionné `ofb-masa-pra-2017-snapshot-20261017`, aucune géométrie/code inventé :28341Beauce dunoise,29102Crozon,50081LaHague,06245littoral méditerranéen partiel ERA5,13244Camargue,2A258littoral corse,2B260montagne corse,05457Briançonnais,15167Planèze deSaint-Flour,31391Lauragais,01446Bresse,14085Bessin. Inclut complète, partielle et indisponible ERA5. Les cellules IFS0,25° ont des intersections propres, EPSG3035, empreinte versionnée, total des poids vérifié à1±1e−4. Les poids ERA5 ne sont jamais réutilisés.

## Capture/restitution

`scripts/operational_weather_pilot.py` utilise un seul runIFS00UTC, champs2t/2d/TP choisis par index et plages d'octets. Sortie atomique uniquement après les12×7×5=420lignes validées par `PraWeather`. Les jours J+1àJ+7 exigent les échantillons jusqu'àH192 pour terminer le septième jour UTC. Contrôles GRIB : grille, résolution, champ, run, unités, étape et convention d'accumulation. Limites4GiB,96Mio,240requêtes,1200s. Les caches ont une empreinte ; conflits refusés. Le workflow conserve une récupération bornée après échec, sans déclencher de planification nationale.

La publication web utilise le même canevas `NationalMap`, les mêmes composants/tokens et une option explicite `/?experimental=weather`. API `/api/operational?experimental=weather`, sans secret et sans requête distante par visite. Une capture réelle revue est versionnée dans le fichier serveur `data/operational/cycle.json` ; aucun cycle artificiel n'est affiché. Le lecteur vérifie schéma, matrice complète et sémantique cycle/lead. État503 s'il n'existe pas de cycle validé. Une carte12PRA ne se prétend jamais nationale.

Dates, variables, PRA sélectionnables ; run et acquisitionUTC, couverture/qualité, cumul des pluies, NULL et fraîcheur explicites. Tmax/Tmin échantillonnées, Tmoy trapézoïdale et RH approximative sont marquées. Pas d'anomalie implicite ni transition AROME/ARPEGE/IFS non validée. Pas d'enregistrement d'une prévision comme observation.

**J−1 non démontré** : six401confirmés sur GitHub, aucune analyse ou observation actuelle acquise. Aucun substitut caché ; ce blocage empêche le critère de généralisation multi-sources. 
## Résultat réel

RunIFS5novembre2026à00UTC, jours6–12novembre (J+1àJ+7). Acquisition GitHub42089278523 :57index+170champs sélectionnés,66259061octetsGRIB ; arrêt scientifique après237,37s de programme, sans publication. Artefact de récupération conservé. Aucune réacquisition : décodage local des mêmes octets, puis cache natif compactSHA25661310octets, et retraitement/rejeu hors réseau en≈0,8s, RSS188408Kio mesuré sur le rejeu. Le RSS de l'acquisition froide n'a pas été mesuré (borne4GiB seulement).

420lignes :84Tmoy,84Tmin,84Tmax disponibles ; pluie77disponibles/7partielles ; RH39disponibles/45partielles.12différences natives de cumul négatives (−0,12207à−0,06104mm) et123échantillons de réduction RH hors bornes ; valeurs concernées NULL, aucune pluie négative remise à0 et aucune RH écrêtée. Ces comptes peuvent partager un échantillon de frontière de journée ; ils ne représentent pas123stations ni123jours indépendants. La couverture temporelle conserve les intervalles valides, la couverture spatiale les cellules valides sur toute la journée.

La cause des anomalies source n'est pas attribuée avec certitude. Les effets de quantification et l'approximation RH sur eau liquide sont des limites à investiguer ; ce ne sont pas des corrections validées. Toutes les unités/run/grille/steps ont passé les contrôles GRIB. La publication expérimentale conserve ces limites et les statuts.

Contrôle indépendant, sans `aggregate` ni helperRH de production :420valeurs/statuts,52NULL, écart maximal1,42e−14. Entrées natives et manifeste conservés dans `config/pilots/ifs-oper-20261105-00z/`, jamais exposés par l'API. Test de reproduction des420lignes identiques hors réseau ; seuls les agrégats PRA490958octets sont servis. Horodatage d'acquisition original19:12:22UTC issu du mtime runner dans l'archive (précision2s), explicitement marqué ; publication fournisseur et retard restent NULL.

Reproduction sans CDS/IFS/GRIB global : copier `native.json.gz`, saSHA et `native-manifest.json` dans un répertoirework neuf, puis exécuter le même script avec `--offline-native --execute --run-date 2026-11-05 --root ...`. Le script recalcule les poids depuis les géométries officielles et refuse toute discordance de support/provenance.


## Convention UTC versionnée

La version finale de calcul est `pra-weather-daily-2` (contrat de transport `pra-weather-1` inchangé). Les minima/maxima échantillonnés excluent le minuit suivant : période[00UTC,24UTC[. Ce point final reste nécessaire à l'intégration trapézoïdale de Tmoy/RH. La révision corrige26Tmin et5Tmax du prototype initial, sans acquisition ni modification de Tmoy/pluie/RH/ERA5. Les données natives et leurs empreintes restent identiques ; test ciblé d'un minuit suivant extrême et vérification indépendante420valeurs après révision. Preuve `operational-evidence/ifs-utc-extrema-version.json`. L'avertissement de grille indique désormais exactement l'absence de masque terrestre, sans affirmer qu'une PRA intérieure contient de la mer.
