# TASK 33 — AgriClimaX : intelligence temporelle, Almanach agricole et préparation de la conférence de rédaction IA

## 1. Mission et vision produit

Tu travailles sur le dépôt GitHub `Mehdi-Sine/agriclimax`.

Partir du dernier `origin/main`, intégrant notamment :

- T31 : fondations du Journal agroclimatique.
- T32/T32B : refonte éditoriale et carte nationale dynamique des 713 PRA.
- AGRO-01 : dix indicateurs descriptifs blé fiabilisés.
- CORE-01 : contrat commun de qualité et de couverture climatique.
- DATA-01 : restauration d'un historique de trente jours.
- OPS-01/OPS-01B : supervision opérationnelle.
- T34 : collecte, qualification et rapprochement des actualités agricoles.

Créer la branche :

`codex/33-editorial-temporal-intelligence`

### Ambition générale

Je souhaite transformer AgriClimaX en véritable observatoire intelligent de l'actualité agroclimatique française.

Le Journal ne doit plus simplement présenter les phénomènes dépassant des seuils météorologiques.

Il doit progressivement devenir capable de comprendre :

- Ce qui se passe actuellement.
- Ce qui change par rapport aux jours précédents.
- Ce qui constitue un épisode climatique persistant.
- Quels territoires sont particulièrement concernés.
- Quelles productions agricoles pourraient être sensibles à la situation.
- Pourquoi cette situation mérite, ou non, d'être racontée.
- Ce que le calendrier agricole habituel nous invite à surveiller.
- Ce que les publications des instituts techniques et de la presse agricole apportent comme contexte.

Je veux que le Journal soit construit comme une véritable **Data Story agricole et climatique**, destinée à un décideur national, un ingénieur agronome, un conseiller ou un agriculteur.

**La Task 33 doit construire le moteur d'intelligence éditoriale déterministe qui préparera les analyses et les sujets destinés au futur rédacteur en chef IA de T35.**

Ne pas intégrer encore l'API OpenAI.

Ne pas refaire le design de la page Journal.

Ne pas modifier les calculs scientifiques existants sans nécessité démontrée.

## 2. Les quatre sources d'intelligence à rapprocher

Le moteur doit exploiter quatre familles d'informations indépendantes.

### A. Les données climatiques réelles

Utiliser les archives et les API existantes :

- Données historiques ERA5-Land.
- Prévisions Météo-France AROME/ARPEGE et autres sources déjà qualifiées.
- Historique quotidien disponible.
- Indicateurs climatiques nationaux.
- Couverture et qualité des 713 PRA.
- Événements issus du moteur de veille nationale.

Respecter les versions et les règles scientifiques de CORE-01.

Ne jamais confondre réanalyse, observation et prévision.

### B. Les indicateurs agroclimatiques par production

Exploiter les indicateurs qualifiés déjà disponibles, notamment pour le blé tendre.

Prévoir une architecture permettant d'accueillir les futures contributions :

- Bovins et THI.
- Maïs.
- Vigne.
- Arboriculture.
- Prairies et fourrages.
- Colza, betteraves et autres productions.

Le moteur doit découvrir les productions et indicateurs via les contrats et catalogues existants, et non via une liste figée de composants.

L'arrivée d'un nouveau contributeur doit pouvoir enrichir les dossiers éditoriaux sans modification du moteur général.

### C. Le nouvel Almanach agricole unifié

Un fichier JSON versionné est fourni avec cette tâche :

`agriclimax_almanach_unique_v1_0.json`

Il constitue l'unique référentiel saisonnier à intégrer.

Version : `almanach-unique-1.0.0`.

Il contient notamment :

- 365 fiches journalières.
- 157 fenêtres agricoles et saisonnières.
- 38 repères fixes et traditions.
- 7 familles d'événements mobiles.
- 13 profils régionaux.
- 47 références documentaires.
- 33 signaux climatiques ou agroclimatiques.
- Les règles éditoriales, statuts de qualité et arbitrages scientifiques.

Une note de consolidation et d'intégration est également fournie.

**IMPORTANT : ne pas réinventer cet Almanach, ne pas recopier une seconde base indépendante et ne pas remplacer silencieusement son contenu.**

Importer le JSON fourni dans un emplacement versionné du dépôt, par exemple :

