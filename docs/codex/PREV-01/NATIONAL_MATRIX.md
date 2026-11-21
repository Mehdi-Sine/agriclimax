# Matrice nationale

Le référentiel est identique à COUV-08. Les contrôles demandent 713 identifiants distincts, dont six corses, sur chaque réponse nationale. Chaque ligne météo associe la variable, la date UTC, l’initialisation, l’échéance, l’empreinte source et le support. Le moteur commun applique la coloration entière à partir de 90 %, la géométrie qualifiée en dessous et le gris sans donnée admissible.

| Archive | Cycle de sélection | Index natif conservé |
| --- | --- | --- |
| `ed93ab…a398` | 14 novembre 2026, 18 UTC | `df8d1c…9145` |
| `884df1…c7fd` | 15 novembre 2026, 18 UTC | `e1da3c…5347` |

Les combinaisons météo croisent AROME, ARPEGE et IFS, la première et la dernière échéance disponibles et Tmoy, Tmin, Tmax, pluie et humidité. Les cas agroclimatiques couvrent les règles d’Explorer en J+1 et J+1–J+7. La matrice de qualification composite traite les fenêtres distinctes du paquet conservé. Elle vérifie l’identité du support et la présence de géométrie sous 90 %.

```sh
COUV08_ORIGIN=http://127.0.0.1:3020 COUV08_FORECAST_ONLY=true COUV08_FORECAST=true \
  COUV08_FORECAST_AGRO=true COUV08_REQUIRE_NATIVE=true PREV01_DETAIL=true \
  COUV08_OUTPUT=work/prev01/native.json \
  apps/web/node_modules/.bin/tsx tests/e2e/couv08-matrix.ts

python tests/e2e/prev01-qualified.py --origin http://127.0.0.1:3025 \
  --matrix work/prev01/scientific.json --output work/prev01/qualified-http.json
```

Sur le build de production local, **106 contrôles HTTP** ont réussi dans le même processus. Les 50 cas météo couvrent 426 à 713 PRA entières et 0 à 287 grises. Les 56 cas agroclimatiques du trajet national couvrent 0 à 713 PRA entières et 0 à 713 grises. Ces 106 contrôles visent les index natifs conservés. Le candidat composite isolé a ensuite réussi 234 contrôles HTTP. Les 660 décisions positives uniques sont vérifiées avec le modèle explicite, dont 240 sous 90 %. Les 252 valeurs de la sélection nationale ont également été vérifiées, dont 96 sous 90 %. Chaque contrôle impose l’empreinte du support et une géométrie associée sous 90 %.

| Parcours composite | Requêtes | Valeurs validées | Dont sous 90 % |
| --- | ---: | ---: | ---: |
| AROME explicite | 6 | 21 | 0 |
| ARPEGE explicite | 21 | 30 | 0 |
| IFS explicite | 141 | 609 | 240 |
| Sélection nationale | 66 | 252 | 96 |

Sur la fenêtre de pluie retenue pour le navigateur, les quatre surfaces partielles mesurées en EPSG:3035 couvrent 63,75 % à 89,47 % de leur PRA. L’écart de fraction maximal est de 2,56 × 10⁻⁸ et la fraction hors contour maximale est de 1,49 × 10⁻⁸.

```sh
python tests/e2e/prev01-area.py   'http://127.0.0.1:3025/api/agroclimatic?temporal=forecast&indicator=rain&start=2026-11-18&end=2026-11-19&run=2026-11-14'   --output work/prev01/area.json
```

Le rapport complet par PRA et les empreintes restent sous `work/prev01/`. La campagne publique antérieure [COUV-08](../COUV-08/README.md) sert de comparaison. Ses lignes agrégées ne sont pas des preuves de couverture géométrique.
