# Continuité des prévisions

Archive réelle vérifiée : cycle 07/11/2026 00UTC,
`f6ea69aa15b7dffc1e5c19156bd2dcd3c39f0f6e1c2740c16cb68b87747760e3`.
49 910 lignes candidates ; les 32 085 indices opérationnels sont laissés intacts.

## Option A — candidat homogène démontré techniquement

Les lignes IFS déjà archivées couvrent les 713 PRA du 08 au 14/11 pour Tmoy,
Tmin échantillonnée, Tmax échantillonnée et pluie : **19 964 lignes** compatibles
sur modèle, initialisation, grille, poids, règle, unité et journée UTC. L'adaptateur
opt-in `homogeneous_indices` permet de les sélectionner en refusant les doublons,
valeurs absentes/non finies, supports incomplets, changements de run ou de grille.
Il ne change aucune valeur, aucun flag et aucune sélection existante.

L'humidité n'atteint pas cette complétude : 3 349 lignes IFS disponibles sur
4 991 PRA-jours, les autres partielles ou indisponibles. Elle est exclue du candidat
hebdomadaire ; un futur THI ne doit pas la compléter depuis un autre modèle.

Compatibilité de métadonnées ne signifie pas qualité scientifique acquise. IFS
utilise ici une grille de 0,25°, non masquée terre, des pas de 3 h puis 6 h, des
extrema échantillonnés et une fraîcheur non évaluée. Ces limitations persistent.
La sélection homogène démontre une piste de correction de continuité, pas une
qualification de la représentativité terrestre ou des événements thermiques.

## Options B et C

La sélection actuelle utilise AROME J+1, ARPEGE J+2/J+3, puis IFS. Aucune
calibration multi-modèles indépendante n'existe dans ces preuves : B est refusée.
C reste la politique opérationnelle : journées et segments homogènes, sans
fabriquer une semaine intégrée. L'option A reste expérimentale et distincte.

## Littoral

Les contrôles Task26 restent pertinents : proxy territorial ARPEGE nul à Crozon,
fraction LSM IFS de La Hague ~37,28 %, contre ~63,46 % à Crozon et ~70,97 % sur
2A258 dans les preuves antérieures. Ces fractions ne sont pas des taux de présence
numérique ni des observations indépendantes. Le blob actuel et ses flags sont
préservés ; cette tâche ne prétend pas avoir revalidé les masques à chaque cycle.

Avant publication d'intégrés IFS : contrôle du champ terrestre du même cycle,
validation des petits territoires et du changement de pas d'échantillonnage,
comparaisons indépendantes, et version métier acceptant explicitement cette
sémantique. Les règles d'indisponibilité actuelles restent en vigueur.
