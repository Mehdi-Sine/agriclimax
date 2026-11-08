# TASK CORE-01 — AgriClimaX : unification de la couverture climatique, des supports partiels et de la qualité des données

## 1. Contexte et mission

Tu travailles sur le dépôt GitHub `Mehdi-Sine/agriclimax`.

Les PR #61 (Journal T32B) et #62 (AGRO-01 Blé tendre) ont été fusionnées dans `main`.

Le dernier merge vérifié est le commit `ccc42256ea` du 8 novembre 2026.

Le projet dispose actuellement :

- Du référentiel officiel des 713 PRA françaises, dont six en Corse.
- D'une chaîne nationale de données climatiques historiques et prévisionnelles.
- De sources ERA5-Land et Météo-France AROME/ARPEGE/IFS.
- De calculateurs agroclimatiques pour différentes productions.
- D'un moteur de veille nationale.
- D'un Journal agroclimatique comprenant une carte dynamique à la maille PRA.
- De dix indicateurs descriptifs blé récemment fiabilisés.
- De plusieurs mécanismes de qualification des supports spatiaux.

**Problème : les règles de gestion des supports climatiques partiels ne sont pas uniformément propagées dans l'application.**

Certaines rubriques savent restituer des informations issues d'un support spatial partiel, alors que d'autres imposent une couverture presque totale avant d'afficher une valeur.

Je souhaite une architecture logicielle solide, modulaire et évolutive, permettant de traiter cette question de façon centralisée pour toutes les productions.

### Vision produit

Je préfère une carte nationale comportant une PRA partiellement renseignée, avec une valeur explicitement qualifiée et scientifiquement défendable, plutôt qu'une carte artificiellement grisée à cause de règles excessivement restrictives.

Je peux accepter qu'une PRA réellement non renseignée, par exemple Crozon avec certaines sources ERA5-Land, reste grise.

En revanche, si une PRA littorale dispose de données couvrant une fraction représentative de son territoire, je souhaite pouvoir les visualiser lorsque leur exploitation est scientifiquement défendable.

Il faut distinguer :

- Une valeur disponible sur le support observé.
- Une estimation qualifiée pour l'ensemble de la PRA.
- Une mesure native complète.
- Une valeur insuffisamment documentée ou indisponible.

**Objectif principal : rendre cohérentes ces distinctions sur toute la chaîne, de la source climatique jusqu'aux cartes, aux indicateurs, à la veille et au Journal.**

Il ne s'agit ni d'abaisser aveuglément les seuils de qualité ni de masquer les incertitudes.

## 2. Branche et coordination

Partir du dernier `origin/main`, qui intègre les PR #61 et #62.

Créer :

`codex/CORE-01-unified-climate-coverage`

Une autre PR est ouverte :

- PR #63 : `codex/COUV-01-national-climate-foundation`

Cette PR contient des travaux expérimentaux sur SAFRAN/SIM, la restauration d'archives historiques et la qualification géographique.

**Ne pas fusionner, modifier ou écraser la PR #63.**

En revanche, lire ses documents et ses résultats pour réutiliser les connaissances scientifiques acquises.

En particulier :

- `docs/codex/COUV-01/ROOT_CAUSE_AUDIT.md`
- `docs/codex/COUV-01/NATIONAL_SOURCE_STRATEGY.md`
- `docs/codex/COUV-01/SAFRAN_PILOT.md`
- `docs/codex/COUV-01/ACCEPTANCE.md`

Ces documents sont accessibles depuis la branche COUV-01, pas nécessairement depuis `main`.

Ne pas importer une seconde chaîne climatique en production dans cette tâche.

Ne pas modifier les secrets, les calendriers automatiques, les quotas ou les écritures de production.

Ne pas merger automatiquement.

## 3. Phase 1 — Audit transversal des politiques de couverture

Avant de modifier le code, établir une cartographie précise des mécanismes existants.

Étudier particulièrement :

### Calculs agroclimatiques

- `apps/web/features/agroclimatic/observed-support.ts`
- `apps/web/features/agroclimatic/calculate.ts`
- `apps/web/features/agroclimatic/catalogue.ts`
- `apps/web/features/wheat/qualified.ts`
- `apps/web/features/wheat/national.ts`
- `apps/web/lib/server/wheat.ts`
- Les calculateurs bovins.
- Les méthodes de traitement des supports partiels dans le moteur Python.

