# Moteur national 1.0.0

`features/national-watch/model.ts` consomme la sélection nationale vérifiée de `nationalWeatherDocument`, jamais le cycle pilote de secours de l’ancien endpoint météo. Les 713 identifiants et régions viennent du GeoJSON officiel déjà publié. Une lecture nationale, pas 713 appels réseau.

Fenêtre J+1 à J+7 du cycle. Chaque PRA/variable doit avoir toute la fenêtre exploitable. Les calculateurs `calculate` et le catalogue `RULES` sont réutilisés. Les segments source/run/nature sont évalués séparément : aucune séquence sèche ni THI ne franchit une rupture. Le maximum de ces séquences est une longueur dans un scénario homogène, pas une séquence multi-modèles continue.

Les événements regroupent les PRA qui franchissent le critère dans leur région officielle. Pas de moyenne nationale arithmétique. Dénominateur régional = PRA évaluables pour ce phénomène. Les productions RPG sont jointes par identifiant PRA ; les données SAA ne sont jamais redistribuées.

Classement éditorial lexicographique : intensité relative au seuil descriptif (gel : opposé du minimum), durée, nombre de PRA, identifiant stable. Cette convention exploratoire compare des grandeurs hétérogènes et n’est pas un score scientifique de risque. Aucun poids caché ni probabilité.

Chaque résultat transporte version de règle, fraîcheur source, empreintes d’archives et drapeaux. Les phrases sont des gabarits déterministes. Aucun modèle narratif externe.

Cache serveur borné à trois identités : empreinte du cycle publié, version du moteur, palette et RPG. Le manifeste existant est relu après 60 secondes ; le navigateur relit chaque minute et au retour du focus. Les échecs ne sont pas mis en cache. Pas de déploiement pour un nouveau cycle.

L’historique ERA5-Land et ses anomalies ont une lecture nationale distincte (voir ci-dessous) et se prolongent dans Climat/Analyse. Aucune anomalie inter-modèles n’est inventée. Les synthèses sont reproductibles à partir des archives conservées et du code versionné ; le cache local n’est pas un historique persistant de synthèses.

Extension de recette : `/api/veille?run=AAAA-MM-JJ` régénère une synthèse d’un cycle archivé vérifié, sans télécharger de nouvelles données brutes. L’identité utilise le SHA-256 de l’archive compressée effectivement vérifiée, ainsi que les versions de moteur, palette et RPG. Les preuves partagées sont dédupliquées dans `evidence` et chaque fait les référence par `evidence_id` ; aucune réserve scientifique supprimée.

La période « Dernière réanalyse et anomalies » active un second lecteur mutualisé, `/api/veille/historique`, indépendant des prévisions. La dernière date est découverte par le catalogue réel. Cartes température et précipitation, dénominateurs et écarts régionaux strictement >3 °C ou >10 mm en valeur absolue : conventions éditoriales explicites. Seules les références 30/30 années, couverture 100 %, et données natives complètes produisent une anomalie. Cache par date, empreinte d’archive et version de normale. Les reconstructions ne reçoivent aucune anomalie.

La route `/veille?cycle=AAAA-MM-JJ` permet de relire explicitement un cycle archivé, avec indication de son ancienneté et retour au dernier cycle publié. La projection légère `pra-watch-places.json` est vérifiée contre le GeoJSON officiel avec `python scripts/task30_watch_geography.py` ; elle évite une lecture serveur de 23 Mo et est tracée statiquement dans les fonctions Vercel.

Le délai d’identification d’un nouveau cycle combine la rétention du manifeste (60 s) et le rythme de relecture du navigateur (60 s), puis le réseau et le calcul. La réponse HTTP se revalide avec un ETag ; une identité inchangée n’est pas retransmise. Les états d’ancienneté restent calculés dans le navigateur à l’heure de consultation, même pour une synthèse réutilisée.