`config/almanach/agriclimax-almanach.v1.json`

Conserver le fichier maître complet, sa version, sa provenance et son empreinte SHA-256.

Les vues quotidiennes, régionales et par production doivent être dérivées de ce référentiel.

Si le fichier joint n'est pas accessible à l'environnement Codex, signaler ce blocage explicitement. Ne pas générer un calendrier de remplacement approximatif.

### D. Les actualités agricoles de T34

Réutiliser le moteur documentaire fusionné avec la PR #67.

Il fournit le contrat :

`EditorialNewsBundle`, version `editorial-news-1`.

Examiner notamment :

- `engine/src/agriclimax/news/`
- `config/news/sources.v1.json`
- `docs/codex/task34/editorial-news-1.schema.json`

Les publications peuvent alimenter le contexte éditorial selon leur date, production, région, thème et source.

Ne pas confondre un rapprochement documentaire avec une confirmation scientifique.

Ne pas recopier intégralement les articles protégés.

Ne pas réécrire ni remplacer le moteur de collecte T34.

## 3. Chantier principal : construire l'intelligence temporelle

C'est le cœur scientifique de la tâche.

### 3.1. Analyser les évolutions climatiques

Exploiter les séries journalières réellement accessibles afin d'identifier, lorsque les données le permettent :

- Apparition d'un phénomène.
- Persistance.
- Intensification.
- Atténuation.
- Extension spatiale.
- Réduction spatiale.
- Fin d'un épisode.
- Situation stable.
- Évolution indéterminée.

Étudier des horizons de 3, 7, 14 et 30 jours.

Ne pas supposer que tous ces horizons sont immédiatement disponibles.

L'historique récupéré par DATA-01 comprend trente journées réelles du 1er au 30 octobre 2026, avec une couverture complète de 645 PRA et des limitations pour les autres.

Un historique de trente jours peut permettre de caractériser la durée d'un épisode. En revanche, comparer deux fenêtres indépendantes de trente jours nécessite jusqu'à soixante jours de données compatibles.

Ne jamais présenter un tel comparatif comme validé lorsqu'il n'est pas calculable.

### 3.2. Réutiliser le comparateur existant

Examiner :

`apps/web/features/journal/history.ts`

Ce module comporte déjà des états d'évolution et une vérification des compatibilités.

Le moteur T31 renvoie souvent `insufficient_history`.

Je souhaite que T33 complète cette architecture par un véritable adaptateur de données historiques qualifiées.

Ne pas remplacer le comparateur par des heuristiques simplistes.

Respecter notamment :

- Continuité des dates.
- Identité des supports spatiaux.
- Compatibilité des variables.
- Homogénéité des modèles.
- Nature de la source.
- Unités.
- Versions des règles de calcul.
- Fenêtres temporelles.
- Fraîcheur et complétude.

Une comparaison impossible doit produire un état explicite, pas une tendance fictive.

### 3.3. Distinguer évolution observée et révision des prévisions

C'est fondamental.

Deux prévisions issues de cycles successifs peuvent être comparées comme **révisions de prévision**, mais cela ne prouve pas qu'un phénomène météorologique s'est réellement intensifié.

Le moteur doit distinguer :

- Évolution sur historique homogène.
- Révision des prévisions.
- Comparaison non homologable.
- Événement détecté sans historique suffisant.

Aucune formulation de tendance observée ne doit être issue d'une simple comparaison de deux cycles prévisionnels.

## 4. Construire une mémoire des épisodes agroclimatiques

Je souhaite que le Journal puisse progressivement suivre les épisodes dans le temps.

Par exemple :

- Une séquence sans pluie qui se prolonge.
- Un épisode de gel persistant.
- Une période de températures élevées.
- Un retour significatif des précipitations après plusieurs journées sèches.
- Une période humide persistante.
- Une modification de l'extension territoriale d'un phénomène.

### Architecture souhaitée

Créer un modèle `ClimateEpisode` ou équivalent.

Il pourrait comprendre :

