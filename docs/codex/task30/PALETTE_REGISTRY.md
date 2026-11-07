# Registre des palettes

Source exécutable : `features/cartography/registry.ts`. Documentation publique générée : `/aide/cartes`. Chaque définition inclut famille, nature, unité, bornes, tokens, sens, référence, version, classification, justification, traitement NULL/partiel et URL d’aide.

| Famille | Bornes supérieures des quatre premières classes | Dernière classe |
|---|---|---|
| Température absolue °C | 0, 10, 20, 30 | >30 |
| Anomalie thermique °C | -3, -1, 1, 3 | >3 |
| Écart pluie mm | -50, -10, 10, 50 | >50 |
| Pluie quotidienne mm | 1, 5, 10, 20 | >20 |
| Pluie 2–7 jours mm | 5, 20, 40, 70 | >70 |
| Pluie 8–30 jours mm | 10, 50, 100, 200 | >200 |
| Séquence sèche jours | 0, 2, 4, 6 | >6 |
| Occurrences jours | 0, 1, 3, 5 | >5 |
| Degrés-jours °C·j | 50, 150, 300, 600 | >600 |
| THI | 72, 75, 80, 85 | >85 |
| Humidité % | 20, 40, 60, 80 | >80 |
| Surfaces ha | 100, 1000, 10000, 100000 | >100000 |
| Rendement q/ha | 10, 30, 60, 90 | >90 |
| Production t | 1000, 10000, 100000, 1000000 | >1000000 |

Exemples : 80 mm sur 7 jours reste bleu soutenu quelle que soit la distribution ; +4 °C d’anomalie est chaud, −4 froid, zéro neutre. Les divisions THI au-dessus de 72 sont des classes éditoriales, pas de nouveaux niveaux zootechniques validés. Toute révision doit changer la version et les tests.

Le minimum météorologique prévu pour le gel utilise une palette froide inversée, avec bornes −10, −5, 0, 5 °C ; le bleu le plus intense correspond au froid le plus marqué. Les jours de gel conservent une palette bleue d’intensité croissante avec le nombre de jours. Les unités évitent toute confusion entre ces lectures.
