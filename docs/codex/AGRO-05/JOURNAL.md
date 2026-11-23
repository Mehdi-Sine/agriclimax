# Simulation pour le comité éditorial

**Prévisualisation éditoriale indépendante** sur la réanalyse du 10 au 16 novembre 2026 UTC. Les changements ci-dessous comparent les mêmes 645 PRA à la semaine du 3 au 9 novembre. La couverture commune représente 645 des 713 PRA du référentiel. Les 67 résultats sur portion de PRA et la PRA sans valeur native sont exclus de tous les chiffres cités. [Cinq synthèses de novembre, plus deux rejeux d’octobre](evidence/syntheses.json)

## Proposition d’ouverture

**Pluies concentrées dans le Sud-Est.** Du 10 au 16 novembre, le plus fort cumul sur cinq jours a atteint **78,2 mm dans les Alpes niçoises**. Les trois PRA au-dessus de 70 mm pour cet indicateur se situent en Provence-Alpes-Côte d’Azur. Les céréales et les fourrages figurent dans le RPG 2025 des Alpes niçoises. Ce signal invite à vérifier les conditions de ressuyage à la parcelle lorsque des travaux sont envisagés. La portance et l’état des cultures restent inconnus. [Carte du pic de pluie](evidence/browser/1440-field_peak_rain5.png)

## Éléments à retenir selon l’angle du Journal

| Indicateur | Fait sélectionnable | Décision éditoriale simulée |
| --- | --- | --- |
| Pic de pluie sur cinq jours | Maximum de 78,2 mm dans les Alpes niçoises. Écart médian apparié de +18,0 mm sur 645 PRA. | Retenir pour la concentration des pluies et la localisation. |
| Pluie reçue avant une intervention | 10 PRA dépassent 70 mm sur sept jours, dont 9 en Provence-Alpes-Côte d’Azur. Maximum de 84,4 mm dans les Alpes niçoises. Écart médian de +26,8 mm. | Disponible en complément si la date d’intervention donne du sens au cumul. Éviter deux titres sur le même épisode. |
| Séquence sans pluie significative | 35 PRA ont reçu au moins 1 mm chaque jour. La plus longue séquence atteint 4 jours, notamment dans le Valois et l’Argonne. Écart médian de −2 jours. | Retenir comme contraste avec la fenêtre précédente. Les réserves des sols restent inconnues. |
| Gel sur la fenêtre | 418 PRA avec zéro jour de gel au seuil choisi. Sept jours avec Tmin négatif dans plusieurs PRA de montagne dont la Maurienne. Écart médian de 0 jour. | Réserve pour le comité. Le calendrier de novembre et les stades renseignés ne justifient pas un sujet sur des dommages aux cultures. |
| Chaleur accumulée pour le maïs | Jusqu’à 64,4 °C·j dans les Pays de Gosse, où le maïs est déclaré au RPG 2025. Écart médian de +13,5 °C·j. | Réserve hors fenêtre de développement renseignée. La valeur reste consultable dans la carte et l’export des faits. |

## Export et abstentions

Le lien **Exporter la synthèse pour le Journal (JSON)** se trouve sous la carte. L’export transporte les classes et comptes nationaux et régionaux, le nombre de PRA évaluables, les extrema et leurs ex æquo, trois territoires au plus par extrême, les productions déclarées documentées pour ces territoires, et la provenance des faits. Au niveau national, deux valeurs au plus bornent la fraîcheur des données admises. Un extrême uniforme ne désigne aucun territoire remarquable. Les classes cartographiques facilitent la lecture et les PRA ont toutes le même poids dans les effectifs.

Avec `compare=previous`, l’export calcule la médiane des écarts sur les seules PRA admissibles dans les deux fenêtres de même durée, contiguës et issues de la même série, avec support identique. Une absence de comparaison ou de référence homologue porte un motif explicite. Les normales du module Climat ne sont pas transférées à ces recettes et aucun écart n’est présenté en fréquence de retour ou en impact. [Contrat JSON](../../../contracts/jsonschema/agro-field-summary-1.schema.json)

Cette simulation utilise les sorties calculées et une sélection manuelle. Elle ne déclenche ni préparation nocturne, ni appel à un modèle de langage, ni publication.