- Identifiant stable.
- Phénomène.
- Nature de la source.
- Date de début documentée.
- Date de fin documentée ou statut en cours.
- Période analysée.
- Territoires et PRA concernés.
- Régions administratives.
- Intensité descriptive.
- Durée qualifiée.
- Évolution documentée.
- Qualité et provenance.
- Historique des observations de l'épisode.
- Identifiants des faits.
- Limitations.
- Version de l'algorithme.

Ne pas déduire une continuité simplement parce qu'un événement de même catégorie apparaît à deux dates différentes.

Prévoir une méthode explicite de rapprochement entre épisodes, basée sur des critères temporels, spatiaux et scientifiques.

Distinguer les épisodes historiques observés des événements prévisionnels.

Le modèle doit rester extensible.

### Gestion des événements non démontrés

Une séquence sans pluie météorologique n'est pas automatiquement une sécheresse agricole.

Des températures élevées ne démontrent pas un dommage.

La présence d'une culture dans une PRA ne prouve pas son stade.

Les épisodes doivent être qualifiés selon ce qui est réellement mesuré.

## 5. Intégrer l'Almanach agricole comme guide éditorial

### 5.1. Créer un résolveur saisonnier

Développer un service du type :

`getSeasonalEditorialContext(date, region?, production?)`

Il doit permettre de retrouver :

- Les fenêtres agricoles actives à une date.
- Les productions concernées.
- Les régions indicatives.
- Les sujets saisonniers possibles.
- Les questions agronomiques à examiner.
- Les indicateurs climatiques à confronter.
- Les sources documentaires.
- Les traditions ou événements particuliers.
- Les réserves scientifiques.
- Les niveaux de qualification et besoins de relecture.

Le résultat doit être structuré, léger et déterministe.

Ne jamais injecter le JSON complet dans chaque dossier éditorial.

### 5.2. Respecter les particularités du référentiel

Analyser les collections réelles du fichier :

- `meta`
- `jours`
- `fenetres`
- `reperes_fixes`
- `evenements_mobiles`
- `profils_regionaux`
- `sources`
- `regles_editoriales`
- `dictionnaire_signaux`
- `contextes_mensuels_complementaires`
- `vigilances_reglementaires`
- `modele_qualite`
- `corrections_et_arbitrages`

Certaines références `fenetre_id` des journées peuvent pointer vers des alias `MARR-MM-DD`, correspondant à des repères fixes plutôt qu'à des fenêtres culturales.

Résoudre ces relations correctement.

Valider les identifiants, références croisées et intervalles, y compris les fenêtres traversant le 31 décembre.

### 5.3. Gestion du calendrier

L'Almanach est perpétuel sur 365 jours.

Prévoir :

- Le 29 février des années bissextiles.
- Les événements mobiles recalculés pour l'année concernée.
- Les fêtes calculées à partir de Pâques.
- Les événements astronomiques dont la date varie, uniquement avec un calcul ou une source vérifiable.
- Le fuseau Europe/Paris pour les dates éditoriales.

Ne pas affecter artificiellement au 29 février des traditions datées du 28 février.

Une journée supplémentaire peut hériter de fenêtres saisonnières compatibles sans inventer de repère fixe.

### 5.4. Utilisation scientifique de l'Almanach

L'Almanach propose des questions, jamais des faits constatés.

Exemple :

Le 25 août, le calendrier évoque la période d'implantation du colza dans plusieurs bassins.

Si le moteur climatique détecte un retour de pluie après une période sèche, il peut proposer :

« Les dernières précipitations modifient-elles les conditions météorologiques d'implantation du colza ? »

Il ne doit pas affirmer :

« Les agriculteurs ont semé leur colza grâce au retour des pluies. »

Cette dernière affirmation exigerait des données de terrain.

### 5.5. Préserver les niveaux de qualification

Le référentiel contient des fenêtres indicatives et des ajouts exploratoires `VEG-*`, notamment en maraîchage.

Ils doivent rester identifiés comme nécessitant une relecture technique.

Les dictons, traditions et fêtes rurales relèvent du patrimoine culturel, pas de la prédiction météorologique.

Les vigilances réglementaires doivent rester exclues d'une publication automatique en tant que prescription, tant que les textes applicables, l'année et les dérogations locales n'ont pas été vérifiés.

Aucune simple date du calendrier ne peut déclencher une alerte climatique, agronomique ou réglementaire.

## 6. Territorialiser l'intelligence éditoriale