### Restitution climatique

- `apps/web/lib/server/weather-archives.ts`
- `apps/web/lib/server/national-watch.ts`
- `apps/web/features/national-watch/`
- `apps/web/features/national/`
- `apps/web/features/cartography/`
- `apps/web/features/journal/ui/map-data.ts`
- Les API des explorateurs et du Journal.

### Documentation historique

Relire les décisions et preuves des Tasks 19, 26, 28, 29, 30 et AGRO-01.

Identifier notamment :

1. Les endroits où une couverture à 100 % est exigée.
2. Les endroits où un seuil de 90 % existe déjà.
3. Les endroits où une valeur sur surface observée est conservée.
4. Les endroits où les données partielles sont rejetées.
5. Les endroits où les informations de couverture sont perdues dans les transformations.
6. Les endroits où l'affichage confond absence de donnée, support partiel et valeur nulle.
7. Les endroits où le même indicateur est traité différemment par plusieurs rubriques.

Produire une matrice comparative avant toute modification.

**Ne pas interpréter automatiquement ces différences comme des bugs : certaines sont des restrictions scientifiques légitimes.**

## 4. Phase 2 — Concevoir un contrat commun de couverture et de qualité

Créer ou consolider un contrat partagé, versionné, indépendant de l'interface.

Il doit pouvoir être consommé par les moteurs TypeScript et Python sans ambiguïté.

Le contrat devra représenter séparément :

### A. Identité et provenance

- PRA officielle.
- Source climatique.
- Nature : observation, réanalyse ou prévision.
- Modèle et initialisation si applicable.
- Version de la méthode.
- Identité de grille et de pondération.
- Période de validité.
- Identifiants des preuves.

### B. Qualité spatiale

- Fraction de territoire renseignée.
- Surface effectivement représentée.
- Support natif complet ou partiel.
- Méthode de reconstruction éventuelle.
- Identité stable du support.
- Distinction entre masque terrestre réel et proxy géométrique.

### C. Qualité temporelle

- Journées attendues et disponibles.
- Complétude temporelle.
- Continuité des périodes.
- Compatibilité entre journées.
- Homogénéité des modèles, grilles, unités et supports.

### D. Qualification de la donnée

Prévoir des états explicites, par exemple :

- `native_complete`
- `observed_partial`
- `qualified_estimate`
- `unavailable`
- `unknown`

Ces états sont indicatifs : réutiliser les contrats existants lorsque possible.

Distinguer impérativement :

1. La présence d'une valeur numérique.
2. La qualité spatiale du support.
3. La validité scientifique de la méthode.
4. L'éligibilité de la valeur pour un indicateur donné.
5. L'autorisation de publication dans le Journal.

Ces dimensions ne doivent pas être réduites à un seul booléen `available`.

Prévoir des schémas de validation et des versions permettant une migration progressive des anciens contrats.

Éviter les modifications cassantes des API existantes.

## 5. Phase 3 — Définir une politique scientifique par famille d'indicateurs

Je ne souhaite pas une règle universelle imposant 100 % de couverture pour tout.

Mais je ne souhaite pas non plus un seuil de 90 % appliqué à toutes les variables.

Construire une politique commune, explicite et testable.

### Famille A — Moyennes et cumuls

Exemples :

- Température moyenne.
- Sommes thermiques.
- Cumuls de précipitations.

Étudier et réutiliser, lorsque scientifiquement justifié, la règle déjà développée pour les supports couvrant au moins 90 % de la surface de la PRA.

La valeur peut alors être une estimation représentative qualifiée si :

- Le support spatial est correctement identifié.
- La méthode d'agrégation est adaptée.
- La fraction manquante est documentée.
- Le support reste compatible sur la période.
- Les données temporelles sont complètes.
- Les contrôles indépendants sont satisfaisants.
- La méthode est versionnée.

L'affichage doit indiquer le statut de l'estimation.

**Le seuil de 90 % est une hypothèse de qualification à tester, et non une preuve automatique de représentativité.**

Examiner la sensibilité des résultats à ce seuil et aux caractéristiques des PRA littorales.

