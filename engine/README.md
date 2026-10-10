# Moteur scientifique — Task 02

Les fonctions pures `science.py` et `indicators.py` calculent GDD quotidien (moyenne
Tmin/Tmax, plancher zéro, sans plafond), comptes strictement au-dessus/en-dessous,
durée sur intervalles réguliers explicites, plus longue séquence de jours contigus,
pluie, P-ET0, percentile interpolé linéairement et anomalie par rapport à une moyenne
fournie. THI conserve la formule Celsius du starter, sans seuil d'interprétation.
Unités : °C, mm, %, d, h, degree_day, index selon l'indicateur.

`WeatherDay`, `PhenologyStage`, `Window` et `IndicatorValue` représentent les entrées
et résultats internes. Les fenêtres sont inclusives, absolues ou relatives à une
date de stade fournie. Aucun stade biologique n'est inféré. Les trous interrompent
les séquences ; les valeurs non finies, Tmin > Tmax, humidité hors [0,100] et profondeurs
négatives sont rejetés. Les séries horaires doivent être normalisées et leur couverture
vérifiée par l'appelant ; la durée d'échantillon est obligatoire.

`load_rule(Path(...))` charge strictement la règle YAML fictive existante.
`evaluate_heat(rule, weather, cell_id=..., valid_date=..., source=DataSource(...),
freshness='fresh', window=...)` applique cette règle sans modifier ses paramètres.
La fenêtre par défaut est celle définie par `window_days`. `Classes` fournit un
évaluateur générique de seuils croissants, bornes inférieures incluses.
Les résultats sont sérialisables via `model_dump(mode='json')` et conformes au
contrat gelé RiskResultV1. La version exacte, source et résolution, couverture,
imputation, fenêtre et fraîcheur accompagnent chaque résultat.

Missing/invalid/duplicate/deprecated rendent le risque indisponible ; stale/unknown
conservent la valeur avec un flag explicite. La confiance reste conservatrice `low`
avec `no_validated_confidence_policy` : aucune politique scientifique de confiance
n'est inventée. Exposure et sensitivity restent absents (`null`) pour cette règle
fictive, qui classe uniquement le compte de jours chauds. Aucun produit universel
hazard × exposure × sensitivity n'est appliqué.

Limites : seule la règle `tmax_days_above` possède un adaptateur de configuration
exécutable dans le starter. Les autres primitives exigent leurs paramètres explicites
et n'ont pas de classification agronomique ajoutée. Le YAML existant n'a ni sources,
ni valid_from, ni unit_contract/spatial_scope/temporal_scope ; il reste un exemple
exploratory et ne peut être présenté comme une règle de production gouvernée.
Une extension future devra définir ces métadonnées et ses méthodes avec les owners.
Pas d'ingestion, climatologie externe, calcul d'exposition ni persistance ici.

Vérification : `.venv/bin/python -m pytest engine/tests` ; voir
`../docs/codex/verification/task02/` pour le bilan et le résumé PR.
