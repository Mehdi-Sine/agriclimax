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

python tests/e2e/prev01-qualified.py --origin http://127.0.0.1:3021 \
  --matrix work/prev01/scientific.json --output work/prev01/qualified-http.json
```

Le rapport complet par PRA et les empreintes restent sous `work/prev01/`. La campagne publique antérieure [COUV-08](../COUV-08/README.md) sert de comparaison. Ses lignes agrégées ne sont pas des preuves de couverture géométrique.
