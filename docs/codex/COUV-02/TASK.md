# COUV-02 — Reprise et finalisation de la couverture climatique nationale

## Contexte et objectif

Nous reprenons le chantier COUV-01 de Climacta (anciennement AgriClimaX), resté en suspens dans la PR #63 :

https://github.com/Mehdi-Sine/agriclimax/pull/63

Le travail précédent a déjà permis d'identifier et de tester une solution complémentaire à ERA5-Land fondée sur SAFRAN/SIM.

Résultats documentés :
- 713 petites régions agricoles (PRA), dont 6 corses.
- 645 PRA entièrement couvertes par ERA5-Land.
- 675 PRA entièrement couvertes par le pilote SAFRAN/SIM.
- 38 PRA encore partiellement couvertes avec SIM.
- 60 jours de données réelles testées.
- Aucun déploiement opérationnel de SAFRAN/SIM à ce stade.

**Objectif : obtenir une couverture nationale aussi exhaustive que possible, avec une cible de 713 PRA exploitables, sans sacrifier la fiabilité scientifique ni la maîtrise des ressources.**

## 1. Reprendre les travaux existants

Avant tout développement :

1. Examiner la PR #63, sa branche, ses commits et les documents `docs/codex/COUV-01/`.
2. Examiner notamment les diagnostics de couverture, les matrices PRA/date/variable, les archives et les tests déjà réalisés.
3. Comparer ce travail au dernier `main`, incluant les corrections OPS-06 et OPS-07.
4. Identifier les éléments réutilisables et les éventuels conflits.

Ne pas recommencer les calculs et les développements déjà validés.

Si la branche #63 est trop ancienne pour être fusionnée proprement, créer une nouvelle branche depuis `main` et y reporter uniquement les éléments utiles, en conservant leur traçabilité.

Ne pas fusionner directement la PR #63.

## 2. Rechercher d'abord une solution simple avec ERA5-Land

Avant de généraliser une deuxième source, déterminer si les 68 PRA actuellement incomplètes peuvent être améliorées avec les données ERA5-Land existantes.

Étudier notamment :
- Les cellules terrestres partiellement intersectées.
- La résolution et la géométrie des grilles.
- Les PRA côtières et insulaires.
- La pondération surfacique.
- Les éventuels effets de masque terre/mer.
- Les erreurs ou approximations liées aux intersections géospatiales.

Ne pas extrapoler artificiellement une valeur météorologique sur une surface dépourvue de support scientifique.

Évaluer quantitativement les gains possibles avec ERA5-Land seul.

## 3. Réutiliser SAFRAN/SIM lorsque nécessaire

Si ERA5-Land ne permet pas d'obtenir une couverture suffisante, reprendre la solution SAFRAN/SIM de COUV-01.

Priorité à une architecture légère :
- ERA5-Land reste la source historique existante.
- SAFRAN/SIM intervient uniquement lorsque son apport est justifié.
- Les provenances restent explicites.
- Les séries de natures ou de conventions différentes ne sont jamais mélangées silencieusement.
- Les calculs agronomiques respectent les définitions et unités propres à chaque source.

Réutiliser les archives, les contrôles d'intégrité et les tests existants.

Éviter une ingestion nationale supplémentaire inutile si une récupération ciblée des PRA incomplètes suffit.

## 4. Résoudre les 38 PRA résiduelles

Analyser individuellement les 38 PRA encore partiellement couvertes par SAFRAN/SIM.

Pour chacune, documenter :
- Le nom et l'identifiant.
- Le pourcentage de couverture ERA5-Land.
- Le pourcentage de couverture SAFRAN/SIM.
- La surface manquante.
- La cause géographique ou technique.
- La solution envisageable.

Appliquer notre règle produit :

**Une PRA est considérée comme exploitable lorsque les données représentent au moins 90 % de sa surface, avec une provenance et une qualité explicitement documentées.**

