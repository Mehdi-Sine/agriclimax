# Audit de la sélection actuelle

Base de travail : `80aa4aa` (main, PR OPS-07 #87). La branche EDIT-03 est
créée directement sur ce commit, sans utilisation de la branche COUV-02.

## Quatre ensembles à distinguer

| Ensemble | Mécanisme actuel | Constat pour les deux dates |
|---|---|---|
| Cartes disponibles | Bundles immuables associés aux archives consultables | 10 par édition : 5 indicateurs × 2 natures |
| Cartes techniquement admissibles | `buildEditionMaps`, puis `verifyBundle` ; identité, empreintes, périodes, unités, règles et qualifications des lignes | Les 10 passent les contrôles ; réanalyse 645 PRA territoriales, 68 absentes ; prévision 713 PRA territoriales |
| Cartes réellement retenues/publiées | Publication du bundle entier, sans classement éditorial ; le manifeste immuable rend visibles toutes ses cartes | Les 10 sont publiées, dans l'ordre du constructeur |
| Cartes mises en avant | Le Journal monte `EditionMaps` avec `main`, sans `initialMapId` ; son état initial prend `view.maps[0]` | La première carte, `temperature_min` en réanalyse, est en une aux deux dates. Le sélecteur permet de consulter les 9 autres |

Les tableaux détaillés sont dans [la comparaison](evidence/COMPARISON.md).
Les identifiants, empreintes et chemins originaux sont conservés dans
[le manifeste des copies de preuves](../../../fixtures/editorial/edit03/manifest.json).

## Sélection technique et choix arbitraires

[`scripts/int01_map_builder.ts`](../../../scripts/int01_map_builder.ts)
contient la liste fixe `temperature_min`, `temperature_mean`, `rain`, `frost`,
`gdd`. Il crée d'abord le groupe historique de sept jours se terminant au
`history_cutoff`, puis une période prévisionnelle homogène définie par le code
existant. Il calcule les recettes existantes depuis les entrées déjà gelées.
Pour chaque indicateur il prend la première production rencontrée puis ses
résultats : ce champ désigne le calculateur d'origine, pas une exposition agricole.
Une carte est conservée si au moins une valeur territoriale ou partielle existe.

Cela crée un maximum implicite de cinq cartes par nature, sans quota régional,
seuil d'intérêt éditorial, comparaison des contenus ou pénalité de redondance.
Le choix de ces cinq indicateurs et leur ordre sont codés en dur. Le moteur
multiproduction décrit **20 recettes** ; leur existence ne prouve pas que
40 cartes archivées soient disponibles. EDIT-03 ne recalcule aucune autre recette
et classe uniquement les 10 payloads effectivement archivés de chaque date.

[`verifyBundle`](../../../apps/web/features/edition-maps/model.ts)
contrôle les empreintes du bundle et des cartes, la liaison édition/checksum,
les unités et titres des recettes, les dates, les 713 identités officielles et
les qualifications des valeurs non nulles. Une valeur sur portion observée reste
partielle ; elle ne peut pas devenir une valeur territoriale. L'éligibilité
`journal_eligible` est en outre exigée par le nouveau catalogue avant ses
statistiques et scores. La lecture du manifeste publié vérifie aussi les
octets, le checksum du blob et l'approbation cartographique existante.

[`publishMapBundle`](../../../apps/web/lib/server/edition-maps.ts)
publie la totalité du bundle par insertion immuable. EDIT-03 n'appelle pas cette
fonction. Il ne change ni son enveloppe, ni ses chemins, ni la visibilité publique.

## Un comité et une une aujourd'hui indépendants des dix cartes

Le comité IA actuel reçoit le briefing et des références d'illustrations
éventuelles, selon
[`prompt.ts`](../../../apps/web/features/editorial-ai/prompt.ts).
Les deux archives étudiées ont `draft.illustration_ids = []`. Le Journal affiche
malgré cela les dix cartes du compagnon cartographique opérationnel :
[`preview.tsx`](../../../apps/web/features/editorial-ai/preview.tsx) privilégie
`editionMaps`, puis
[`EditionMaps`](../../../apps/web/features/edition-maps/view.tsx) choisit
la première carte. Le comité n'a donc choisi ni ces dix cartes ni leur une.
La carte possède sa propre période, qui peut différer de celle des faits du texte.

La moyenne thermique et la somme thermique sont presque parfaitement corrélées
sur les PRA communes dans ces archives ; minimum thermique et nombre de jours de
gel décrivent des aspects proches. L'ancienne sélection n'arbitre pas ces
répétitions. Leur intérêt complémentaire reste une question éditoriale : la
corrélation seule ne démontre pas une équivalence scientifique.

## Dates et limites des preuves

- 12 novembre : réanalyse **30 octobre–5 novembre** ; prévision **13–14 novembre**.
- 13 novembre : réanalyse **31 octobre–6 novembre** ; prévision **14–15 novembre**.

Les historiques se chevauchent sur six jours. Les prévisions ont des validités et
cycles distincts. Le catalogue marque toutes les comparaisons du 13
`not_comparable` ; aucune différence entre ces cartes n'est présentée comme une
évolution observée. Le 12 n'a pas de précédent dans le périmètre autorisé.
La fraîcheur source, l'exploration scientifique, la représentativité côtière et
l'absence d'évaluation agronomique restent visibles dans chaque fiche.

Aucun audit d'acquisition, d'agrégation, d'ERA5-Land/SAFRAN/SIM ou de calcul des
indicateurs n'est entrepris ici. Les règles et snapshots existants sont réutilisés
en lecture ; leurs contrats et leurs résultats restent inchangés.
