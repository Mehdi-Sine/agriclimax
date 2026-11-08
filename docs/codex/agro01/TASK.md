# AGRO-01 — AgriClimaX : consolidation des indicateurs agroclimatiques du blé tendre et intégration au Journal

## 1. Contexte et ambition

Tu travailles sur le dépôt `Mehdi-Sine/agriclimax`.

L'application AgriClimaX permet d'analyser des données climatiques et agroclimatiques sur les 713 petites régions agricoles de France métropolitaine et de Corse.

Les travaux précédents ont développé :

- L'ingestion et l'archivage des données climatiques.
- Les références ERA5-Land.
- Les prévisions nationales météorologiques.
- Les calculs agroclimatiques blé et bovins.
- Un moteur de veille nationale (Task 30).
- Un Journal agroclimatique (Task 31).

Le Journal dispose d'un registre de contributeurs par production, mais les indicateurs agroclimatiques du catalogue actuel sont encore marqués exploratoires et ne sont pas publiés comme indicateurs qualifiés.

Je souhaite construire progressivement un catalogue national d'indicateurs agroclimatiques pour de nombreuses productions.

**AGRO-01 constitue la première tâche de ce chantier scientifique, consacrée au blé tendre.**

Le but n'est pas simplement de créer de nouvelles formules : il faut fiabiliser les calculs existants, contrôler leur pertinence scientifique, vérifier leur couverture nationale, puis permettre leur utilisation dans le Journal.

## 2. Préparation et coordination avec T32

Partir de la dernière version de `origin/main` intégrant T31, PR #60.

Créer la branche :

`codex/agro-01-wheat-indicators`

Une autre tâche Codex, T32, travaille simultanément sur la refonte UX/UI du Journal.

### Périmètre autorisé

Tu peux intervenir sur :

- Les calculateurs agroclimatiques du blé.
- `features/agroclimatic/catalogue.ts`
- Les services de calcul agroclimatique.
- Les adaptations scientifiques nécessaires dans `features/wheat/`.
- Les bibliothèques Python du blé si cela est nécessaire.
- Les tests correspondants.
- Un nouvel adaptateur éditorial propre au blé.
- Les points d'intégration serveur nécessaires pour fournir les résultats au Journal.
- La documentation `docs/codex/agro01/`.

### Périmètre réservé à T32

Ne pas modifier :

- `apps/web/app/journal/page.tsx`
- `apps/web/app/journal/journal.css`
- Les composants de présentation du Journal
- Les nouveaux composants UI de T32

Éviter de modifier les contrats `JournalEdition` et `EditorialFact` de T31, sauf nécessité absolue démontrée.

Le Journal possède déjà un registre de contributeurs. Réutiliser cette architecture pour l'intégration des nouveaux indicateurs.

Si l'intégration requiert une modification serveur ou du registre, la limiter au strict nécessaire, conserver la compatibilité avec T31 et documenter précisément les changements.

Aucun merge ni déploiement en production.

## 3. Auditer le catalogue existant du blé tendre

Commencer par analyser l'ensemble des calculateurs et indicateurs déjà disponibles.

Les indicateurs identifiés dans les travaux précédents comprennent notamment :

- Somme de températures (GDD).
- Nombre de jours de chaleur.
- Durée maximale d'une séquence chaude.
- Nombre de jours de gel.
- Durée maximale d'une séquence de gel.
- Précipitations cumulées.
- Nombre de jours de pluie importante.
- Nombre de jours secs.
- Durée maximale d'une séquence sans pluie significative.
- Température moyenne, également présente dans le catalogue actuel.

Vérifier l'inventaire réel avant de coder.

Pour chaque indicateur, documenter :

1. Son identifiant.
2. Son objectif agronomique ou météorologique.
3. Ses variables d'entrée.
4. Sa formule exacte.
5. Ses paramètres et seuils.
6. Ses unités.
7. Sa période de validité.
8. Sa méthode d'agrégation temporelle.
9. Sa méthode de restitution spatiale.
10. Ses références scientifiques.
11. Ses exigences de qualité.
12. Son niveau de validation scientifique.
13. Ses limites d'interprétation.

Ne pas assimiler un indicateur climatique descriptif à une prédiction de rendement, de stade phénologique ou de dommage.

Par exemple, une somme de températures à base 0 °C n'est pas automatiquement un modèle validé de développement phénologique du blé.

Les seuils génériques de 25 °C, 0 °C ou 1 mm doivent être présentés pour ce qu'ils sont : des conventions descriptives, sauf validation agronomique spécifique.

