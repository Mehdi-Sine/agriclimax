# Task26B — audit ciblé et contrat v1

Base : bcf53a3, branche et PR55 conservées. Les Tasks19D–26 sont les fondations, aucune réingestion du 19 octobre ni des normales.

## Frontières et réemploi

- Acquisition : `Era5LandProvider.acquire` groupe déjà exactement les dates par mois et acquiert T2m+TP, avec le lendemain nécessaire à la pluie. Réutilisable sans changement scientifique. Le wrapper national doit grouper les jours par emprise au lieu de répéter chaque jour.
- Décodage/agrégation : `decode_netcdf`, `write_native_tiles`, `run_batch`, `aggregate`, `load_reference` et projections existantes conservés. Les tuiles quotidiennes restent compatibles avec les checkpoints Task26. Les grilles AROME/ARPEGE/IFS exigent leurs propres intersections EPSG3035 ; aucune réutilisation des poids ERA5.
- Persistance : RPC immuable, collision/refus de révision, identité géométrie/poids et garde375Mo conservés. Grouper les jours dans un lot (1–7 déjà supportés) réduit les reçus répétés sans changer les lignes historiques. Une modification forward-only de conservation éventuelle doit démontrer restauration et droits ; pas de mutation des anciens lots pour introduire le contrat.
- Catalogue : 713 enregistrements, y compris NULL, sont nécessaires ; les contours et horloges ne prouvent pas la publication.
- Station : DPClim archive quotidienne et DPObs échantillon horaire existants sont distincts ; une station est un comparateur ponctuel, jamais une PRA ni un remplacement silencieux. Le jeton observations ne prouve pas un abonnement modèles.
- API/UI : mêmes lecteurs territoriaux et canevas ; contrat expérimental séparant explicitement nature et cycle. Aucun statut national complet issu du pilote.

## Contrat stable

`engine/src/agriclimax/territories/weather.py`, `PraWeather`, version `pra-weather-1` (schéma JSON versionné dans contracts/jsonschema). Une ligne PRA/variable/période/source/cycle, unités degC/mm/%, UTC. Le lead représente la fin de la période par rapport au run ; pour une observation/réanalyse il est NULL. Nature obligatoire observation/analysis/reanalysis/forecast, non déduite de H+0. Source, modèle, version de calcul, grille, empreinte des poids et de provenance sont explicites. Couverture spatiale et temporelle séparées ; partial/unavailable portent NULL ; manque/retard explicites (retard inconnu : NULL). Publication inconnue reste NULL. Exploratoire ne signifie pas validation statistique.

Architecture : fournisseur → champs natifs validés/unités/temps → réduction quotidienne sur grille → intersections propres à la grille et agrégation commune → contrat v1 → publication d'un cycle validé → API et canevas expérimental. Aucun mélange automatique entre modèles ; chaque scénario reste sélectionnable avec son run. La comparaison précède toute règle de transition.

## Doublons et migrations

Éviter un deuxième moteur de calcul ou une deuxième édition ERA5. L'acquisition multi-jours utilise le splitteur Task19D, la reprise Task26 et les lots existants. À ce jalon A aucune migration indispensable au contrat (adaptateur/addition, historiques immuables). Les besoins de conservation et publication atomique du pilote seront décidés après mesures, pas une nouvelle table par fournisseur.
