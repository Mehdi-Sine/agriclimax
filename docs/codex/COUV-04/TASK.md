# COUV-04 — Couverture cartographique exhaustive des 713 PRA, toutes sources et tous indicateurs

## Objectif produit non négociable

Aucune petite région agricole (PRA) ne doit disparaître d'une carte Climacta à cause d'une couverture climatique incomplète.

Cette règle concerne toutes les cartes :
- Historiques.
- Prévisionnelles.
- Climatiques.
- Agroclimatiques.
- Présentes et futures, y compris les indicateurs AGRO-03.

Les 713 PRA, dont les six corses, doivent toujours être représentées.

## 1. Définir une règle commune de couverture

Pour chaque PRA, indicateur, source et période :

**Couverture qualifiée ≥90 % :**
- Colorer la PRA entière selon la valeur calculée.
- Conserver les métadonnées de couverture réelle.

**Couverture partielle inférieure à 90 % :**
- Ne jamais supprimer la PRA.
- Colorer uniquement les surfaces géographiques réellement couvertes par les données qualifiées.
- Afficher le complément non couvert en gris clair.
- Conserver le contour complet de la PRA.
- Indiquer que la valeur concerne uniquement la zone couverte.

**Absence totale de données exploitables :**
- Afficher la PRA entière en gris clair.
- Indiquer « Données indisponibles ».

Le seuil de 90 % ne doit jamais être utilisé comme critère d'exclusion du rendu cartographique.

## 2. Historique : ERA5-Land et SAFRAN/SIM

- Préserver ERA5-Land comme source principale.
- Utiliser SAFRAN/SIM sur les PRA où ERA5 est insuffisant, uniquement pour les variables et dates scientifiquement qualifiées.
- Vérifier que les 32 PRA ciblées sont réellement couvertes par SIM sur les périodes disponibles.
- Ne pas supposer que SIM fournit Tmin, Tmax ou les autres variables non qualifiées.
- Pour ces variables, afficher la couverture partielle ERA5 disponible.
- Ne jamais inventer une valeur pour la surface manquante.
- Documenter les provenances et les changements de source.

Automatiser la persistance et la reprise des données SIM dans le bucket Supabase existant, sans infrastructure supplémentaire.

Ne pas confondre disponibilité de la source à J-2 et disponibilité à J-1.

## 3. Prévisions : AROME, ARPEGE, IFS

Appliquer exactement la même règle de rendu spatial.

Pour chaque modèle, période et indicateur :
- Identifier les surfaces effectivement qualifiées.
- Colorer les PRA entières si la couverture atteint 90 %.
- Dessiner les surfaces partielles si la couverture est inférieure.
- Afficher en gris les surfaces sans données.
- Préserver les limites de validité temporelle et spatiale.

Ne pas utiliser SAFRAN/SIM historique pour compléter artificiellement une prévision.

## 4. Tous les indicateurs agroclimatiques

Auditer les indicateurs actifs et les nouveaux indicateurs AGRO-03.

Pour les indicateurs multivariables ou calculés sur plusieurs journées :
- Déterminer le support spatial et temporel commun réellement qualifié.
- Ne pas extrapoler une valeur calculée sur une partie de PRA à l'ensemble de celle-ci.
- Ne pas confondre indisponibilité d'une variable et absence de phénomène.
- Conserver les unités, seuils et limites scientifiques existants.

## 5. Un moteur cartographique unique

Implémenter une règle réutilisable par :
- Explorer le climat.
- Cartes du jour.
- Cartes agroclimatiques.
- Miniatures et carrousel du Journal.
- Futures cartes thématiques.

Conserver les palettes scientifiques existantes et des contours PRA uniformes, y compris sur le littoral.

Les zones partielles doivent être visuellement compréhensibles, sans liseré excessivement épais.

## 6. Validation exhaustive

Construire une matrice de validation couvrant :
- 713 PRA.
- Toutes les cartes et tous les indicateurs disponibles.
- Toutes les familles de sources.
- Plusieurs périodes historiques et prévisionnelles.
- Les cas de couverture complète, partielle et absente.

Vérifier notamment les PRA littorales de Bretagne, Normandie, Atlantique, Méditerranée et Corse.

Produire une comparaison visuelle avant/après sur des cartes représentatives.

Critères d'acceptation :
1. 713 contours visibles sur chaque carte.
2. Aucune PRA masquée du seul fait d'une couverture inférieure à 90 %.
3. Aucun remplissage artificiel des zones sans données.
4. Correspondance exacte entre valeurs, périodes, sources et surfaces colorées.
5. Aucune régression des indicateurs existants.
6. Journal et collecte quotidienne préservés.

## 7. Déploiement progressif

Séparer :
- L'automatisation de la collecte et du stockage SIM.
- La qualification des données.
- L'activation du nouveau rendu cartographique.

Prévoir des mécanismes simples de retour arrière.

Ne pas modifier les archives historiques déjà publiées sans décision explicite.

## Livrable

Créer une PR draft COUV-04 avec :
- Audit de couverture de toutes les familles de cartes.
- Implémentation du contrat cartographique commun.
- Persistance SIM automatisée et reprise vérifiée.
- Matrice exhaustive des 713 PRA.
- Comparaisons visuelles avant/après.
- Tests et coûts mesurés.
- Liste explicite des limitations scientifiques restantes.
- Recommandation GO / PARTIAL / NO-GO pour l'activation en production.

Ne pas fusionner ni activer automatiquement.