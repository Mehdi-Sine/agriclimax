# AGRO-02 — architecture scientifique d’AgriclimaX

## Frontières et version

Base : `f1fddf2`, dernier `origin/main` après fusion de #75 (OPS-02).
Branche : `codex/AGRO-02-multiproduction-indicators`.
Contrat : `multiproduction-descriptive-1.0.0`.

Les seules responsabilités étendues sont le catalogue scientifique, la réduction
météorologique commune (opérateur minimum), un service de calcul par lot, des
adaptateurs d’archives en lecture et des contributions éditoriales préparées.
Aucun composant graphique, endpoint existant, registre du Journal, prompt,
workflow, ordonnanceur, acquisition, secret ou schéma de base n’est modifié.

## Audit des voies existantes

| Voie | État et décision |
|---|---|
| `agroclimatic/calculate.ts` | Noyau déterministe de sommes, moyennes, seuils stricts, GDD, séquences, THI. Réutilisé ; ajout de `min`, sans changement des anciens opérateurs. |
| `agroclimatic/catalogue.ts` | Dix descripteurs blé et quatre bovins. Catalogue historique conservé, pour éviter l’apparition prématurée des nouvelles productions dans les interfaces et le Journal. |
| `agroclimatic/observed-support.ts` | Voies historiques 1.1/1.2 reproductibles ; leur ancien seuil de 90 % ne constitue pas un certificat CORE-01. Non réutilisé comme autorisation d’extrapolation. |
| `wheat/qualified.ts`, `coverage.ts` | AGRO-01 distingue les dix descripteurs nationaux, les anciennes API et les supports. Contrôles physiques conservés dans la nouvelle façade. |
| `climate-quality/calculate.ts`, `policy.ts` | Contrat CORE-01 utilisé pour toutes les productions ; fraction, surface renseignée si connue, masque, méthode, temporalité, admissibilité Journal et valeur sur support observé séparés. |
| `cattle/thi.ts`, moteur Python bovin | Même formule Bohmanova 2005, variante 26, que le noyau commun. Les calculs horaires/station, récupération nocturne et classes animales restent distincts du THI synthétique journalier. |
| `engine/src/agriclimax/wheat` | Portefeuille station Météo-France avec références station/grille, paramètres et minima de durée spécifiques. Pas un doublon interchangeable du portefeuille national PRA ; aucune réécriture. |
| `engine/src/agriclimax/climate`, `territories`, ingestion | Préparation spatiale, références et acquisition existantes réutilisées par leurs archives vérifiées. Aucune nouvelle réduction géographique. |
| `journal/registry.ts` | Contrats `Contributor` / `Contribution` / `IndicatorFact` réutilisés par import de types ; registre actif laissé inchangé. |
| `editorial/temporal.ts` | Comparateur T33 réutilisé ; adaptateur des journées pour ses épisodes et leurs bornes censurées. |

Les anomalies et normales station/grille, stades, dommages, rendement, bilan
hydrique, pousse de l’herbe et effets zootechniques ne sont pas des mesures
nationales nouvelles de cette livraison. Aucun modèle interprétatif n’est validé.

## Catalogue déclaratif

`features/multiproduction/registry.ts` contient les productions et les recettes.
Une recette référence un noyau existant, sa formule, ses paramètres, variables,
unité, famille de couverture, sources et réserves. Son champ historique
`kernel.production` désigne la provenance du calculateur, jamais son applicabilité.
L’applicabilité est exclusivement `PRODUCTIONS[].indicators`.

Les trois classes scientifiques sont représentées explicitement. Cette version
accepte des recettes météorologiques et agroclimatiques descriptives ; elle refuse
les recettes interprétatives tant qu’un contrat de validation propre n’existe pas.
Les sommes base 6 et base 10 °C sont conventionnelles, non plafonnées, non calées
sur semis ou variété. Elles ne calculent aucun stade. Un jour sec est strictement
`P < 1 mm` ; la fréquence proposée est strictement `P > 0,1 mm`, sans prétendre
être un indice ETCCDI standard. Les seuils de chaleur sont conventionnels.
Le minimum est le minimum temporel des Tmin du support archivé, jamais une
promesse de minimum microclimatique dans toute la PRA.

Le schéma JSON versionné est
`contracts/jsonschema/multiproduction-registry.schema.json` ; le test de contrat
valide le catalogue complet et refuse versions et fenêtres invalides.
`evidence/catalogue.json` est l’export machine du registre.

## Calcul mutualisé et identités