### Famille B — Extrêmes et événements

Exemples :

- Température minimale.
- Température maximale.
- Journées franchissant un seuil.
- Épisodes de gel ou de chaleur.
- Précipitations intenses.

Une valeur extrême calculée sur 90 % du territoire n'est pas nécessairement représentative de l'extrême sur 100 % de la PRA.

Prévoir la possibilité de conserver et d'afficher la valeur observée sur le support disponible, sans la qualifier abusivement comme un extrême de toute la PRA.

La légende et les preuves doivent préciser cette portée.

Les conclusions territoriales et les statistiques nationales doivent respecter cette distinction.

### Famille C — Séquences temporelles

Exemples :

- Nombre de jours secs.
- Plus longue séquence sans pluie.
- Nombre de jours avec gel.

Les séquences doivent utiliser des journées consécutives et un support compatible.

Ne pas raccorder artificiellement des sources ou des grilles incompatibles.

Une séquence sur support observé peut être présentée comme telle, mais ne doit pas devenir une séquence représentative de toute la PRA sans qualification.

### Famille D — Normales et anomalies

Conserver des conditions scientifiques strictes :

- Référence climatique homogène.
- Période de référence adaptée.
- Support compatible.
- Variables identiques.
- Calendrier comparable.
- Méthodes versionnées.

Ne pas calculer une anomalie par rapprochement opportuniste de deux sources différentes.

### Famille E — Indicateurs agroclimatiques spécifiques

Prévoir que chaque indicateur de production déclare ses exigences de support et de qualité.

Par exemple, un calcul de THI devra disposer de température et d'humidité compatibles.

La présence d'une température disponible ne suffit pas pour calculer le THI.

Le moteur devra être extensible aux futures productions sans modification des règles générales.

## 6. Phase 4 — Propager les informations dans toute l'application

C'est la phase la plus importante.

Ne pas se contenter de créer un nouveau modèle théorique.

Le contrat doit être réellement utilisé par les principales chaînes de lecture et de calcul.

### A. Données historiques

Faire circuler les informations de couverture, support et provenance depuis les archives ERA5-Land existantes.

Pour une PRA partielle, conserver séparément :

- Sa valeur sur portion renseignée, si disponible.
- Sa fraction de couverture.
- Son statut de qualification.
- La valeur éventuellement qualifiée pour restitution territoriale.
- Les raisons d'indisponibilité pour les autres usages.

Ne pas inventer de valeur lorsque la source ne fournit pas de support exploitable.

### B. Prévisions nationales

Préserver les métadonnées propres à AROME, ARPEGE et IFS.

Ne pas confondre couverture numérique et représentativité terrestre.

Conserver le comportement actuel pour les données complètes et améliorer la propagation des limitations pour les supports partiels.

### C. Calculateurs agroclimatiques

Intégrer progressivement la politique commune aux calculateurs.

Le calcul scientifique doit recevoir une entrée qualifiée et restituer une sortie porteuse des mêmes informations.

En particulier, vérifier la cohérence entre :

- Le moteur générique `calculateObserved`.
- Le calcul blé `wheat-descriptive-2.0.0`.
- Les synthèses nationales du blé.
- Le registre des contributeurs du Journal.

Ne pas modifier silencieusement la signification d'une ancienne version de calcul.

Si une règle change, créer une version nouvelle et traçable.

Les résultats historiques doivent rester reproductibles.

### D. Explorateur climatique

La carte doit pouvoir représenter :

- Une valeur qualifiée pour toute la PRA.
- Une valeur disponible seulement sur le support observé, explicitement distinguée.
- Une valeur indisponible.
- Une valeur nulle valide.

Conserver les contours officiels complets des 713 PRA.

Ne pas découper artificiellement les polygones officiels pour cacher les surfaces manquantes.

Les zones partielles doivent être reconnaissables, par une trame, un liseré ou un autre traitement cohérent avec la charte graphique existante.

Ne pas entreprendre une nouvelle refonte UX.

### E. Analyse agroclimatique

Vérifier que les indicateurs peuvent consommer les données qualifiées compatibles avec leurs exigences.

Les indicateurs qui exigent un support complet doivent continuer à refuser les supports partiels.

