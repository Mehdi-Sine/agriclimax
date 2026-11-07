# Règles et limites

| Phénomène | Critère descriptif | Valeur cartographiée |
|---|---|---|
| Chaleur | Tmax échantillonnée > 25 °C au moins un jour | maximum de la fenêtre |
| Gel | Tmin échantillonnée < 0 °C | minimum de la fenêtre |
| Pluie | profondeur quotidienne > 20 mm | maximum quotidien, pas cumul sur 7 jours |
| Sans pluie significative | au moins 3 jours consécutifs < 1 mm/j dans une source/run homogène | plus longue séquence homogène |
| THI bovin | synthèse quotidienne Bohmanova 2005 > 72 | maximum des synthèses quotidiennes |

Les seuils exploratoires reprennent le catalogue existant ; ils n’ont pas été validés comme seuils de dommages. La condition des trois jours est une convention de sélection éditoriale. THI : température et humidité de même origine et période, variante et seuil conservés depuis `config/cattle/thi-v1.json`.

États distincts : `detected`, `no_threshold_crossing`, `insufficient`, `unavailable`. Un cycle ancien est une qualification supplémentaire calculée au moment de consultation, même sur réponse en cache. Une fenêtre terminée n’est jamais présentée comme la semaine à venir.

La qualification littorale existante n’est pas corrigée implicitement. Les extrêmes sont échantillonnés ; aucun minimum de bourgeon ni maximum horaire THI. ERA5-Land, reconstruction Crozon 1.2.0, normales et supports partiels restent dans leurs parcours scientifiques existants.

Anomalies historiques : support natif complet, statut de référence disponible, 30/30 années et couverture de référence 100 % exigés. Une réserve de statut contradictoire bloque aussi l’anomalie. Les supports spatiaux incomplets sont hachurés, avec valeur absente conservée ; aucune portion manquante n’est extrapolée. Les reconstructions restent dans leurs fiches distinctes.
