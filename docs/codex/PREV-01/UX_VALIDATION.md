# Recette interface

La recette Chromium s’exécute sur un build de production local. Elle vérifie les dimensions 1 440, 768 et 390 px, les 713 contours rendus, les légendes et unités et la concordance des couleurs avec les API. Les captures restent sous `work/prev01/browser/`.

```sh
COUV08_ORIGIN=http://127.0.0.1:3020 COUV08_WEATHER_RUN=2026-11-15 \
  COUV08_LABEL=optimized-15 COUV08_OUTPUT=work/prev01/browser node tests/e2e/couv08.mjs

COUV08_ORIGIN=http://127.0.0.1:3025 COUV08_WEATHER_RUN=2026-11-14 COUV08_AGRO_BROWSER=true \
  PREV01_SCENARIO=rain PREV01_START=2026-11-18 PREV01_END=2026-11-19 \
  PREV01_EXPECT_PARTIAL=true COUV08_LABEL=partial \
  COUV08_OUTPUT=work/prev01/browser node tests/e2e/couv08.mjs
```

Pour la pluie cumulée du 18 au 19 novembre, les trois tailles affichent 709 PRA entières et quatre emprises réellement partielles du paquet conservé. La même géométrie est liée à la même empreinte côté API et côté MapLibre. Les neuf scénarios de température pour chacun des deux cycles utilisent les vraies API AROME, ARPEGE et IFS.

Pour l’édition publiée du 21 novembre, les dix réponses de cartes et les dix WebP sont identiques à l’origine publique par SHA-256. Le carrousel, l’accès depuis le Journal et Cartes du jour conservent les 713 contours à 1 440, 768 et 390 px. Les captures correspondantes sont sous `work/prev01/browser/journal-*` et `work/prev01/browser/cartes-du-jour-*`. La reproduction utilise `COUV08_EDITION_ID`, `COUV08_ARCHIVES_ONLY=true`, `PREV01_DAILY_MAP=true` et `COUV08_ARCHIVE_BASELINE` avec un rapport d’empreintes de la même édition sur l’origine publique.

La fiche météo expose les empreintes source et support et signale une preuve manquante. Après navigation sans requête de page supplémentaire, Chromium a sélectionné le cycle IFS du 15 novembre, modifié l’échéance jusqu’au 22 novembre et ouvert la fiche de la PRA corse 2A258 avec sa provenance. Les scénarios météo couvrent les trois modèles et la pluie de la semaine entièrement grise sans valeur admissible. Les valeurs non admissibles sont grises. Les aperçus d’édition exigent des entrées gelées et une valeur identique, et restent distincts des archives publiées.

```sh
node tests/e2e/prev01-navigation.mjs http://127.0.0.1:3026 work/prev01/navigation.json
```