## 4. Audit scientifique et fiabilisation des calculs

Vérifier les calculs existants plutôt que de tout réécrire.

Examiner particulièrement :

- Les dates et périodes.
- Les unités.
- Les valeurs manquantes.
- La couverture spatiale.
- La couverture temporelle.
- Les ruptures de sources météorologiques.
- Les différences entre prévisions et réanalyses.
- La gestion des données partielles.
- Les valeurs extrêmes.
- Les résultats incohérents.
- Les conditions de calcul des séquences consécutives.

Les cumuls ne doivent pas raccorder artificiellement deux modèles météorologiques, deux initialisations ou deux supports incompatibles.

En cas d'incompatibilité, renvoyer une indisponibilité explicite ou calculer des segments homogènes clairement qualifiés, conformément aux contrats existants.

Tester les limites des fenêtres de 1, 7 et 30 jours.

Contrôler les opérations :

- Somme.
- Moyenne.
- Dépassement de seuil.
- Nombre de jours.
- Durée maximale des séquences.
- Sommes de degrés-jours.

Vérifier les conventions sur les bornes des seuils : inférieur strict, supérieur strict ou inclusif.

Si des formules doivent être corrigées, versionner les changements et mettre à jour les tests.

Ne pas rompre les anciens résultats ou contrats sans migration de version explicite.

## 5. Valider la couverture nationale réelle

Réaliser une recette sur les 713 PRA.

Utiliser les données réellement disponibles dans les archives AgriClimaX.

Tester en priorité :

- La dernière période historique complète accessible.
- Une fenêtre historique de sept jours.
- Une fenêtre historique de trente jours, si elle est effectivement disponible.
- Le dernier cycle prévisionnel national vérifié.
- Les différentes régions administratives.
- Plusieurs PRA contrastées : grandes cultures, montagne, littoral, Corse.

Les tests précédents avaient notamment obtenu 645 PRA complètes sur une période historique de fin octobre 2026 et 713 PRA disposant des variables nécessaires pour certaines prévisions quotidiennes.

Ces chiffres servent de points de comparaison, pas de résultats à recopier.

**Recalculer la couverture réellement accessible à la date d'exécution.**

Produire une matrice de disponibilité :

- Indicateur.
- Période.
- Nature de la source.
- PRA évaluables.
- PRA complètes.
- PRA partielles.
- PRA indisponibles.
- Motifs d'indisponibilité.

Ne pas masquer les problèmes littoraux ou les limites de représentativité.

Les anomalies par rapport à une normale ne doivent être calculées que lorsque les références sont compatibles et complètes.

## 6. Vérification indépendante des résultats

Mettre en place des vérifications indépendantes des calculateurs existants.

Comparer un échantillon de résultats avec des calculs de référence indépendants en Python ou des formules élémentaires explicites.

Couvrir plusieurs situations :

- Zéro jour au-dessus d'un seuil.
- Plusieurs journées consécutives.
- Interruption d'une séquence.
- Donnée manquante.
- Changement de source.
- Période incomplète.
- Valeurs aux limites exactes d'un seuil.
- Températures négatives.
- Précipitations nulles.
- Cumul GDD.
- Moyenne thermique.

Conserver les résultats et les écarts dans un rapport scientifique.

Les tests synthétiques doivent être clairement identifiés.

Utiliser aussi des données réelles provenant des archives.

La fiabilisation doit permettre de séparer deux notions :

- **Calcul techniquement validé** : les valeurs sont correctement calculées à partir des données disponibles.
- **Interprétation agronomique validée** : l'indicateur permet réellement une conclusion sur une culture, selon une référence scientifique adaptée.

La première peut être atteinte pour certains indicateurs de cette tâche sans prétendre avoir atteint la seconde.

## 7. Créer un catalogue blé qualifié pour publication

Construire une couche de qualification des indicateurs.

Chaque indicateur doit posséder :

- Un identifiant stable.
- Une version.
- Une formule.
- Les seuils et paramètres.
- Une source ou référence scientifique.
- Une nature : observation, réanalyse ou prévision.
- Un niveau de qualité des données.
- Un niveau de qualification du calcul.
- Un statut scientifique explicite.
- Un indicateur d'éligibilité à une publication descriptive.
- Des limites d'interprétation.

Un indicateur peut être publiable en tant que **mesure climatique descriptive et exploratoire**, tout en restant non qualifié pour une interprétation agronomique du risque.

