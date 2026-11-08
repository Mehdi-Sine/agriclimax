# Cas réels et scénarios de recette

Les archives ne sont pas remplacées par des fixtures. Le replay principal utilise les 30 journées réelles DATA-01 du 1er au 30 octobre 2026, 713 lignes quotidiennes dont 645 PRA complètes dans l'intersection. Voir `briefing-example.json`, `real-cases.json`, la mémoire compressée et `comparisons.json.gz`.

## A — Continuité historique

Reconstruction : 2 734 épisodes PRA (1 658 séquences sèches, 495 épisodes de pluie > 20 mm/j, 464 épisodes Tmax > 25 °C, 117 épisodes Tmin < 0 °C). 571 sont encore documentés au cutoff du 30 octobre, sans affirmation sur le 8 novembre. Les épisodes terminés, censurés et interrompus restent distincts.

Exemples maximaux archivés, à interpréter dans la PRA indiquée :

- dry : pra:92333, du 2026-10-08 au 2026-10-19, 12 jours documentés, extrême/durée 12 jours.
- frost : pra:73229, du 2026-10-20 au 2026-10-30, 11 jours documentés, extrême/durée -10.8597 °C.
- heat : pra:40378, du 2026-10-02 au 2026-10-06, 5 jours documentés, extrême/durée 27.8595 °C.
- rain : pra:07171, du 2026-10-19 au 2026-10-20, 2 jours documentés, extrême/durée 48.6165 mm.

Ces valeurs sont des réanalyses, pas des relevés de terrain ni des dommages. Un épisode sec n'est pas une sécheresse agricole.

## B — Prévisions successives

`forecast-revision.json` conserve les empreintes de deux archives réelles du 7 novembre à 00 UTC et du 8 novembre à 06 UTC. Leurs validités communes sont examinées ; leur écart de 30 heures n'est aucun des horizons exacts de T31. Les 52 diagnostics sont donc non comparables, sans tendance observée inventée. Le cas positif forecast_revision avec validités, support et horizon identiques est vérifié séparément en test unitaire synthétique, explicitement identifié comme tel. Il manque un couple réel distant d'au moins trois jours pour cette démonstration positive.

## C — Événement et fenêtre saisonnière

Les propositions suivantes proviennent du dossier réel ; ce sont des angles à vérifier, pas des titres publiés :

- Réanalyse historique : dry en Nouvelle-Aquitaine : 103 PRA ; durée maximale 7 jours. Question : « Les pluies récentes changent-elles la lecture de la saison ? » Fenêtres : ALM-001, ALM-005, ALM-110.
- Réanalyse historique : frost en Auvergne-Rhône-Alpes : 14 PRA ; durée maximale 11 jours. Question : « Vignobles et vendanges tardives : événement local à qualifier. » Fenêtres : ALM-114, ALM-116, ALM-064.
- Réanalyse historique : dry en Auvergne-Rhône-Alpes : 76 PRA ; durée maximale 7 jours. Question : « Les pluies récentes changent-elles la lecture de la saison ? » Fenêtres : ALM-001, ALM-005, ALM-110.
- Réanalyse historique : dry en Occitanie : 70 PRA ; durée maximale 10 jours. Question : « Les pluies récentes changent-elles la lecture de la saison ? » Fenêtres : ALM-001, ALM-005, ALM-110.
- Réanalyse historique : dry en Grand Est : 57 PRA ; durée maximale 5 jours. Question : « Les pluies récentes changent-elles la lecture de la saison ? » Fenêtres : ALM-001, ALM-005, ALM-110.

Les productions éventuelles du calendrier restent des hypothèses saisonnières et ne deviennent pas des cultures en place.

## D — Calme et absence de sujet

`real-cases.json` fournit une journée réelle d'une PRA avec pluie de 1 à 20 mm, Tmin >= 0 et Tmax <= 25 : aucun épisode encore actif sur cette PRA à cette date. Cela ne prétend pas démontrer une journée calme nationale. Le test éditorial sans événement, synthétique, vérifie zéro une et au plus deux questions documentaires, sans alerte fabriquée.

## E — T34

Aucune concordance complète. Onze liens faibles d'une publication DRAAF Nouvelle-Aquitaine, conservés en diagnostic seulement. Aucun bonus de priorité ni preuve scientifique. Les publications postérieures à la date éditoriale de Paris sont exclues, y compris celles publiées avant minuit UTC mais déjà le lendemain à Paris.

## F — Supports partiels et Crozon

La PRA de Crozon `pra:29102` a 120 positions de preuve (30 jours × quatre descripteurs), zéro valeur qualifiée et zéro épisode. Un support partiel réel distinct est joint avec ses flags ; aucune valeur de zone observée partielle n'est extrapolée à toute la PRA. Pas de faux no-risk ni de tendance.

## G — Almanach perpétuel

365 dates testées, 29 février sans repère hérité, fenêtres interannuelles, alias MARR, Pâques 2026/2027, conversion Paris été/hiver et ajouts VEG à relire. Les dates astronomiques, lunaires et organisateurs non vérifiées restent non résolues.

Reproduction des diagnostics PRA :

```sh
NODE_OPTIONS=--conditions=react-server apps/web/node_modules/.bin/tsx scripts/task33_cases.ts
```