La France entière constitue la principale échelle éditoriale du Journal.

Les analyses doivent ensuite privilégier les treize régions administratives métropolitaines, Corse comprise.

La PRA reste l'unité de calcul et de cartographie.

### Règles

- Calculer et conserver les résultats à la maille PRA.
- Raconter prioritairement les situations à l'échelle nationale ou régionale.
- Citer une PRA nommément si un événement localisé le justifie.
- Respecter les limites géographiques et agricoles des données.
- Ne jamais confondre proportion de PRA et proportion de surfaces agricoles.
- Ne pas créer de moyenne nationale ou régionale non pondérée injustifiée.

L'Almanach contient treize profils régionaux.

Ces profils sont indicatifs. Ils doivent orienter les recherches éditoriales, sans prétendre que chaque production est présente ou au même stade dans toutes les PRA d'une région.

Conserver les métadonnées permettant au futur moteur IA d'expliquer pourquoi une région ou une production est proposée.

## 7. Construire un moteur de propositions éditoriales

À partir des événements climatiques, des tendances et de l'Almanach, créer un système de génération de sujets candidats.

Ce moteur ne doit pas encore rédiger les articles.

Il doit produire une sélection explicable de sujets potentiellement intéressants pour le Journal.

### Exemples de sujets

- Une séquence sèche commence à s'installer dans plusieurs bassins.
- Des pluies sont prévues après une période sèche pendant une fenêtre habituelle d'implantation.
- Les températures baissent au moment où certains systèmes maraîchers restent sensibles au froid.
- Les températures élevées concernent plusieurs territoires d'élevage.
- Une évolution climatique documentée coïncide avec une fenêtre importante de récolte.

Ces exemples ne doivent pas être publiés comme faits sans données correspondantes.

### Critères de sélection

Proposer une hiérarchisation fondée sur :

1. Solidité et fraîcheur des faits.
2. Réalité de l'évolution temporelle.
3. Étendue territoriale documentée.
4. Intensité pertinente dans sa propre unité.
5. Persistance de l'événement.
6. Intérêt agronomique plausible et documenté.
7. Concordance avec une fenêtre saisonnière.
8. Apport éventuel des publications de T34.
9. Originalité par rapport aux sujets déjà proposés.
10. Diversité des régions et productions.

Ne pas construire un score scientifique unique en additionnant arbitrairement des températures, des millimètres de pluie et des jours de séquence.

Une grille de hiérarchisation éditoriale peut être utilisée, si elle est explicable et strictement distincte d'un score de risque agronomique.

Le moteur doit pouvoir proposer plusieurs sujets concurrents plutôt qu'imposer artificiellement une seule une.

Une journée calme doit produire un résultat sobre, éventuellement un sujet saisonnier de fond clairement présenté comme tel.

## 8. Intégrer les actualités de T34

Créer un adaptateur de rapprochement entre les sujets candidats et les publications du contrat `EditorialNewsBundle`.

Le rapprochement doit utiliser les métadonnées disponibles :

- Date.
- Région.
- Production.
- Phénomène.
- Thème.
- Origine et nature de la publication.
- Limites et niveau de qualification.

Ne pas inventer de concordance lorsque les critères ne sont pas remplis.

Le pilote T34 a identifié 130 publications, dont 17 utiles au contexte, mais aucune concordance contemporaine complète confirmée avec les événements testés.

Il est donc acceptable que certains dossiers éditoriaux n'aient aucune publication associée.

Les articles de presse et les bulletins techniques doivent être accompagnés de leurs URL, sources et dates.

Le moteur doit distinguer :

- Source technique apportant un éclairage.
- Publication décrivant une observation locale.
- Publication simplement liée à la saison.
- Rapprochement documentaire faible.
- Source non pertinente.

Ne pas transformer une publication externe en mesure climatique AgriClimaX.

## 9. Créer le dossier quotidien pour le futur comité de rédaction IA

C'est le livrable central de T33.

Créer un contrat versionné, par exemple :

`EditorialBriefingBundle`

Il devra pouvoir être généré en batch pour une édition donnée.

### Contenu attendu

**Identité**

- Date éditoriale.
- Cycle climatique.
- Fenêtre de validité.
- Versions des moteurs.
- Version de l'Almanach.
- Identité du lot documentaire.
- Empreintes.
- Fraîcheur des données.