Les autres pourront utiliser une estimation qualifiée ou une valeur sur support observé selon leur politique documentée.

### F. Veille nationale

Le moteur de détection doit distinguer :

- Phénomène détecté sur support qualifié.
- Phénomène identifié seulement sur support partiel.
- Donnée insuffisante.
- Donnée absente.

Ne pas assimiler les PRA dont la donnée n'est pas évaluable à des PRA sans événement.

Les effectifs nationaux et régionaux doivent indiquer des dénominateurs cohérents.

### G. Journal agroclimatique

La carte PRA dynamique du Journal doit consommer les mêmes statuts que les autres cartes.

Les trois chiffres clés, les focus régionaux et les rubriques de production doivent utiliser les résultats effectivement éligibles à la publication.

Un événement sur support partiel ne doit pas devenir un fait territorial généralisé sans qualification.

Les éléments de qualité doivent rester accessibles dans les preuves, sans surcharger la une.

Conserver le design et la structure du Journal T32B.

## 7. Phase 5 — Recette nationale réelle des 713 PRA

Effectuer une campagne de validation sur les données existantes.

Tester au minimum :

- Les 713 PRA.
- Les six PRA corses.
- Les 68 PRA historiquement incomplètes sous ERA5-Land.
- Crozon.
- La Hague.
- Les littoraux méditerranéens.
- Plusieurs PRA intérieures de référence.
- Les territoires montagneux.

Utiliser différentes fenêtres temporelles :

- Une journée historique complète.
- Une fenêtre historique de sept jours.
- Une fenêtre historique de trente jours, lorsque disponible.
- Une journée prévisionnelle.
- La période prévisionnelle J+1 à J+7.

Ne pas prétendre qu'une fenêtre est complète lorsque certaines journées manquent.

Créer une matrice par PRA, variable, période et usage.

Elle devra distinguer :

1. Support complet.
2. Support partiel avec valeur descriptive.
3. Estimation qualifiée.
4. Valeur non évaluable.
5. Absence réelle de donnée.

### Comparaison avant/après

Fournir au minimum :

- Nombre de PRA avec support complet.
- Nombre avec support partiel.
- Nombre avec estimation qualifiée.
- Nombre avec valeur descriptive sur support observé.
- Nombre non évaluables.
- Nombre totalement dépourvues de données.

Comparer ces résultats pour :

- L'explorateur climatique.
- Les indicateurs blé.
- La veille nationale.
- La carte du Journal.

Les nombres ne doivent pas être déclarés identiques si les règles de qualité des différents usages ne le permettent pas.

### Contrôles indépendants

Comparer les nouveaux résultats avec les anciens calculs sur des PRA complètes.

Ces résultats doivent rester inchangés, sauf correction justifiée et versionnée.

Sur les supports partiels, vérifier indépendamment la méthode de pondération, la couverture et le résultat restitué.

Vérifier que les données manquantes ne deviennent jamais zéro.

## 8. Phase 6 — Assurer la robustesse quotidienne

Je souhaite que le problème de couverture ne réapparaisse pas chaque fois que nous ajoutons un indicateur.

Construire une supervision transversale.

Prévoir des contrôles automatiques sur :

- Le nombre de PRA couvertes par variable et source.
- La complétude temporelle.
- La cohérence des supports.
- Les changements inattendus de couverture.
- La disponibilité de chaque journée.
- Les anomalies de traitement.
- Les résultats publiables par famille d'indicateurs.

Conserver des traces légères, avec date, identité de cycle et motifs d'indisponibilité.

Le contrôle doit notamment détecter :

- Une chute soudaine du nombre de PRA qualifiées.
- Une rupture de support.
- Une série historique discontinue.
- Une acquisition incomplète.
- Une mauvaise interprétation de métadonnées.
- Une divergence entre les valeurs d'une carte et celles de l'API.

Préparer des contrôles exécutables dans les workflows existants.

Ne pas modifier les crons ni activer de nouveaux workflows quotidiens dans cette tâche.

La future chaîne éditoriale devra publier chaque matin à 6 h 30, heure de Paris. Préparer les informations nécessaires à sa supervision sans tenter de mettre en œuvre cette programmation maintenant.

## 9. Place future de SAFRAN

