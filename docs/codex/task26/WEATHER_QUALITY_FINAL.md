# Task26D — qualité réelle des variables

Températures : méthodes conservées ; moyennes intégrées sur24h, Tmin/Tmax des échantillons[00UTC,00UTCsuivant), sans garantie d'extrêmes continus. Les unités, niveaux et pas sont vérifiés dans chaqueGRIB. Les valeurs NULL et leur provenance restent conservées.

## Humidité relative

Les champs MF natifs sont préférés ; aucune substitution silencieuse par une formule différente. Les caches contiennent133206échantillons au-dessus de100%, entre100,000275 et100,019300%. Parmi50champs concernés,31sont entièrement compatibles avec leur erreur d'encodageGRIB,19ne le sont pas ; le rapport maximal dépasse33fois cette erreur. Une tolérance globale ou un écrêtage à100% ne sont donc pas justifiés.

Comparaison réelle bornée avec le point de rosée du **même modèle, même run, même instant et même cellule** : seules deux petites lectures nouvelles deTd ont été nécessaires ;T/RH réutilisés depuis les caches. Quatre appels,3752octets au total, aucune modification nationale.

| Cas | RH native | T/Td K | Reconstruction Magnus eau |
|---|---:|---|---:|
|AROME7nov03UTC|100,006607%|281,812408/281,812408|100,000000%|
|ARPEGE8nov00UTC|100,004868%|275,653625/275,646973|99,952743%|

Cela démontre que certains dépassements ne reflètent pas un besoin de vraie RH>100 dans les variables reconstruites. Deux points ne valident pas une substitution nationale ; les conventions de phase, les formules fournisseur et les incertitudes d'encodage doivent être conservées. La reconstruction eau est explicitement exploratoire ; aucune correction universelle n'est adoptée. Les champs natifs et NULL restent disponibles pour une règle ultérieure indépendante, avec validation suffisante. Le futurTHI doit refuser une humidité absente et ne pas inventer une couverture nationale complète.

## Précipitations IFS

Les194PRA indisponibles le11novembre résultent de180cellules concernées par la différence120→144h. Les deuxGRIB sont bien des accumulations depuisH0 enmètres. Le changement d'échelle binaire−13→−12 produit exactement−0,1220703125mm, inférieur à la somme des erreurs d'encodage0,18310546875mm. La [FAQ officielleecCodes](https://confluence.ecmwf.int/spaces/UDOC/pages/208501579) décrit ce phénomène.

Cause documentée : quantification, sans preuve d'une pluie négative physique. **Aucune conversion automatique en zéro.** Une vraie accumulation faible positive reste compatible avec ces erreurs ; les données compressées ne permettent pas de restituer une valeur ponctuelle exacte. Les NULL portent cette limite. Une représentation par intervalle serait une méthode supplémentaire à qualifier, pas une correction exacte du champ.

## Validation permanente

Contrats stricts, unités et temporalité, matrices713PRA, limites physiques, NULL, contrôles indépendants natifs et comparaisons inter-modèles sont maintenus. La publication du06UTC dispose de24955comparaisons MF et24955IFS ; les différences entre modèles restent descriptives. Le vérificateur côte reproduit aussi les1426moyennes toutes aires depuis lesGRIB conservés.

Les archives immuables conservent plusieurs cycles pour accumuler ultérieurement les erreurs par PRA, variable et échéance lorsque des observations compatibles existent. Ni deux initialisations d'une journée, ni la comparaison de modèles ne constituent un score statistiqueJ+7. Les401 stationnels antérieurs ne sont pas requalifiés en succès ; aucune comparaison station/réanalyse récente sans date commune.