**Situation nationale**

- Faits climatiques importants.
- Phénomènes retenus.
- Tendances validées.
- Épisodes en cours.
- Couverture et qualité des résultats.
- Réserves.

**Sujets candidats**

Pour chaque sujet :

- Identifiant.
- Proposition de titre ou angle, sans affirmation non prouvée.
- Question éditoriale.
- Phénomène.
- Régions.
- Productions.
- Éléments temporels.
- Identifiants des preuves.
- Sources associées.
- Informations manquantes.
- Limites scientifiques.
- Justification de sa pertinence.
- Statut de qualification.

**Contexte saisonnier**

- Fenêtres de l'Almanach.
- Repères du jour.
- Questions agronomiques associées.
- Sources.
- Niveau de vérification.

**Contexte documentaire**

- Publications pertinentes de T34.
- Liens originaux.
- Dates.
- Nature des rapprochements.

**Propositions pour le Journal**

- Plusieurs sujets possibles pour la une.
- Éclairages régionaux.
- Éclairages par production.
- Sujets de fond possibles.
- Suggestions de cartes ou graphiques, uniquement parmi les données disponibles.
- Faits à vérifier avant rédaction.

### Principes fondamentaux

Ne pas confondre proposition de sujet et fait publié.

Chaque affirmation factuelle doit pouvoir être rattachée à une preuve.

La future IA devra pouvoir lire ce dossier sans accès libre aux bases climatiques.

Construire un résultat compact, borné et structuré, adapté à un appel API économique.

Ne pas envoyer les 713 séries PRA ni le référentiel complet à une future IA.

Le dossier doit être reproductible pour une date et des versions de sources données.

## 10. Préparer l'archivage et le batch éditorial

Le futur Journal doit être disponible chaque matin à 6 h 30, heure de Paris.

T33 ne doit pas encore activer ce calendrier.

En revanche, prévoir un traitement capable de :

1. Lire un cycle climatique qualifié.
2. Lire les indicateurs disponibles.
3. Comparer les historiques compatibles.
4. Reconstruire les épisodes.
5. Interroger l'Almanach du jour.
6. Lire le dernier lot documentaire T34 compatible.
7. Générer les sujets candidats.
8. Valider les références et preuves.
9. Produire un dossier éditorial versionné.
10. Préparer son archivage.

La génération doit être déterministe et idempotente pour des entrées identiques.

Un ancien dossier doit rester consultable et reproductible.

Prévoir une commande CLI de génération et de validation permettant un fonctionnement en batch.

Privilégier les outils et stockages existants.

Ne pas ajouter de nouveau cron ou de service payant.

Ne pas écrire dans la production sans autorisation.

Si les données ne sont pas disponibles, produire un diagnostic explicite et ne pas inventer un dossier complet.

## 11. Ajouter une page Almanach discrète dans AgriClimaX

Je souhaite également rendre le référentiel consultable par l'utilisateur.

Créer une page :

`/almanach`

Cette page doit rester secondaire dans la navigation.

Conserver l'identité graphique du Journal, sans lancer une nouvelle refonte UX.

### Fonctionnalités

- Consultation des douze mois.
- Navigation par jour.
- Sélection d'une date.
- Affichage des sujets saisonniers.
- Filtre par production.
- Filtre par région administrative.
- Présentation des repères traditionnels.
- Présentation des sources et réserves.
- Liens vers les rubriques pertinentes d'AgriClimaX lorsque disponibles.

Le lecteur doit comprendre qu'il s'agit d'un calendrier théorique et documentaire.

La page ne doit pas afficher les fenêtres comme des observations de l'année.

Si un événement est mobile, il doit être replacé sur la bonne date de l'année consultée.

La page doit être responsive, accessible et légère.

Ne pas charger l'intégralité des métadonnées et sources si cela dégrade inutilement les performances.

**Priorité à la qualité du moteur de T33 : la page Almanach doit rester simple.**

## 12. Scénarios de validation éditoriale

Ne pas se contenter de tests techniques.

Je veux plusieurs démonstrations à partir de données réelles archivées.

Tester au minimum :

### Scénario A — Épisode historique documenté