La PR #63 contient un pilote réel de SAFRAN/SIM.

Ses principaux résultats sont :

- 675 PRA avec support historique complet.
- 38 supports partiels.
- Aucune PRA totalement dépourvue de support numérique.
- 60 journées réelles disponibles dans le pilote.
- Une amélioration notable de la couverture littorale.

Ces résultats rendent SAFRAN intéressant.

Mais je ne souhaite pas introduire prématurément une deuxième chaîne climatique active si l'utilisation raisonnée des données existantes permet déjà un service satisfaisant.

Pour cette tâche :

1. Examiner les conclusions de COUV-01.
2. Évaluer les avantages architecturaux de SAFRAN.
3. Identifier les limites qui resteraient à lever.
4. Comparer cette stratégie avec une meilleure exploitation des supports ERA5-Land existants.
5. Préparer un contrat d'adaptateur compatible avec une future source alternative si nécessaire.

Ne pas fusionner la branche COUV-01.

Ne pas modifier le pipeline opérationnel pour basculer les données historiques vers SAFRAN.

Ne pas mélanger les séries climatiques ERA5-Land et SAFRAN.

Produire une recommandation argumentée pour décider ultérieurement de l'intégration éventuelle de SAFRAN.

## 10. Architecture modulaire et évolutivité

Cette tâche doit réduire la dette technique, pas l'augmenter.

Je souhaite une architecture dans laquelle :

- Les fournisseurs climatiques sont indépendants.
- Le contrat de qualité est commun.
- Les politiques d'usage sont déclarées par indicateur.
- Les calculateurs ne connaissent pas les particularités de chaque fournisseur.
- Les cartes utilisent des états de qualité partagés.
- Les nouvelles productions réutilisent les mêmes contrats.
- Les nouvelles sources peuvent être intégrées par adaptateur.
- Les règles scientifiques sont versionnées.
- Les anciens résultats restent reproductibles.

Éviter les exceptions dispersées comme :

`if PRA == Crozon`

ou :

`if source == ERA5 then special case`

Préférer des règles déclaratives fondées sur la qualité réelle du support et de la donnée.

Ne pas construire un framework excessivement abstrait. Privilégier une architecture simple, testable et réutilisable.

## 11. Contraintes de performance et de coût

Préserver l'objectif d'hébergement gratuit ou très économique.

Ne pas déclencher de calcul national complet lors de chaque visite utilisateur.

Réutiliser les caches et archives existants.

Les nouvelles informations de qualité doivent être compactes.

Les données nationales doivent pouvoir être préparées une fois par cycle, puis consommées par toutes les rubriques.

Mesurer :

- Le temps de calcul.
- La mémoire.
- La taille des réponses.
- Le coût supplémentaire de validation.
- L'impact sur le rendu cartographique.

Ne pas ajouter de service payant ni de nouvelle dépendance majeure sans justification.

## 12. Tests et critères d'acceptation

La tâche sera considérée comme réussie si :

1. Une politique de couverture commune est définie et documentée.
2. Les supports partiels sont correctement distingués des données absentes.
3. Les valeurs sur supports partiels restent disponibles pour les usages autorisés.
4. Les moyennes et cumuls compatibles peuvent utiliser des estimations qualifiées lorsqu'elles satisfont les règles.
5. Les extrêmes et événements gardent leurs réserves spécifiques.
6. Les normales et anomalies conservent leurs contrôles stricts.
7. Les indicateurs blé respectent le contrat commun.
8. Les explorateurs, la veille et le Journal utilisent des statuts de qualité cohérents.
9. Les 713 géométries PRA restent accessibles.
10. Les chiffres de couverture sont calculés sur des données réelles.
11. Les valeurs natives existantes ne sont pas modifiées silencieusement.
12. Les résultats sont reproductibles et traçables.
13. Le système fonctionne avec les historiques et prévisions actuellement disponibles.
14. La future intégration de SAFRAN peut se faire par adaptateur.
15. Les performances restent compatibles avec les ressources actuelles.
16. Les tests scientifiques, TypeScript, Python, build, lint et sécurité passent.
17. Les tests navigateur confirment le comportement sur plusieurs PRA littorales et intérieures.
18. Aucune nouvelle dette technique majeure ni duplication des calculateurs n'est introduite.

