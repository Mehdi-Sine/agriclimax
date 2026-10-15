# Gouvernance scientifique

## Statuts de validation
- `exploratory` : hypothèse/paramètre pour exploration ou démonstration.
- `documented` : appuyé par une ou plusieurs références identifiables.
- `expert_reviewed` : revu par expert métier identifié.
- `validated` : protocole de validation défini et approuvé pour l'usage ciblé.
- `deprecated` : ne plus utiliser pour nouveaux calculs.

Un statut n'est jamais inféré automatiquement.

## Versionner chaque règle
Chaque `RiskRule` possède `rule_id`, `version`, `valid_from`, `status`, `sources`, `parameters`, `unit_contract`, `spatial_scope`, `temporal_scope`.

Un résultat persiste la version exacte utilisée.

## Modèle conceptuel
- **Hazard** : phénomène climatique calculé/observé.
- **Exposure** : production concernée dans la zone/période.
- **Sensitivity** : sensibilité biologique/contextuelle, souvent dépendante du stade.
- **Risk** : classification dérivée d'une règle documentée.
- **Confidence** : confiance dans l'interprétation au regard des données et du statut scientifique.

Ne pas appliquer automatiquement `risk = hazard × exposure × sensitivity` comme une formule universelle. La composition dépend de la règle et doit être explicite.

## Qualité des données
Résultat accompagné au minimum de : couverture, fraîcheur, résolution source, données imputées éventuelles, flags qualité.

## Sources
Chaque seuil/paramètre scientifique significatif renvoie à une entrée `sources` avec DOI/URL/titre/auteurs/année/licence si connue.

## Extension locale bovins (Task 14)

Le module d'exposition `cattle.thi.exposure` utilise le vocabulaire demandé
`exploratory` / `reviewed` / `validated` dans sa configuration dédiée. `reviewed`
correspond au niveau `expert_reviewed` du référentiel général : expert identifié,
compte rendu de revue et périmètre explicités. Les contrats V1 restent inchangés.
Le statut documenté d'une référence ne promeut pas une règle automatiquement.
Aucune configuration livrée Task 14 n'est reviewed ou validated.

Chaque changement de formule, seuil, classe ou convention de nuit exige une
nouvelle version de configuration et un historique explicatif. La promotion vers
reviewed demande une revue experte tracée ; vers validated, un protocole approuvé
pour un contexte bovin précis. La confiance décrit données et validation ; elle
ne représente jamais l'intensité de l'exposition. Ni THI ni classe climatique ne
suffisent pour qualifier un animal, sa santé, une perte de production ou une
mesure zootechnique.
