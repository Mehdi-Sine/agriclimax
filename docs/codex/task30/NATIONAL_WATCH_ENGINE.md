# Moteur national 1.0.0

`features/national-watch/model.ts` consomme la sélection nationale vérifiée de `nationalWeatherDocument`, jamais le cycle pilote de secours de l’ancien endpoint météo. Les 713 identifiants et régions viennent du GeoJSON officiel déjà publié. Une lecture nationale, pas 713 appels réseau.

Fenêtre J+1 à J+7 du cycle. Chaque PRA/variable doit avoir toute la fenêtre exploitable. Les calculateurs `calculate` et le catalogue `RULES` sont réutilisés. Les segments source/run/nature sont évalués séparément : aucune séquence sèche ni THI ne franchit une rupture. Le maximum de ces séquences est une longueur dans un scénario homogène, pas une séquence multi-modèles continue.

Les événements regroupent les PRA qui franchissent le critère dans leur région officielle. Pas de moyenne nationale arithmétique. Dénominateur régional = PRA évaluables pour ce phénomène. Les productions RPG sont jointes par identifiant PRA ; les données SAA ne sont jamais redistribuées.

Classement éditorial lexicographique : intensité relative au seuil descriptif (gel : opposé du minimum), durée, nombre de PRA, identifiant stable. Cette convention exploratoire compare des grandeurs hétérogènes et n’est pas un score scientifique de risque. Aucun poids caché ni probabilité.

Chaque résultat transporte version de règle, fraîcheur source, empreintes d’archives et drapeaux. Les phrases sont des gabarits déterministes. Aucun modèle narratif externe.

Cache serveur borné à trois identités : empreinte du cycle publié, version du moteur, palette et RPG. Le manifeste existant est relu après 60 secondes ; le navigateur relit chaque minute et au retour du focus. Les échecs ne sont pas mis en cache. Pas de déploiement pour un nouveau cycle.

Limite V1 : l’historique ERA5-Land et ses anomalies restent dans Climat/Analyse ; la sélection automatique nationale porte sur la prévision publiée. Aucune anomalie inter-modèles n’est inventée. Les synthèses sont reproductibles à partir des archives conservées et du code versionné ; le cache local n’est pas un historique persistant de synthèses.