### Critère supplémentaire important

Ne pas considérer la tâche réussie sur la seule création d'un contrat ou de tests unitaires synthétiques.

**Je veux voir la différence réellement produite dans les différentes rubriques de l'application, avec des chiffres avant/après et des exemples vérifiés.**

Lorsque les données restent insuffisantes, documenter précisément pourquoi.

## 13. Documentation et livrables

Créer :

`docs/codex/CORE-01/`

Avec :

**`ARCHITECTURE.md`**

Architecture commune des supports climatiques, des contrats de qualité et des adaptateurs.

**`CURRENT_POLICIES_AUDIT.md`**

Inventaire des règles existantes et des divergences entre les modules.

**`COVERAGE_POLICY.md`**

Politiques d'éligibilité par famille d'indicateurs, y compris les critères de qualité et la gestion des supports partiels.

**`NATIONAL_VALIDATION.md`**

Résultats réels sur les 713 PRA, comparaisons avant/après et tests indépendants.

**`APPLICATION_INTEGRATION.md`**

Propagation dans Climat, Analyse agroclimatique, Veille nationale et Journal.

**`SAFRAN_DECISION.md`**

Analyse des apports potentiels de SAFRAN et recommandation pour une intégration future éventuelle.

**`DAILY_MONITORING.md`**

Contrôles de qualité et stratégie de supervision quotidienne.

**`ACCEPTANCE.md`**

Résultats des tests, performances, captures et limitations.

Produire des preuves numériques vérifiables et des captures des cartes avant/après lorsque des différences réelles sont obtenues.

## 14. Mode d'exécution demandé

Je souhaite une tâche complète et autonome.

Procéder dans cet ordre :

1. Auditer les règles de couverture existantes.
2. Identifier les divergences légitimes et les véritables défauts de propagation.
3. Concevoir le contrat de qualité partagé.
4. Définir les politiques scientifiques par famille d'indicateurs.
5. Implémenter progressivement les adaptations nécessaires.
6. Vérifier les calculateurs, notamment le blé tendre.
7. Tester la propagation jusqu'aux cartes, à la veille et au Journal.
8. Réaliser une recette réelle sur les 713 PRA.
9. Mesurer les performances et vérifier les non-régressions.
10. Documenter les résultats et les limites.
11. Ouvrir une PR draft.

Ne pas interrompre le travail après le seul audit ou la conception des contrats.

Ne pas demander une validation intermédiaire pour chaque sous-étape.

Si une acquisition ou une modification de données distantes exige une autorisation particulière, rester en lecture seule et documenter les étapes nécessaires.

Ne pas masquer une impossibilité scientifique ou technique.

## 15. Livraison attendue

Ouvrir une PR draft dédiée à CORE-01.

Ne pas merger automatiquement.

Présenter :

1. Le diagnostic des divergences de couverture.
2. L'architecture commune retenue.
3. Les modifications effectuées.
4. La politique scientifique appliquée aux supports partiels.
5. Les chiffres réels de couverture avant/après.
6. Les conséquences sur les indicateurs blé.
7. Les conséquences sur les cartes et le Journal.
8. Les résultats des tests indépendants.
9. Les performances et ressources.
10. La recommandation sur SAFRAN.
11. Les limitations restantes.
12. Les éventuelles étapes complémentaires avant de reprendre T33 et AGRO-02.

### Critère de réussite final

**Je veux qu'AgriClimaX dispose d'une infrastructure climatique cohérente et durable, où la qualité des données est qualifiée une seule fois puis propagée correctement à tous les usages.**

Je souhaite pouvoir ajouter demain une nouvelle production, un nouvel indicateur ou une nouvelle source climatique sans devoir recommencer le travail de qualification des PRA littorales.

Une PRA partiellement couverte ne doit plus disparaître inutilement des analyses lorsqu'une exploitation scientifiquement défendable de ses données existe.

Mais aucune valeur ou interprétation ne doit être publiée au-delà de ce que permettent réellement les données disponibles.

La priorité est la robustesse, la traçabilité, l'évolutivité et la cohérence de l'ensemble du logiciel.

**Ne pas merger. Livrer une PR draft complète, testée, documentée et accompagnée de preuves réelles.**
