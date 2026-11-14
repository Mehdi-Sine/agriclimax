# Intégration progressive proposée

## Livraison hors ligne

`multiproduction/agro03.ts` est un catalogue **séparé**, non importé par une
interface, un serveur de production ou un job. Le registre AGRO-02 actif et ses
versions restent identiques. La façade `computeAgro03` passe explicitement son
catalogue au moteur commun ; un appel existant à `computeBatch` conserve ses
défauts et ses résultats. Aucun drapeau activé par défaut ni nouveau workflow.

Les seuls ajouts au noyau sont `max`, `atLeast` et `longestAtLeast`. Ils servent
les seuils inclusifs ETCCDI sans détourner les anciens opérateurs stricts. Les
signaux portent bien `>=` ; unités, périodes, qualité et provenance utilisent le
contrat commun. Les identités de cache incluent version, formule et paramètres.
Les mêmes calculs restent partagés et immuables entre productions.

Les adaptateurs d'archives existants conviennent aux huit nouveautés, toutes
mono-variable et utilisant les quatre variables déjà disponibles. Ils ne sont
pas modifiés. L'injection de catalogue est optionnelle ; elle ne change ni les
entrées du moteur quotidien ni sa sélection de cartes.

## Cartes et fiches PRA : étape ultérieure à faire revoir

1. Rejouer des archives supplémentaires, notamment printemps, gel et fortes
   chaleurs, avec validation agronomique par production. Ne pas prétendre que la
   seule recette automnale couvre toutes ces saisons.
2. Sélectionner explicitement les recettes candidates et des palettes adaptées
   aux unités ; qualifier les supports avec CORE-01. Conserver les 713 contours,
   les portions observées et les motifs de nullité, cycles et fenêtres UTC.
3. Préparer des bundles indépendants versionnés avec paramètres et empreinte des
   entrées. Une recette à identifiant partagé entre plusieurs productions donne
   un seul champ météo, accompagné des différents contextes agricoles.
4. Contrôler références, légendes, seuils stricts/inclusifs et limites d'épisode.
   Aucun ancien bundle ou article n'est réécrit. L'explorateur et les fiches PRA
   devront recevoir les nouveaux identifiants par une PR d'interface séparée.

## EDIT-04 et Journal : étape ultérieure à faire revoir

`AGRONOMY[id]` prépare des faits de type `hazard_descriptor`, intérêt agricole,
productions potentiellement concernées, références, périodes contextuelles,
paramètres, réserves et contexte nécessaire. `causal_claims_allowed=false` et
`damage_threshold=null` empêchent toute assimilation prévue à une règle de dommage.
Ces champs documentent la limite ; ils ne remplacent pas une validation des
phrases générées. La production, le stade, la surface agricole et l'exposition
réels demeurent inconnus sans données complémentaires.

Une intégration devra sélectionner explicitement ce catalogue et étendre les
validateurs des faits/cartes, les références autorisées et les versions. Le
contributeur AGRO-02 reste volontairement lié à son ancien registre/version :
il n'est pas branché sur AGRO-03 et ne publie pas automatiquement ses résultats.
Les anciens lecteurs restent associés à leurs versions ; le classement EDIT-04
et les prompts actuels ne changent pas ici.

Pour le futur classement : regrouper les recettes proches (chaleur/jours/longueur,
jours secs/humides, bovins/groupe lait) et éviter le double comptage. Les scores
décrivent un contraste et une persistance météo, pas des pertes agricoles. Une
prévision reste une prévision ; une révision de cycle n'est pas une évolution
observée. Les portions non qualifiées sont exclues des chiffres territoriaux du
Journal. Aucun coût IA supplémentaire n'est créé par AGRO-03.

## Conservation, coûts et retrait

Pas de nouveau stockage quotidien dans cette PR : coût supplémentaire de collecte,
publication et stockage opérationnel **nul** tant que le catalogue reste hors
production. Le rejeu mesure séparément calcul, JSONL complet et gzip. Ne pas
persister les séries complètes pour chaque affectation production : partager les
résultats par PRA/recette/version/période/source/support, référencer les entrées
immuables et ne conserver que les fenêtres explicitement nécessaires.

Si une activation est proposée, fixer d'abord rétention, budget et stockage
dédupliqué, puis examiner une PR dédiée. Pour retirer cette livraison hors ligne,
cesser d'appeler `computeAgro03` ; le chemin par défaut n'a pas changé. Aucun
rollback d'archive, de base, d'acquisition ou de publication n'est nécessaire.
