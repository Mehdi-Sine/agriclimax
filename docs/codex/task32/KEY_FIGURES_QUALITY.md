# Chiffres de une : contrôle et représentativité

## Politique de sélection

La présentation parcourt le sujet principal puis les éclairages déjà choisis par le moteur éditorial ; elle privilégie une diversité de phénomènes sans créer de score de risque. Jusqu’à trois chiffres peuvent être publiés, moins si les preuves manquent. Le grand chiffre est désormais un **nombre de PRA concernées / nombre de PRA évaluables** dans une région, jamais une proportion de surface ou une moyenne météorologique.

`selectKeyFigures` confronte chaque candidat aux résultats de `nationalWatch` du même cycle : archive source, période, phénomène, région, unité canonique `PHENOMENA`, valeur originale du fait, règle, provenance, réserves, fraîcheur, identité des PRA, numérateur et dénominateur. Les supports évalués doivent transporter une provenance et une source ainsi qu’une version de règle cohérente ; aucune fenêtre incomplète ou support spatial partiel n’est implicitement réintégré.

Les gardes de présentation rejettent les valeurs non finies, les incompatibilités et les flags d’invalidité physique. Vérifications de cohérence issues de la normalisation existante : température non inférieure au zéro absolu, pluie non négative ; la séquence reste entière et bornée par les journées de la fenêtre. Aucun seuil de dommage, aucune correction climatique et aucun seuil statistique d’outlier n’est ajouté. Un chiffre incohérent ne produit pas une estimation corrigée : le candidat est écarté et un autre fait qualifié peut prendre sa place.

Une valeur correctement calculée peut rester localisée, et une valeur disponible peut manquer de représentativité pour une une. Les grands blocs n’affichent donc plus automatiquement un extrême. Les faits d’origine et les valeurs physiques de la carte restent accessibles sans altération.

## Audit réel du 7 novembre 2026, période du 8 au 14 novembre

| Extrême d’origine | Support retrouvé | Décision éditoriale |
| --- | --- | --- |
| −19,80065002441404 °C (−19,8 affiché) | GRANDES ALPES - 74, Auvergne-Rhône-Alpes | Valeur retrouvée à l’identique dans le minimum quotidien sélectionné. Retirée du grand chiffre parce qu’il s’agit d’un extrême localisé ; 85 / 112 PRA évaluables privilégié. |
| 98,34531260101946 mm sur une journée (98,3 affiché) | MAURES ET ESTEREL - 83, Provence-Alpes-Côte d’Azur | Maximum quotidien réel, pas cumul de sept jours ni moyenne régionale. Retiré du grand chiffre pour sa localisation ; 35 / 35 PRA évaluables privilégié. |
| 4 jours sans pluie significative | Plusieurs PRA normandes, notamment BESSIN - 14 et PAYS D AUGE - 14 | Longueur maximale du calcul homogène, pas durée uniforme de la région. Conservée dans les faits et sur la carte du thème sec ; la une privilégie 17 / 36 PRA évaluables. |

Les sept journées des supports cités sont prévisionnelles, disponibles et de couverture spatiale ≥ 0,9999 et temporelle = 1 dans les entrées sélectionnées. Les extrêmes thermiques sont échantillonnés, pas des minima continus garantis. Les limites de représentativité terrestre/littorale et de masque de sol restent celles des sources. La présence d’un flag exploratoire n’est jamais convertie en validation agronomique.

Aucune altitude chiffrée n’est fournie par ce contrat. Le nom officiel « GRANDES ALPES » identifie le territoire, mais ne justifie pas d’inventer une altitude, une exposition ou une température de parcelle. Aucune reconstruction nouvelle n’est effectuée. Les drapeaux sources sont conservés dans `evidence/task32b/real-audit.json` pour chacun des supports et chacune des journées.

## Cycles comparés et limites

Audit sur 7 novembre 00 h, 6 novembre 00 h et 6 novembre 06 h UTC. Le minimum dans GRANDES ALPES passe respectivement de −19,8 à −20,4 et −19,9 °C selon le cycle ; les fenêtres diffèrent et ne forment pas une tendance observée. Les pluies et les supports des séquences sèches sont également relus dans leur propre archive.

Les compteurs héritent des critères exploratoires et des règles d’évaluabilité du moteur existant ; ils ne constituent pas une validation indépendante de toute la chaîne météo. Les trois grands blocs sont une aide à la lecture, pas une mesure de dommage. Si l’archive de contrôle n’est plus accessible, aucun chiffre de remplacement n’est fabriqué.
