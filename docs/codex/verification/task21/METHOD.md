# Méthode Task21

## Support et sémantique

Pilote unique : sélection maximin existante, 73/713 PRA (10,238 %), couvrant les
13 régions métropolitaines ; ce n'est pas un échantillon probabiliste. Référence
OFB/MASA et poids EPSG:3035 inchangés, vérifiés par les quatre SHA256 du bundle.
La surface considérée est toute la PRA, pas sa seule surface agricole.

Priorité aux données nationales réellement présentes : 19 septembre–18 octobre
2026. Références : chaque même jour calendrier des 30 années 1991–2020 et fenêtre
homologue complète de 30 jours. Le mois entier et l'année entière ne sont pas
inférés à partir de ces seuls jours. Extension annuelle nationale : 365 normales
quotidiennes, 12 normales mensuelles, une annuelle ; 29 février traité séparément.

Pour chaque maille ERA5-Land, température en K convertie en °C ; 24 échantillons
UTC requis pour Tmin, Tmax et moyenne horaire Tmean. Tmin/Tmax sont les extrema
des échantillons horaires, pas des extrema instantanés absolus. La Tmin d'une PRA
est la moyenne surfacique des Tmin de ses mailles, pas le minimum de toute la PRA
ni le minimum de la température moyenne spatiale.

Pour le produit **reanalysis-era5-land horaire standard CDS**, TP à 00 UTC le
lendemain représente le cumul des 24 h précédentes. Conversion m→mm, aucun cumul
des 24 champs déjà accumulés. Le 30 septembre utilise donc le 1er octobre, et le
18 octobre utilise le 19 octobre. Ne pas appliquer cette convention sans contrôle
à un autre produit (ARCO désaccumulé, prévisions ou statistiques quotidiennes).
La pluie du 31 décembre nécessite le 1er janvier suivant.

Toutes les mailles d'intersection doivent être valides, pour chaque variable et
jour. Pas de renormalisation sur la seule surface disponible. Pas de correction
altitudinale, interpolation, comblement, changement de masque ou de poids entre
années. Un jour incomplet rend sa période incomplète. Les très petites valeurs
négatives de pluie dues à l'encodage (-1e-6 mm à 0) sont bornées à 0 ; toute valeur
plus négative ou >3000 mm/j et température hors [-100,70] °C arrête le calcul.

## Normales et anomalies

Normale = moyenne arithmétique interannuelle, poids égal par année. Politique
conservatrice de cette version : les 30 années doivent être présentes, même
support et même jour/période, sinon normale NULL. Aucune médiane ou moyenne
tronquée substituée à une normale ; médiane/p10/p90 sont des statistiques
complémentaires. Pas de lissage saisonnier ni de suppression de tendance.
Les huit 29 février ne deviennent pas une normale quotidienne sur 30 ans.
Les mois/années homologues entiers conservent leur nombre réel de jours.

Températures d'une période : moyenne des moyennes journalières correspondant à
chaque variable (Tmin/Tmax/Tmean). Pluie : somme journalière, puis moyenne des
30 cumuls homologues. Sur support complet et poids fixes, ces opérations
linéaires commutent avec la moyenne surfacique ; elles ne justifient aucune
commutation pour des extrêmes, seuils ou séquences non linéaires.

Anomalie signée = actuelle − normale, en °C ou mm. L'actuel national est une
**réanalyse ERA5-Land**, jamais présenté comme une mesure de station. Une
comparaison à une station nécessiterait une qualification supplémentaire du
support et des biais ; elle n'est pas implicitement validée par ce pipeline.
Normale absente → anomalie NULL, statut missing_reference. Actuel absent →
anomalie NULL, statut missing_current. Zéro est une valeur réelle, pas un absent.

Percentiles p10/p50/p90 : interpolation Hyndman–Fan 7 ; rang actuel : ECDF
midrank de 30 années homologues, avec traitement des ex æquo. Ils restent
exploratoires, sans période de retour ni précision de queue inférée. Écart
relatif seulement pour un cumul de pluie sur plusieurs jours avec normale
strictement positive. Aucun pour les températures en °C, ni pour la pluie
quotidienne très intermittente. Aucun THI, ni référence humidité inventée.

## Provenance et reprise

Reçus immuables par requête : paramètres, job CDS, SHA256, taille, temps,
récupération UTC. NetCDF, cache des valeurs historiques PRA et exports restent
sous work/task21, hors Postgres et Supabase Storage. Le support, la version
scientifique, les unités, la fraîcheur et les drapeaux qualité accompagnent les
résultats ; la provenance de lot évite sa duplication dans chaque ligne SQL.

Aucun verdict de disponibilité nationale ne découle d'une tâche seulement
soumise à CDS. La validation des 30 années, des limites physiques, du support,
des valeurs NULL et du budget précède la décision finale.
