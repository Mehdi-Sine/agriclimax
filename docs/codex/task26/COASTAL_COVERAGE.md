# Couverture littorale et Corse

Les poids utilisent chaque grille opérationnelle et la géométrie officielle complète. Aucun masque ERA5-Land n'est réutilisé pour AROME/ARPEGE/IFS. Aucun poids maritime n'est implicitement exclu ni renormalisé.

Deux mesures distinctes sont conservées :

- AROME/ARPEGE : fraction de poids des centres situés dans l'union du référentiel officiel. **Proxy géométrique**, pas un masque physique terre/mer : une terre étrangère hors référentiel peut aussi être exclue.
- IFS : fraction de terre pondérée du vrai champ natif LSM obtenu dans le même cycle. Elle qualifie le support sans corriger les valeurs météorologiques.

| PRA | AROME proxy territorial | ARPEGE proxy territorial | IFS fraction terre native |
|---|---|---|---|
|pra:29102|83.03%|0.00%|63.46%|
|pra:50081|94.41%|79.77%|37.28%|
|pra:06245|99.63%|98.77%|88.16%|
|pra:2A258|90.01%|56.02%|70.97%|
|pra:2B260|99.99%|99.87%|96.05%|

29102=Crozon ;50081=La Hague ;06245=littoral méditerranéen ;2A258=Corse littorale ;2B260=Corse montagneuse. Toutes les PRA portent les contrôles dans l'archive ; l'interface expose ceux de la PRA et du modèle sélectionnés. Les fractions de cette table ne sont pas directement interchangeables.

**NOT_READY pour une représentativité terrestre côtière validée.** ARPEGE Crozon a un proxy0% ; la fraction LSM IFS de La Hague est37,28%. Des valeurs numériques peuvent être présentes tout en restant exploratoires. Il manque un masque terrestre MF indépendant et une comparaison terrestre/stationnelle pour certifier la représentativité. Les NULL scientifiques restent NULL.

## Expérience ERA5-Land à90%

Lecture seule des480 tuiles déjà acquises du27 au30 octobre, sans réseau source ni écriture historique. 68PRA/jour ont un support partiel ou absent ;36PRA peuvent fournir une moyenne sur au moins90% de surface (144 résultats candidats sur quatre jours). La moyenne pondérée de l'aire observée est conservée séparément : aucune substitution aux valeurs existantes, ni extrema/anomalies/normales recalculés. Les journaliers réutilisés portent la validation amont des24 échantillons ; l'expérience ne distingue pas indépendamment masque statique et absence temporelle. Elle ne justifie donc pas une adoption automatique. Preuve complète : operational-evidence/task26c-era90-experiment.json.

Pour les32 autres PRA sous90%, aucune extrapolation ni remplacement ERA5 par une prévision n'est adopté : il faut une période commune et une évaluation séparée. Aucun calcul de normale à partir d'AROME.
