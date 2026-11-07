# Carte PRA dynamique du Journal

## Lecture des données

`JournalPraMap` reçoit le cycle exact résolu par le Journal, le phénomène du sujet principal, sa période et l’empreinte de son archive. Il ne demande jamais « le dernier cycle » côté navigateur. Un `IntersectionObserver` diffère les requêtes et le chargement du composant `features/national/map.tsx` jusqu’à proximité de la carte. La vérification des chiffres de une utilise sa propre frontière Suspense : elle ne bloque pas le titre et le chapeau. Le skeleton réserve un espace de 540 px pour la scène ; aucun ancien cycle n’est utilisé pendant une actualisation.

`GET /api/journal/map?run=<cycle UTC exact>&phenomenon=<id>` lit `nationalWatch(run)` existant et ne recalcule pas ses indicateurs. L’adaptateur conserve 713 valeurs pour un seul phénomène, les noms officiels et régions, les états et le dictionnaire de preuves correspondant. Pas de toutes les lignes météo ni de toutes les productions. Réponses conditionnelles ETag/304, cache public court ; erreurs 503 `no-store`, paramètres ambigus ou non épinglés refusés (400).

Le client refuse un résultat dont le cycle, le phénomène, la période, la source ou les 713 identités ne correspondent pas à l’article. Le composant est remonté avec une clé de contexte ; une ancienne sélection ne survit pas au changement de cycle. Une édition demandée par jour civil est d’abord résolue par le lecteur existant vers le cycle archivé de ce jour, puis ce cycle précis est transmis à la carte.

## Thèmes et palettes

| Sujet | Valeur déjà calculée par la veille | Palette existante |
| --- | --- | --- |
| Gel | minimum échantillonné sur la fenêtre, °C | `frost_min` |
| Chaleur | maximum échantillonné sur la fenêtre, °C | `temperature_max` |
| Pluie | maximum d’un cumul quotidien sur la fenêtre, mm/j | `rain`, fenêtre quotidienne (bornes en mm par journée) |
| Séquence sans pluie | longueur maximale homogène, jours | `dry_sequence` |
| Bovins | maximum de THI synthétique exploratoire, si évaluable | `thi` |

Les correspondances sont bornées par `PHENOMENA`. Couleurs, classes et libellés proviennent de `semanticPalette` / `classLabel` ; le panneau méthode réutilise `SemanticLegend`. Aucune anomalie sans référence qualifiée n’est ajoutée. Le THI reste exploratoire, sans promotion en indicateur de dommage qualifié.

La valeur zéro reste numérique. Un résultat non évaluable reste `null`, jamais zéro. Un support spatial partiel est gris et hachuré, sans extrapolation. Les valeurs disponibles gardent exactement les chiffres du moteur. Une couverture temporelle insuffisante reste non évaluable et hachurée ; la fiche précise si la réserve porte sur le support spatial ou sur la fenêtre temporelle. Le graphique régional représente une autre grandeur (PRA concernées / évaluables), avec ses dénominateurs ; il n’est jamais confondu avec la température cartographiée.

## Géométrie réelle

Source officielle : même référence OFB/MASA que l’explorateur, `public/maps/pra-national.geojson`, produite par le build depuis `config/coverage/ofb-masa-pra-2017-snapshot-20261017/reference.json`. Géométrie dérivée versionnée : `public/maps/journal-pra-v1.geojson`. Identifiants `pra:xxxxx` et propriétés officielles inchangés ; les 713 PRA, la Corse et les littoraux sont conservés.

Reproduction après préparation du fichier source :

```sh
npx --yes mapshaper@0.6.113 -i apps/web/public/maps/pra-national.geojson -simplify interval=250 keep-shapes -o apps/web/public/maps/journal-pra-v1.geojson format=geojson precision=0.00001
python docs/codex/task32/audit-pra-geometry.py
```

Simplification sur topologie partagée (intervalle de 250 m, conservation des formes), puis précision de 0,00001 degré. Trois intersections réparées par Mapshaper avant export. Aucun outil de simplification n’est chargé en production. Le premier essai très agressif à 5 % a été rejeté après contrôle des petits territoires ; il n’est pas l’artefact livré.

Audit : 713 identités et propriétés exactes, anneaux fermés, Corse présente. Ratios de surfaces géométriques angulaires dérivées/source de 0,97166 à 1,02659 ; ce contrôle ne mesure pas des hectares agricoles. Rapports et empreintes : `evidence/task32b/geometry-audit.json`, contrôle Shapely 2.1.2 dans `topology-audit.json` : zéro géométrie invalide dans la source et dans le dérivé. Ce contrôle optionnel se reproduit avec Shapely installé puis `python docs/codex/task32/audit-pra-geometry.py --topology`. La simplification sert l’affichage national ; l’explorateur complet conserve la géométrie détaillée.

## Interactions et défaillances

Survol avec nom officiel, valeur et état via MapLibre ; sélection ouvre une fiche contenant nom, région, valeur/unité, disponibilité, période, sources et preuves. Liste native au clavier pour les 713 territoires. Les liens vers `/veille` conservent cycle, phénomène et PRA. Zoom et déplacement sont explicitement activés pour préserver le défilement tactile par défaut ; bouton de désactivation, vue nationale et zoom natif accessibles.

L’échec d’une donnée ou de la géométrie affiche un réessai et conserve le reste de l’article. L’échec WebGL du composant existant laisse la sélection clavier, la fiche et le lien vers l’explorateur accessibles. Sans sujet principal, aucune carte fictive.

## Poids et cache

Géométrie source : 23 818 871 octets bruts / 9 710 368 gzip. Dérivée : 2 549 501 bruts / 705 590 gzip (environ −93 % gzip). Le serveur Next local a effectivement transféré environ 698 Ko compressés, selon sa compression. Une seule requête de géométrie et une seule requête de données par montage, aucune répétition lors des sélections ; géométrie réutilisée en mémoire. Versionner le nom de fichier lors d’une future modification de géométrie.

Le JavaScript de MapLibre, déjà présent dans l’application, est chargé après le rendu éditorial. Il représente un coût réel par rapport au SVG de T32 ; ce coût et le délai d’apparition sont mesurés dans la recette, sans prétendre à une carte interactive gratuite en octets.