Reconstituer un phénomène sur une série de journées réellement disponibles.

Vérifier sa durée, son évolution, ses territoires et ses limitations.

### Scénario B — Prévisions successives

Comparer deux cycles prévisionnels compatibles.

Vérifier que le résultat parle de révision des prévisions et non d'évolution observée.

### Scénario C — Almanach et événement concordant

Identifier un cas où un signal climatique vérifié coïncide avec une fenêtre saisonnière.

Produire une proposition éditoriale justifiée.

### Scénario D — Almanach sans événement

Choisir une journée pour laquelle aucun événement marquant n'est démontré.

Le moteur doit pouvoir proposer un sujet documentaire sobre ou ne retenir aucun sujet prioritaire.

### Scénario E — Actualité externe

Tester un rapprochement réel avec une publication T34.

Si aucune publication récente ne correspond, conserver cette absence et documenter le résultat.

### Scénario F — Données insuffisantes

Tester une PRA à support partiel et Crozon lorsqu'aucune donnée native n'existe.

Vérifier l'absence de fausse tendance et de conclusion agricole.

### Scénario G — Almanach perpétuel

Tester :

- 28 et 29 février.
- 1er mars.
- 31 décembre et 1er janvier.
- Pâques sur plusieurs années.
- Saints de glace.
- Une fenêtre culturale régionale.
- Une fenêtre maraîchère `VEG-*` non encore validée.

Les fixtures synthétiques peuvent servir aux tests unitaires, mais toutes les démonstrations présentées comme réelles doivent provenir d'archives vérifiées.

## 13. Exigences d'architecture et de qualité

Le moteur doit rester :

- Scientifiquement rigoureux.
- Modulaire.
- Extensible.
- Versionné.
- Reproductible.
- Indépendant de l'interface graphique.
- Compatible avec les futures productions.
- Compatible avec la future rédaction IA.
- Économe en ressources.

Préserver les règles CORE-01 sur les supports partiels.

Ne pas introduire d'heuristiques opaques pour masquer un historique insuffisant.

Ne pas faire passer une règle éditoriale pour une loi agronomique.

Respecter le stockage et les contrats existants.

Ne pas dupliquer les fonctions déjà fournies par T31, T34 et DATA-01.

Vérifier les interfaces TypeScript et Python.

Prévoir les contrats de données partagés nécessaires, avec validation runtime stricte.

Les évolutions de contrats doivent être additives ou versionnées.

Le moteur ne doit pas provoquer de recalcul national lors de chaque ouverture du Journal.

## 14. Hors périmètre

Ne pas :

- Appeler l'API OpenAI.
- Rédiger automatiquement les articles définitifs.
- Publier une édition IA en production.
- Modifier les horaires des workflows.
- Réécrire le collecteur T34.
- Ajouter une nouvelle source climatique.
- Modifier les calculateurs blé ou bovins.
- Refaire les composants cartographiques.
- Construire un modèle de rendement ou de dommage agricole.
- Déclarer des stades phénologiques observés à partir des seules dates.
- Fusionner la PR expérimentale COUV-01 #63.

Ces fonctions seront traitées ultérieurement, notamment par T35 et AGRO-02.

## 15. Documentation obligatoire

Créer :

`docs/codex/task33/`

Avec les documents suivants :

**`ARCHITECTURE.md`**

Architecture des quatre sources d'intelligence et des services de traitement.

**`ALMANAC_INTEGRATION.md`**

Import, structure, validation, résolution des dates, régions, productions et règles scientifiques.

**`TEMPORAL_INTELLIGENCE.md`**

Méthodes de comparaison, contraintes de comparabilité et critères de continuité des épisodes.

**`EPISODE_MEMORY.md`**

Identification, durée, évolution, rapprochement et archivage des épisodes.

**`EDITORIAL_SELECTION.md`**

Règles de proposition et de hiérarchisation des sujets, avec justification.

**`EDITORIAL_BRIEFING_CONTRACT.md`**

Contrat détaillé du dossier quotidien destiné à T35.

**`NEWS_INTEGRATION.md`**

Rapprochement des publications T34 et distinction entre document et preuve.

**`REAL_CASES.md`**

Démonstrations à partir des archives réelles disponibles.

**`PERFORMANCE.md`**

