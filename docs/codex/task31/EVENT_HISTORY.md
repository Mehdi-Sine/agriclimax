# Histoire, comparabilité et épisodes

Inventaire réel dans `evidence/archive-inventory.json` : trois cycles météo nationaux (6 novembre 2026 à 00/06 UTC, 7 novembre à 00 UTC) ; cinq objets ERA5-Land couvrant le 19 octobre au 1 novembre. Le catalogue peut évoluer ; cet inventaire décrit seulement la recette.

Les cycles J+1/J+7 ont des fenêtres décalées. Ils ne démontrent ni aggravation observée ni persistance climatique. Le journal expose donc `insufficient_history` aux horizons 3, 7, 14, 30 jours dans ses événements prévisionnels. Il n'acquiert aucune donnée pour combler ces horizons. Les références historiques existantes sont réutilisables dans la veille ; leur disponibilité n'établit pas automatiquement la disponibilité de snapshots d'épisodes qualifiés.

## Comparateur pur `history.ts`

Nature explicite : `forecast`, `reanalysis`, `observation`. Refus de mélange des natures, sources, modèles, versions, unités, supports évaluables, identités d'épisode ; valeurs finies, dates valides, couvertures complètes et horizon exact exigés.

Pour une prévision : fenêtres absolues strictement identiques. Le résultat éventuel est une révision de prévisions, jamais une évolution observée. Pour observation/réanalyse : fenêtres de durée identique décalées exactement de l'horizon. Une comparaison d'anomalies nécessitera en plus un adaptateur imposant une même référence climatologique ; aucun tel calcul n'est publié ici.

Sur support comparable : apparition/disparition selon franchissement, extension seulement par inclusion des PRA précédentes, atténuation par réduction ou baisse de magnitude, intensification à support constant, maintien à support et magnitude constants. Un déplacement ou des supports disjoints retourne `unknown`. L'adaptateur doit fournir une magnitude croissante avec l'intensité du phénomène (par exemple opposé de Tmin pour le gel), pas la valeur brute de toutes les variables.

`episode_id` est une entrée de confiance de l'adaptateur scientifique : il doit être établi par une série continue, même critère et continuité spatiale démontrée. Deux extrémités seules ne suffisent pas à établir une persistance. Le moteur prévisionnel actuel ne fournit pas cet historique et ne déclare donc pas de maintien. Les tests synthétiques emploient explicitement un épisode documenté par leur fixture.

## Identités

L'identité de lecture d'un événement dépend du SHA d'archive, du phénomène/région/fenêtre et de la version de règle. Elle résiste à un recalcul identique. Elle ne prétend pas être l'identité d'un épisode traversant des fenêtres différentes. Une nouvelle lecture n'est jamais classée `appearance` en l'absence de comparaison compatible.

## Suite

Construire un adaptateur de snapshots historiques natifs, contrôler les références et supports côtiers par date, démontrer la continuité des épisodes, puis fournir ces snapshots au comparateur. Conserver les reconstructions distinctes et exclure toute anomalie non qualifiée. Cette extension est un prérequis pour des titres de tendance en Task32 ; la fondation ne la simule pas.
