# Visualisations réelles et performances

## Carte nationale régionale

Données : `JournalEdition.regional_sections[].coverage`, phénomène de `main_story`. Ratio = PRA franchissant le critère / PRA évaluables dans la région. Ce ratio n’est ni une moyenne météorologique ni une surface agricole affectée. Aucun appel scientifique supplémentaire ni modification du contrat.

Contours : `public/maps/agriculture-region.geojson` existant (environ 820 Ko), transformé par `python docs/codex/task32/generate-map.py`, exécuté depuis la racine. Projection linéaire locale avec correction du rapport longitude/latitude pour la France ; métropole et Corse. Simplification Douglas–Peucker à 0,45 unité SVG (inférieure au pixel à la taille habituelle), quantification à 0,1 unité. Les valeurs et dénominateurs ne sont jamais simplifiés. Artefact dérivé `ui/region-paths.json`, environ 52 Ko ; aucune géométrie PRA de 23 Mo.

SVG côté serveur, aucun téléchargement GeoJSON et aucun moteur MapLibre sur ce parcours. Palette gel/pluie bleue, déficit de pluie sèche, chaleur/THI chaude ; gris sans dénominateur, hachures si évaluable < total. Classes de proportion arrondie : 0, 1–25, 26–50, 51–75, 76–100 %. Ce sont des classes éditoriales de couverture du phénomène, pas les classes d’intensité du catalogue T30. Descriptions accessibles et tableau graphique donnent les valeurs exactes.

## Comparaison régionale

Barres HTML/CSS accessibles avec libellés et valeurs textuelles. Pour les treize régions : numérateur, dénominateur, pourcentage arrondi et couverture évaluable/total. Tri par proportion, sans score inter-phénomènes. Données manquantes distinctes du zéro. Liens vers la veille régionale.

`regionalRows` et `proportion` isolent la préparation de présentation. Un futur graphique temporel devra recevoir une série qualifiée de T33 ; aucune série comparable n’est disponible dans le contrat actuel. Aucun tracé temporel simulé.

## Coût

Aucune dépendance graphique ajoutée, aucun client component spécifique au Journal. Rendu serveur du titre et du SVG, données issues du lecteur déjà mis en cache. Budget global build initial : 632 286 octets gzip JS/CSS (limite 2 097 152). Les mesures navigateur et tailles réelles sont dans `evidence/*/report.json`. Le SVG ajoute du HTML ; il n’est pas un ajout de JavaScript client. La génération de contours est hors chemin de requête.

Mesure finale sur build de production : 190 408 octets JS compressés effectivement reçus par navigateur, FCP 124–220 ms selon format et LCP 1 144–1 460 ms, sans bridage. Aucun GeoJSON téléchargé. Ces observations locales ne remplacent pas des mesures terrain. Voir le tableau de recette. Les données cartographiques d’origine et leurs attributions restent documentées dans `apps/web/public/maps/README.md`.
