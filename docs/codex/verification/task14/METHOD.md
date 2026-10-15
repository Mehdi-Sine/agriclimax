# Task 14 — méthode THI bovins

## Formule et référence consultée

Variante `bohmanova-2005-thi-26-v1` :

`THI = (1.8 T + 32) - (0.55 - 0.0055 RH) (1.8 T - 26)`.

T = température sèche de l'air en °C ; RH = humidité relative en %, indice sans
dimension. Source effectivement ouverte le 15 octobre 2026 : Bohmanova J.,
Misztal I., Tsuruta S., Norman H.D., Lawlor T.J. (2005),
[National Genetic Evaluation of Milk Yield for Heat Tolerance of United States Holsteins](https://www.ars.usda.gov/ARSUserFiles/80420530/Publications/Scientific/Conferences/2005/IB_33_160_BohmanovaEtAl.pdf),
p. 160, formule, unités et seuil supposé de 72. Cette étude porte sur les Holstein
américaines ; elle ne valide pas ce seuil pour tous les bovins ou élevages.
Le texte attribue cette formule à NOAA 1976 ; ce document historique n'a pas été
consulté directement et n'est pas revendiqué comme tel. Licence non établie.

La formule du starter Task 02 concorde : elle est réutilisée par le moteur Python.
La variante est identifiée explicitement pour permettre l'ajout d'autres formules
avec un nouvel identifiant, une implémentation, des sources et des tests propres.
Une variante employant 26,8 n'est pas substituée silencieusement à celle-ci.
Recherche bibliographique complémentaire : résultats JDS 2007 et revues PMC ;
texte intégral JDS refusé 403, MDPI 429, PMC protégé par captcha. Aucune de ces
pages inaccessibles n'est présentée comme référence intégralement consultée.

## Configuration scientifique et seuils

`config/cattle/thi-v1.json` : règle `cattle.thi.exposure`, version `1.0.0`, production
`cattle`, statut **exploratory**. Seuil 72, classe à borne inférieure incluse
`exposure_above_reference`, sinon `below_configured_reference`. Ce sont des noms
d'exposition, sans diagnostic ni classe de sévérité animale. Compteur strict `>` :
une valeur exactement au seuil n'est pas un dépassement. Le fichier précise
source, contexte, statut des paramètres et limites. On peut ajouter des seuils
croissants et des classes ordonnées ; tout changement scientifique exige une
nouvelle version. Pas de promotion automatique. `reviewed` correspond à
`expert_reviewed` du référentiel général ; `validated` exige le protocole approuvé.
Aucun résultat de cette livraison n'est qualifié reviewed ou validated.

Seuil nocturne 72 et nuit 22 h–6 h Europe/Paris : **conventions exploratoires du
produit**, pas un protocole physiologique validé ni une conclusion de l'étude.
Le cumul de dépassement est une somme descriptive, pas une dose biologique validée.

## Temps, agrégats, épisodes

Période interne UTC semi-ouverte ; dates du formulaire inclusives. Paire température/
humidité de même station, source, instant et résolution seulement. Aucune imputation.
Une humidité absente produit une valeur THI nulle et une raison explicite ; s'il n'y
a aucune paire utilisable, résultat `unavailable`, compteurs nuls au sens JSON null,
jamais zéro assimilé à absence d'exposition.

Horaire : THI par échantillon, moyenne et maximum quotidiens seulement avec 24
horaires UTC présents. Maximum global observé nommé comme tel. Les métriques h
comptent les échantillons horaires réguliers, sans preuve de persistance entre
instants. Les trous coupent les épisodes ; dépassements, cumul et durées partiels sont des
bornes inférieures, signalées `insufficient`. Le nombre d’épisodes est alors un
compte de fragments observés, pas une borne inférieure du nombre réel : un trou
peut scinder un même épisode. Ce ne sont pas des durées physiologiques.

Quotidien : `THI(TM,UM)` synthétique. Il ne vaut généralement pas moyenne(THI horaire)
à cause du terme d'interaction T×RH. Aucun maximum horaire n'est déduit de TX et UM.
Les métriques en jours et THI.jour sont des synthèses descriptives distinctes des
heures et THI.heure. Les fenêtres source quotidiennes ne sont pas harmonisées.

Dépassements stricts ; nombre d'épisodes = suites contiguës ; durée maximale = nombre
d'échantillons de la plus longue suite ; cumul = somme max(THI−seuil,0) × un pas.
Le mode web auto préfère une série horaire complète ; sinon synthèse quotidienne
avec flag. Le choix horaire explicite montre les trous. Task 11 ne conserve
actuellement que le dernier échantillon du jour, donc pas de série horaire complète
reconstituable depuis la persistance actuelle.

Nuit : regroupement local Europe/Paris, nuits de 7/8/9 heures selon changement
horaire, toutes les heures requises. Nuit sans récupération climatique si aucune
valeur ne passe strictement sous le seuil. Nuits tronquées/à trou exclues et comptées.
En quotidien, récupération indisponible. Cela ne décrit pas une récupération animale.

Anomalie THI : indisponible explicitement. L'extraction Task 12 fournit température
et pluie, sans RH ni distribution de THI homologue. Une anomalie de température ne
constitue pas une anomalie de THI. Pas de mélange station/grille, de soustraction
à une normale thermique ou de normale inventée.

## Portée et limites

Indicateur climatique d'exposition potentielle pour bovins ; présence des animaux
et sensibilité non mesurées. Points de station sans interpolation vers les élevages.
Race, âge, niveau de production, stade physiologique, bâtiment, ventilation,
ombrage, accès à l'eau, rayonnement, vent, microclimat ne sont pas pris en compte.
Ces limites accompagnent chaque résultat et chaque vue. Aucun conseil automatique,
aucun diagnostic zootechnique, vétérinaire ou clinique.

Confiance faible conservatrice, couverture et statut explicites ; fraîcheur source
séparée, provenance/checksums conservés, publication inconnue non inventée.
Les contrats V1 restent inchangés : ce résultat est un indicateur local du module,
pas un RiskResult agricole ni un WatchSignal clinique.