Temps de traitement, mémoire, volume des dossiers et coût prévisionnel du batch.

**`ACCEPTANCE.md`**

Tests, résultats, limites et verdict de préparation pour T35.

Conserver des exemples JSON de dossiers éditoriaux réellement générés.

## 16. Critères de réussite

La Task 33 sera considérée comme réussie si :

1. Le JSON de l'Almanach est intégré comme référentiel unique versionné.
2. Les 365 journées sont consultables et les dates mobiles correctement gérées.
3. Une page `/almanach` simple et fonctionnelle est disponible en Preview.
4. Le moteur retrouve les fenêtres saisonnières par date, production et région.
5. Les contextes non validés ne deviennent pas des faits publiés.
6. Les comparaisons temporelles sont scientifiquement qualifiées.
7. Les épisodes historiques peuvent être suivis lorsqu'une continuité réelle est démontrée.
8. Les prévisions et les observations ne sont jamais confondues.
9. Les indicateurs blé sont exploitables comme contributions qualifiées.
10. Les futures productions disposent d'un point d'intégration générique.
11. Les publications T34 peuvent être rapprochées des sujets candidats.
12. Plusieurs sujets éditoriaux peuvent être proposés et justifiés.
13. Les régions administratives structurent la narration, les PRA restant les unités scientifiques.
14. Les absences de données et situations non comparables restent explicites.
15. Un `EditorialBriefingBundle` complet et validé est produit sur des données réelles disponibles.
16. La génération est déterministe, idempotente et réutilisable en batch.
17. Le dossier est suffisamment compact pour le futur appel IA de T35.
18. Aucune régression n'apparaît sur Climat, Analyse, Veille ou Journal.
19. Les tests TypeScript, Python, lint, build et sécurité passent.
20. La livraison est accompagnée de preuves scientifiques et de captures navigateur.

## 17. Exécution et livraison attendue

Je souhaite une tâche Codex longue, complète et autonome.

Ne pas s'arrêter après l'audit ou la création des contrats.

Enchaîner :

1. Audit des modules existants.
2. Import du référentiel Almanach.
3. Validation et résolveur saisonnier.
4. Intelligence temporelle.
5. Mémoire des épisodes.
6. Rapprochement des indicateurs et actualités.
7. Génération des sujets candidats.
8. Construction du dossier éditorial quotidien.
9. Page Almanach.
10. Tests scientifiques, techniques et éditoriaux.
11. Documentation.
12. Ouverture d'une PR draft.

Créer une PR draft intitulée :

`T33 — Temporal editorial intelligence & Agricultural Almanac`

Ne pas merger automatiquement.

Fournir une Preview de `/almanach` et, si possible, un point d'accès ou un artefact permettant de consulter un dossier éditorial réel.

### Rapport final attendu

Présenter en conclusion :

- Le nombre de journées et fenêtres intégrées.
- Les épisodes réellement détectés.
- Les horizons temporels utilisables.
- Les horizons encore insuffisants.
- Les indicateurs agricoles exploités.
- Les sources T34 rapprochées.
- Trois à cinq exemples concrets de sujets éditoriaux proposés.
- Un exemple complet de dossier destiné à T35.
- Les résultats des tests.
- Les performances.
- Les limitations scientifiques.
- L'URL de Preview.
- Les prochaines étapes nécessaires pour T35.

## 18. Ambition finale

**Je veux que cette tâche fasse passer AgriClimaX d'un Journal qui recense des anomalies ou des franchissements de seuils à un système capable de comprendre le déroulement des saisons agricoles, de suivre les épisodes climatiques et de proposer des sujets éditoriaux pertinents.**

L'Almanach doit donner le contexte de la saison.

Les données doivent démontrer les faits.

Les publications techniques doivent apporter des éclairages complémentaires.

Les évolutions temporelles doivent donner de la profondeur au récit.

Et le dossier éditorial quotidien doit préparer le travail du futur comité de rédaction IA.

Le résultat recherché n'est pas encore un article automatiquement rédigé, mais **la matière structurée, pertinente et fiable qui permettra demain à une IA de produire un véritable journal agroclimatique national**.

Ne pas merger. Livrer une PR draft testée, documentée et accompagnée d'exemples réels.