`computeBatch` est un service synchrone pur, sans accès réseau, horloge ou écriture.
Il reçoit une géographie explicite (les 713 identifiants en pilote), une période
UTC et un fournisseur d’entrées par variables. Le fournisseur garantit des unités
normalisées °C / mm / % et une fenêtre quotidienne vérifiée en amont. Les
adaptateurs fournis réutilisent les contrôles d’archives, unités, sommes SHA-256,
sélection modèle et masques existants ; aucun nouveau fournisseur météo.

Le cache est borné à une PRA dans un lot. Sa clé comprend version, variables,
opérateur, seuil, unité, formule, référence, famille de couverture et fenêtres.
Les calculs identiques (dont chaleur bovine et chaleur générique) sont mutualisés.
Chaque recette utilise des entrées propres à ses variables, jamais le support
d’une autre variable. Les séries, preuves et résultats partagés sont figés
récursivement ; aucun consommateur ne peut altérer une autre production.
Il n’y a ni cache global persistant ni calcul ajouté au chargement d’une page.

L’empreinte de comparabilité inclut les identités complètes source/run/nature et
support/méthode/masque/fraction/surface. Les origines restent transportées en clair
avec l’empreinte. Les identités historiques opaques se résolvent dans les archives
à partir des provenances conservées. Un modèle, run, masque, méthode ou fraction
qui change bloque le résultat intégré. Une absence de jour ne devient jamais zéro.
Les doublons et dates hors fenêtre sont des erreurs de contrat explicites.

## Disponibilité et espace

La période admissible est de 1 à 30 jours ; la disponibilité réelle dépend des
archives, notamment pour 7/14/30 jours. Les archives de prévision actuelles ne
fournissent que J+1…J+7 ; une extension ne crée pas de jours supplémentaires.
Une série incomplète produit `null` avec motif, et conserve ses journées lisibles.
Les séquences intégrées ne raccordent jamais des supports ou runs incompatibles.

CORE-01 garde les portions temporellement complètes sous `observed_value`, avec
`observed_area` et une fraction explicite ; aucune extrapolation silencieuse.
Le registre des certificats d’estimation reste vide. Une surface absente reste
`null` dans les preuves : elle n’est pas reconstruite à partir d’un pourcentage.
Les THI demandent un support complet, et des preuves individuelles T/RH concordant
sur unité, source, run, support, identité modèle/grille et bornes quotidiennes UTC. Sans humidité, le motif
est `humidity_missing`. Les adaptateurs nationaux ne fabriquent aucun couple : les
archives opérationnelles inspectées ne fournissent pas de RH qualifiée.

## Temporalité et comité éditorial

`compareMeasurements` appelle le comparateur T33 : durée et décalage homologues,
même source, modèle, support, règle, unité, production et PRA. Une différence
numérique n’est exposée que pour une évolution historique comparable ; une
révision prévisionnelle n’est pas une évolution observée. Les changements de run
restent conservativement incomparables dans cette première façade.

`dailyEpisodeEvidence` prépare les journées de réanalyse pour
`reconstructEpisodes` de T33. Il conserve les jours absents, les changements de
signature et la censure aux bornes. Les identifiants de phénomènes sont découverts
par recette/production. Les épisodes décrivent des franchissements de seuils,
jamais une vague de chaleur au sens d’une définition climatologique officielle.
Leurs valeurs sont des jours de franchissement ; aucun impact agricole.

`createContributors` découvre les six productions dans le registre. Il prépare
un lot d’une seule période et nature, regroupe chaque indicateur avec ses faits
PRA et maintient l’inventaire indisponible. Les faits portent ID stable, production,
version, valeur/unité, période, PRA, région, nature, origine, fraîcheur, qualité,
limites et lien explorateur. Les supports partiels n’entrent pas dans les faits
territoriaux du Journal. Le champ de comparaison reste `null` sans couple de lots
homologues fourni ; le paramètre optionnel `comparison` de la fabrique joint
uniquement les comparaisons qualifiées, également disponibles séparément.

La fabrique reçoit un lot scientifique déjà sélectionné ; elle ne lit pas de DB
et n’effectue pas la sélection temporelle du Journal à partir de `WatchSummary`.
JOUR-02 devra choisir explicitement les lots de l’édition, vérifier sa cohérence
avec la source et la période de l’édition, puis composer ces contributions avec
les autres. Aucun branchement n’est effectué ici. Les liens des nouvelles
productions sont préparés pour l’intégration UX ; aucune page n’est modifiée.
