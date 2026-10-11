# Fond de repérage Observation

`europe-overview.geojson` est un extrait simplifié du jeu **Natural Earth**,
via https://github.com/datasets/geo-countries/blob/master/data/countries.geojson,
récupéré le 2026-10-11. Natural Earth est dans le domaine public :
https://www.naturalearthdata.com/about/terms-of-use/.

Sélection des polygones intersectant approximativement l'Europe occidentale,
simplification par échantillonnage à environ 180 sommets par anneau, fermeture
conservée. Ce fond permet le repérage France métropolitaine / Corse ; il ne
constitue ni une géométrie administrative officielle ni un support d'agrégation
scientifique. Les géométries de risque viennent exclusivement du repository / API.

`maplibre/` est généré avant `dev` et `build` à partir du package MapLibre v6
verrouillé. Il contient le worker ES module, son module partagé et sa licence BSD.
Aucun service de tuiles ni CDN n'est requis à l'exécution.