Cette règle ne doit pas être confondue avec une couverture scientifique intégrale.

Si une PRA atteint ce seuil, elle peut être affichée avec une mention de couverture partielle lorsque nécessaire.

Pour les PRA sous le seuil, conserver l'état indisponible et le signalement visuel existant.

Ne pas inventer de valeurs.

## 5. Qualifier les variables et les périodes

Vérifier séparément :
- Température moyenne.
- Températures minimale et maximale.
- Précipitations.
- Humidité, lorsqu'elle est disponible.
- Indicateurs agroclimatiques dérivés.

Contrôler les différences entre ERA5-Land et SAFRAN/SIM : horaires de référence, unités, définition des extrema, granularité temporelle et provenance.

Ne pas généraliser une variable ou un indicateur si son équivalence scientifique n'est pas démontrée.

Distinguer clairement historique, observations récentes et prévisions.

## 6. Préserver le fonctionnement quotidien de Climacta

C'est une contrainte impérative.

Ne pas modifier :
- Le circuit automatique de publication du Journal.
- Les mécanismes de secours éditorial OPS-06/OPS-07.
- Les archives déjà publiées.
- Les prompts OpenAI.
- Les prévisions AROME/ARPEGE/IFS.
- Les composants UX Climacta.
- Les légendes scientifiques existantes.

Développer et tester le nouveau support climatique de façon indépendante.

N'activer aucune nouvelle acquisition quotidienne tant que son coût, sa durée et sa robustesse n'ont pas été vérifiés.

## 7. Préparer une intégration progressive

Si les résultats sont satisfaisants :

1. Préparer un adaptateur climatique compatible avec les contrats existants.
2. Conserver la traçabilité des sources pour chaque PRA, date et variable.
3. Éviter de recalculer inutilement l'historique.
4. Prévoir une mise à jour incrémentale et une rétention maîtrisée.
5. Tester les conséquences sur les indicateurs agroclimatiques et les cartes.

La première intégration doit rester désactivée par défaut.

Ne pas modifier les données de production ni les archives historiques.

## 8. Validation et résultats attendus

Fournir un tableau national avant/après :

| Indicateur | Situation actuelle | Après correction |
|---|---|---|
| PRA exploitables au seuil de 90 % | À mesurer précisément | Résultat réel |
| PRA couvertes à 100 % | 645 avec ERA5 | Résultat réel |
| PRA encore indisponibles | À mesurer | Résultat réel |
| PRA corses exploitables | À mesurer | Résultat réel |
| Variables disponibles | À mesurer | Résultat réel |
| Coût quotidien de collecte | Situation actuelle | Estimation après intégration |

Produire également :
- Une carte nationale des PRA exploitables et manquantes.
- Un diagnostic spécifique de la frange littorale.
- Une estimation des volumes de stockage et du temps de calcul.
- Les résultats des tests géospatiaux et scientifiques.
- Une procédure d'activation progressive et de retour arrière.

## 9. Livrable et décision

Créer une nouvelle PR draft intitulée :

**COUV-02 — Complétude littorale et qualification nationale des PRA**

Ne pas fusionner automatiquement.

Présenter un verdict clair :
- **GO** si le nouveau support est scientifiquement qualifié, compatible avec l'application et suffisamment robuste pour être activé.
- **PARTIAL** si certaines variables ou certains territoires restent incomplets mais qu'un gain réel et exploitable est démontré.
- **NO-GO** si les données ne permettent pas une amélioration fiable.

Ne pas rechercher artificiellement un résultat de 713/713.

**Critère principal de réussite : réduire fortement, idéalement supprimer, les trous visibles sur la carte nationale, avec des valeurs climatiques justifiées et une couverture d'au moins 90 % de chaque PRA affichée.**

Le développement doit rester proportionné : réutiliser au maximum COUV-01, éviter les nouvelles infrastructures et ne pas fragiliser le Journal quotidien.