Cette distinction doit être explicite et vérifiée automatiquement.

Ne pas transformer globalement tous les indicateurs exploratoires en indicateurs scientifiques validés.

Établir une liste blanche des indicateurs suffisamment fiabilisés pour être présentés au Journal, avec leur niveau exact de qualification.

Ne pas forcer la publication d'un indicateur lorsque les conditions de couverture, qualité, provenance ou comparabilité ne sont pas réunies.

## 8. Développer une synthèse nationale blé

C'est un livrable important.

Construire une couche de synthèse capable de fournir au Journal des informations sur le blé tendre sans transférer l'intégralité des calculs des 713 PRA.

Par exemple :

- Une valeur calculée représentative d'un territoire explicitement identifié.
- Le nombre de PRA pour lesquelles un critère descriptif est franchi, avec le dénominateur de couverture.
- Les régions dans lesquelles les phénomènes sont les plus remarquables.
- Les indicateurs disponibles ou indisponibles.
- Les situations particulières dignes d'être approfondies.
- Des liens vers les analyses détaillées.

Ne pas utiliser une moyenne arithmétique non pondérée des PRA comme moyenne climatique régionale ou nationale.

Ne pas estimer les hectares de blé touchés sans méthode spatiale scientifiquement défendable.

La présence RPG de blé tendre peut enrichir le contexte, mais elle ne prouve ni la présence actuelle d'une culture sur pied, ni sa variété, ni son stade.

### Échelle de restitution

Le moteur scientifique continue de travailler à la maille PRA.

Les synthèses destinées au Journal doivent privilégier :

- La France entière.
- Les treize régions administratives.
- Une PRA nommée lorsque son cas est particulièrement remarquable.

La synthèse doit être légère, vérifiable et reproductible.

## 9. Préparer des indicateurs agronomiquement plus pertinents

En complément de la fiabilisation, étudier les indicateurs qui pourraient améliorer l'utilité agronomique pour le blé tendre.

Examiner notamment :

- Sommes de températures sur des fenêtres agronomiquement pertinentes.
- Cumul de pluie sur plusieurs horizons.
- Déficits de précipitations par rapport aux normales compatibles.
- Persistance des séquences sans pluie.
- Exposition aux températures basses et élevées.
- Indicateurs liés aux périodes théoriques de développement.

Pour chaque proposition, distinguer :

- Ce qui est calculable immédiatement.
- Ce qui nécessite une nouvelle référence climatique.
- Ce qui nécessite des observations phénologiques.
- Ce qui nécessite des données supplémentaires, par exemple d'humidité du sol.
- Ce qui exige une validation agronomique avec une référence scientifique.

Ne pas inventer de stade phénologique à partir de la seule date.

Ne pas construire un modèle de risque hydrique ou de rendement non validé.

Dans cette tâche, privilégier quelques indicateurs réellement fiables plutôt qu'une extension prématurée du catalogue.

## 10. Intégration dans le Journal agroclimatique

La Task 31 a créé :

`apps/web/features/journal/registry.ts`

Elle dispose d'un système de contributeurs.

Développer un adaptateur éditorial du blé tendre, par exemple `WheatEditorialContributor`, utilisant les contrats existants.

Il doit permettre au Journal de recevoir :

- La production « Blé tendre ».
- Les indicateurs qualifiés et disponibles.
- Leur période.
- Leurs valeurs et unités.
- Les territoires concernés.
- Les identifiants des faits.
- Les preuves et références.
- Les réserves scientifiques.
- Les liens vers les analyses.

Les rubriques par production seront affichées par les composants génériques développés en parallèle par T32.

**Ne pas modifier l'interface du Journal dans cette tâche.**

Le contributeur doit être compatible avec ces composants.

Étudier soigneusement l'architecture actuelle : le registre de T31 est principalement synchrone, alors que les données nationales peuvent nécessiter une lecture serveur asynchrone.

Si un adaptateur serveur est nécessaire, le construire de façon à conserver le moteur éditorial déterministe et ses contrats publics, avec cache et bornes de temps de calcul.

Privilégier un calcul une fois par cycle de données vérifié, et non un calcul à chaque visite du Journal.

Éviter de déclencher neuf calculs nationaux indépendants lorsque les mêmes données d'entrée peuvent être mutualisées.

Ne pas créer de job quotidien supplémentaire dans cette tâche.

Si la disponibilité réelle des données ne permet pas de publier un indicateur, conserver son statut non publiable avec une explication explicite.

