# Recette interface

La recette Chromium s’exécute sur un build de production local. Elle vérifie les dimensions 1 440, 768 et 390 px, les 713 contours rendus, les légendes et unités et la concordance des couleurs avec les API. Les captures restent sous `work/prev01/browser/`.

```sh
COUV08_ORIGIN=http://127.0.0.1:3020 COUV08_WEATHER_RUN=2026-11-15 \
  COUV08_LABEL=optimized-15 COUV08_OUTPUT=work/prev01/browser node tests/e2e/couv08.mjs

COUV08_ORIGIN=http://127.0.0.1:3021 COUV08_WEATHER_RUN=2026-11-14 COUV08_AGRO_BROWSER=true \
  PREV01_SCENARIO=rain PREV01_START=2026-11-18 PREV01_END=2026-11-19 \
  PREV01_EXPECT_PARTIAL=true COUV08_LABEL=partial \
  COUV08_OUTPUT=work/prev01/browser node tests/e2e/couv08.mjs
```

La fiche météo expose les empreintes source et support et signale une preuve manquante. L’utilisateur peut choisir un modèle, un cycle archivé et une échéance. Les valeurs non admissibles sont grises. Les aperçus d’édition exigent des entrées gelées et une valeur identique, et restent distincts des archives publiées.