### Critère de succès

Le Journal doit pouvoir afficher automatiquement de véritables indicateurs blé lorsque leur calcul et leur publication descriptive sont qualifiés.

L'ajout doit être réalisé par le contrat de contribution, sans codage en dur dans les composants UI.

Les indicateurs non qualifiés restent exclus.

## 11. Performance et ressources

L'application doit rester compatible avec un hébergement gratuit ou très économique.

Réutiliser les données et archives existantes.

Éviter :

- De nouvelles acquisitions pour recalculer des données disponibles.
- Les duplications volumineuses.
- Les téléchargements inutiles.
- Les appels répétitifs aux mêmes archives.
- Les calculs des 713 PRA exécutés à chaque consultation.
- Les modifications de workflows en production.

Mettre en place des caches identifiés par le cycle, les règles, les données sources et leurs versions.

Mesurer :

- Temps de calcul.
- Mémoire utilisée.
- Taille du résultat.
- Taille de la synthèse destinée au Journal.
- Éventuel impact sur les limites Vercel.

Une indisponibilité d'indicateur ne doit jamais bloquer la publication du Journal national.

## 12. Tests d'acceptation

Créer des tests couvrant :

1. Les principaux indicateurs blé.
2. Les formules et leurs unités.
3. Les seuils et bornes.
4. Les séquences et cumuls.
5. Les sources incompatibles.
6. Les supports spatiaux partiels.
7. Les périodes incomplètes.
8. Les 713 PRA nationales.
9. Les limites littorales.
10. Les données historiques.
11. Les données prévisionnelles.
12. Les références climatiques disponibles.
13. Les résultats indépendants de référence.
14. Le fonctionnement du contributeur éditorial.
15. Le refus de publier un indicateur non qualifié.
16. L'absence d'inférence de dommage agricole.
17. La compatibilité avec le Journal de T31.
18. La non-régression des autres productions.
19. La reproductibilité des résultats.
20. Les performances et la consommation de ressources.

Exécuter les tests TypeScript, Python, lint, build et vérifications de sécurité pertinentes.

Tester les API réelles en Preview si possible.

## 13. Documentation attendue

Créer :

`docs/codex/agro01/`

Avec :

**`WHEAT_INDICATOR_CATALOGUE.md`**

Inventaire complet des indicateurs, formules, références, versions et qualifications scientifiques.

**`SCIENTIFIC_VALIDATION.md`**

Protocole de validation, résultats indépendants, comparaisons et limites.

**`NATIONAL_COVERAGE.md`**

Couverture nationale réelle par indicateur et période, y compris les données manquantes.

**`EDITORIAL_CONTRIBUTOR.md`**

Description du contrat d'alimentation du Journal et procédure d'intégration d'un futur indicateur.

**`FUTURE_WHEAT_INDICATORS.md`**

Propositions d'évolution du catalogue scientifique et besoins complémentaires en données.

**`ACCEPTANCE.md`**

Résultats des tests, performances et limites restantes.

Conserver des exemples réels de calculs et de synthèses éditoriales dans les preuves.

## 14. Livraison attendue

Créer une PR draft sans merge.

Présenter en conclusion :

1. Les indicateurs blé effectivement fiabilisés.
2. Les corrections scientifiques ou techniques apportées.
3. Leur couverture nationale réelle.
4. Les limites de données rencontrées.
5. Les indicateurs éligibles à une publication descriptive.
6. Les indicateurs encore non qualifiés.
7. Un exemple de synthèse régionale blé.
8. Un exemple de contribution au Journal.
9. Les résultats des tests indépendants.
10. Les ressources consommées.
11. L'URL de Preview ou de validation API.
12. Les prochaines priorités pour les indicateurs blé.

### Critère final

Je veux pouvoir affirmer que les indicateurs blé tendre d'AgriClimaX sont calculés correctement sur les données disponibles, que leurs limites scientifiques sont connues et qu'une sélection d'entre eux peut alimenter le Journal quotidien de manière reproductible et contrôlée.

Le résultat doit constituer un **modèle d'intégration réutilisable pour les autres productions agricoles**, notamment bovins, vigne, maïs, prairies et arboriculture.

Ne pas confondre validation du calcul et validation d'un risque agronomique.

Ne pas publier de valeurs non vérifiées.

Ne pas déployer ni merger automatiquement.

Avancer de manière autonome jusqu'à une PR draft complète, testée et documentée.