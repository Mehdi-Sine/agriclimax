# TASK 35 — AgriClimaX : comité de rédaction IA, journal agroclimatique intelligent et archivage des éditions

## 1. Contexte et ambition

Tu travailles sur le dépôt GitHub :

`Mehdi-Sine/agriclimax`

Partir du dernier `origin/main`, après fusion de la PR #69 (Task 33).

Créer une branche :

`codex/35-ai-editorial-journal`

### État du projet

AgriClimaX dispose désormais des briques suivantes :

- Une infrastructure climatique nationale couvrant les 713 petites régions agricoles (PRA) de France métropolitaine et de Corse.
- Des données historiques ERA5-Land et des prévisions météorologiques Météo-France.
- Des contrats de qualité scientifique et de couverture partielle.
- Des indicateurs agroclimatiques qualifiés, notamment dix indicateurs descriptifs pour le blé tendre.
- Une architecture extensible à de nombreuses autres productions.
- Un Journal agroclimatique doté d'une présentation éditoriale et d'une carte dynamique par PRA.
- Un moteur de détection des événements climatiques et de leurs évolutions temporelles.
- Un Almanach agricole perpétuel comprenant 365 journées et 157 fenêtres saisonnières.
- Un dispositif de collecte et de qualification des actualités agricoles (T34).
- Un moteur d'intelligence éditoriale déterministe (T33), produisant des dossiers `EditorialBriefingBundle` versionnés, traçables et compacts.

La Task 33 a démontré la possibilité de combiner ces informations pour proposer des sujets agricoles et climatiques pertinents.

**L'objectif de T35 est de transformer ces dossiers préparatoires en véritables éditions journalistiques grâce à l'API OpenAI.**

Je souhaite faire d'AgriClimaX un média quotidien automatisé de référence sur l'actualité agroclimatique française.

Il doit permettre de comprendre :

- Ce qui se passe actuellement dans le climat français.
- Ce qui change par rapport aux jours précédents.
- Quels phénomènes climatiques ou agroclimatiques sont remarquables.
- Quels territoires sont concernés.
- Quelles productions agricoles pourraient être concernées.
- Comment ces événements s'inscrivent dans le calendrier agricole.
- Ce que rapportent les instituts techniques et la presse agricole.
- Quels phénomènes méritent l'attention des décideurs agricoles nationaux.

Le Journal doit apporter une réelle plus-value analytique et rédactionnelle, et non simplement présenter des indicateurs sous forme de phrases.

**Principe directeur : le comité de rédaction IA choisit, hiérarchise, contextualise et raconte les faits. Il ne produit jamais lui-même les données scientifiques.**

---

## 2. Contraintes structurantes et règles de travail

### 2.1. Un seul appel OpenAI par édition quotidienne

En fonctionnement normal, AgriClimaX doit effectuer **un unique appel à l'API OpenAI pour produire l'ensemble de l'édition nationale du jour**.

Cet appel réalise deux fonctions intellectuelles complémentaires :

1. La conférence de rédaction : analyse du dossier, choix des sujets et hiérarchisation.
2. Le journaliste agroclimatique : rédaction complète de l'édition.

Ces deux fonctions doivent être réalisées au cours d'une même génération structurée.

Les opérations suivantes restent déterministes et ne doivent pas déclencher d'appel IA :

- Acquisition des données climatiques.
- Calcul des indicateurs.
- Détection des événements et tendances.
- Résolution du calendrier agricole.
- Collecte des actualités agricoles.
- Préparation du dossier éditorial.
- Validation des chiffres et des preuves.
- Archivage.
- Affichage du Journal.
- Consultation des anciennes éditions.

Ne pas mettre en place de chaîne multi-agents effectuant plusieurs appels systématiques.

Des essais comparatifs exceptionnels peuvent utiliser plusieurs modèles, mais uniquement avec activation explicite, dans un budget séparément suivi.

### 2.2. Coût extrêmement limité

L'objectif est de maintenir **les dépenses OpenAI sous un budget cible de 5 € par mois**.

Prévoir des protections applicatives strictes, indépendantes des éventuels plafonds configurés sur la plateforme OpenAI.

La clé doit rester exclusivement côté serveur.

### 2.3. Aucune génération lors de la consultation

Le Journal doit servir une édition déjà préparée.

L'ouverture d'une page, le changement de date, la consultation d'une région ou l'affichage d'une carte ne doivent jamais déclencher d'appel OpenAI.

### 2.4. Conserver la maquette actuelle

La mise en page développée dans T32/T32B constitue la référence graphique.

Ne pas refaire le design ni créer une nouvelle application de lecture.

Les articles IA doivent s'intégrer dans cette architecture, avec les mêmes principes visuels, les cartes dynamiques PRA et les rubriques nationales, régionales et par production.

### 2.5. Pas encore de production automatique

T35 prépare la rédaction, la validation, l'archivage et la consultation des éditions.

L'automatisation complète du batch quotidien et son déclenchement avant 6 h 30 Europe/Paris seront finalisés dans T36.

Ne pas activer de nouveau cron dans T35.

Ne pas publier automatiquement les articles IA en production.

---

## 3. Examiner et réutiliser l'architecture existante

Avant de développer, analyser les modules et contrats existants.

### Journal

Examiner notamment :

- `apps/web/features/journal/model.ts`
- `apps/web/features/journal/history.ts`
- `apps/web/features/journal/registry.ts`
- `apps/web/features/journal/validate.ts`
- `apps/web/app/journal/page.tsx`
- Les composants UI de T32B.
- Les API et lecteurs cartographiques du Journal.

### Intelligence éditoriale T33

Examiner :

- `apps/web/features/editorial/`
- `contracts/jsonschema/editorial-briefing-1.schema.json`
- `scripts/task33_briefing.ts`
- `docs/codex/task33/`
- Les dossiers d'exemple réellement produits.

Le contrat `EditorialBriefingBundle` de T33 constitue la principale entrée de T35.

Ne pas dupliquer le moteur temporel ou les fonctions de sélection des événements.

### Veille agricole T34

Examiner :

- `engine/src/agriclimax/news/`
- `config/news/sources.v1.json`
- `docs/codex/task34/editorial-news-1.schema.json`

La collecte documentaire doit être effectuée en amont.

T35 ne doit pas aspirer de nouveaux articles ou lancer de recherches web pendant l'appel IA.

### Sécurité et exploitation

Examiner les conventions actuelles concernant :

- Secrets GitHub Actions.
- Variables d'environnement serveur.
- Stockage Supabase.
- Archives immuables.
- Contrôles scientifiques.
- Supervision et journaux d'exécution.
- Reprises après interruption.
- Cache et conservation des données.

Réutiliser les mécanismes existants autant que possible.

---

## 4. Construire le comité de rédaction IA

Il s'agit du cœur fonctionnel de T35.

L'IA reçoit un dossier éditorial structuré et doit produire une édition complète.

Elle doit se comporter comme un comité de rédaction réunissant implicitement :

- Un rédacteur en chef national.
- Un journaliste spécialisé en climatologie.
- Un journaliste spécialisé en agriculture.
- Un analyste agronomique.
- Un secrétaire de rédaction attentif aux sources et aux formulations.

Ces fonctions sont des responsabilités exprimées dans les instructions du modèle, pas cinq agents effectuant des appels distincts.

### 4.1. Choisir le sujet principal

Le modèle doit examiner les différents sujets candidats fournis par T33.

Pour chaque sujet, il doit considérer :

- La solidité des preuves.
- La fraîcheur des données.
- L'importance climatique du phénomène.
- Son caractère inhabituel ou remarquable.
- Son évolution temporelle.
- Sa persistance.
- Son extension territoriale.
- Sa pertinence potentielle pour les productions.
- Sa concordance avec une fenêtre du calendrier agricole.
- Les publications techniques associées.
- Son intérêt pour un décideur national.
- Sa nouveauté par rapport aux éditions précédentes lorsqu'un historique éditorial existe.

Ne pas sélectionner systématiquement le phénomène touchant le plus grand nombre de PRA.

Un événement plus localisé peut mériter la une si son intérêt agricole est mieux documenté.

Cependant, le modèle ne doit pas inventer de pertinence agronomique pour justifier un titre.

### 4.2. Confronter plusieurs angles éditoriaux

Le modèle doit pouvoir comparer plusieurs angles.

Par exemple :

- Un épisode de gel étendu.
- Le retour de précipitations après une période sèche.
- Une anomalie thermique persistante.
- Des conditions météorologiques particulières pendant une fenêtre culturale.
- Un phénomène signalé par plusieurs sources techniques.

Le résultat doit conserver une justification concise du sujet retenu et des principaux arbitrages.

Il ne faut pas demander au modèle de révéler un raisonnement interne détaillé.

Conserver uniquement des critères explicites et une justification éditoriale vérifiable.

### 4.3. Accepter les journées sans événement remarquable

L'IA ne doit jamais créer artificiellement une actualité spectaculaire.

En l'absence de signal fort, elle peut :

- Présenter une situation nationale globalement stable.
- Mettre en avant une évolution modérée mais bien documentée.
- Proposer un article saisonnier de fond.
- Identifier des sujets à surveiller.
- Produire une édition plus courte.

La qualité du Journal dépend aussi de sa capacité à ne pas surinterpréter.

---

## 5. Produire un véritable article journalistique

Le modèle doit rédiger une édition cohérente, hiérarchisée et agréable à lire.

### 5.1. Le titre principal

Créer un titre clair, informatif et attractif.

Exemples de styles souhaités, entièrement fictifs :

- « Les pluies reviennent dans l'Ouest après une longue séquence sèche »
- « Un refroidissement marqué concerne plusieurs régions agricoles »
- « Des températures inhabituellement douces accompagnent les semis d'automne »
- « Dans le Sud-Ouest, les conditions météorologiques interrogent la fin des récoltes »

Ces titres ne doivent être utilisés que si les données permettent effectivement les affirmations correspondantes.

Éviter :

- Les titres sensationnalistes.
- Les formulations catastrophistes.
- Les titres purement techniques.
- Les superlatifs non démontrés.
- Les conséquences agricoles non vérifiées.

### 5.2. Le chapeau

Rédiger trois ou quatre phrases maximum.

Le chapeau doit expliquer :

- Le phénomène principal.
- Les régions concernées.
- Son évolution lorsque celle-ci est démontrée.
- Le principal enjeu agricole ou la question agronomique associée.

Il ne doit pas simplement répéter le titre.

### 5.3. L'article principal

Produire un article d'environ 400 à 600 mots lorsque la matière disponible le justifie.

Il doit raconter :

1. Ce que montrent les données.
2. Où se situe le phénomène.
3. Comment il évolue.
4. Pourquoi cette évolution est notable.
5. Quels enjeux agricoles peuvent être examinés.
6. Ce que nous savons réellement.
7. Ce qui reste incertain.
8. Ce qu'il faudra surveiller.

Privilégier une progression narrative naturelle, avec des paragraphes courts et quelques intertitres utiles.

Ne pas construire une succession de listes de chiffres.

Ne pas répéter les mêmes informations dans chaque paragraphe.

Ne pas remplir artificiellement un article de 600 mots lorsque les faits disponibles ne justifient que 250 mots.

### 5.4. Trois chiffres clés

Sélectionner jusqu'à trois chiffres particulièrement intéressants.

Exemples :

- Nombre de PRA franchissant un critère.
- Nombre de régions concernées.
- Durée documentée d'un épisode.
- Valeur remarquable réellement représentative.
- Évolution homogène démontrée.

Les chiffres doivent être issus exclusivement des preuves disponibles.

Ne pas sélectionner automatiquement les trois extrêmes les plus spectaculaires.

Conserver les règles de représentativité développées dans T32B.

Une valeur ponctuelle ou un extrême sur une PRA montagneuse ne doit pas devenir une caractéristique de l'ensemble d'une région.

### 5.5. Rubrique « Dans les filières »

Produire des éclairages par production lorsque les données le permettent.

Les rubriques sont dynamiques et doivent pouvoir accueillir progressivement :

- Blé tendre.
- Maïs.
- Colza.
- Betteraves.
- Vigne.
- Arboriculture.
- Maraîchage.
- Prairies et fourrages.
- Bovins.
- Autres productions futures.

Ne pas coder en dur une liste limitative de productions.

Le modèle doit utiliser les contributeurs réellement présents dans le dossier.

Pour chaque éclairage :

- Une accroche courte.
- Le phénomène ou indicateur pertinent.
- Les principaux territoires.
- Le contexte saisonnier.
- Une interprétation prudente.
- Les preuves et sources.

Un indicateur descriptif du blé ne constitue pas automatiquement un indicateur validé de risque agronomique.

### 5.6. Rubrique « Le tour des régions »

Le récit doit privilégier les treize régions administratives métropolitaines, Corse comprise.

Les PRA servent aux calculs et aux cartes.

Le modèle peut citer une PRA nommément lorsqu'elle illustre un événement particulièrement remarquable ou localisé.

Pour les régions retenues :

- Une courte analyse.
- Les phénomènes principaux.
- Les productions concernées lorsque c'est documenté.
- Les données significatives.
- Une question ou évolution à surveiller.

Ne pas citer systématiquement toutes les régions si seules quelques-unes présentent un intérêt éditorial.

Ne pas confondre nombre de PRA et surface agricole affectée.

### 5.7. Rubrique « Ce qu'en disent les instituts et la presse agricole »

Cette rubrique doit être alimentée par T34.

Elle peut apporter :

- Des informations techniques.
- Des observations de terrain rapportées.
- Des éléments de contexte agricole.
- Des réactions de filières.
- Des études ou recommandations publiées.

Chaque publication doit conserver :

- Son titre.
- Sa source.
- Sa date.
- Son URL originale.
- Son niveau de rapprochement avec les faits climatiques.

Un rapprochement documentaire ne constitue jamais automatiquement une confirmation scientifique.

Ne pas citer une publication sans rapport suffisamment pertinent avec le sujet.

Si aucune publication pertinente n'existe, omettre la rubrique.

Ne jamais inventer des propos d'instituts techniques ou de journalistes.

---

## 6. Donner un véritable rôle à l'Almanach agricole

L'Almanach unifié de T33 doit constituer un instrument central du raisonnement éditorial.

Il permet à l'IA de comprendre :

- Les principales périodes de semis.
- Les floraisons théoriques.
- Les périodes de récolte.
- Les périodes de fauche.
- Les périodes habituelles de mise à l'herbe.
- Les périodes de sensibilité potentielles.
- Les grands rendez-vous zootechniques.
- Les fêtes et traditions rurales.
- Les marronniers climatiques français.
- Les événements agricoles saisonniers.

### Règle fondamentale

**L'Almanach propose des sujets et des hypothèses de contexte. Il ne prouve jamais qu'une opération culturale ou un stade est effectivement présent à une date donnée.**

Exemple :

Si une séquence de pluie intervient pendant la période habituelle d'implantation du colza, le Journal peut évoquer l'évolution des conditions météorologiques d'implantation.

Il ne doit pas affirmer que les agriculteurs ont effectivement semé.

Même logique pour :

- Les vendanges.
- Les floraisons.
- Les fenaisons.
- Les mises à l'herbe.
- Les vêlages et agnelages.
- Les opérations de maraîchage.

### Traditions et marronniers

Les Saints de glace, la Saint-Vincent ou d'autres repères traditionnels peuvent enrichir les éditions.

Mais un dicton ne doit jamais être présenté comme une prévision scientifique.

Les règles réglementaires potentiellement présentes dans le référentiel ne doivent pas être transformées en prescriptions sans vérification du droit applicable.

Les fenêtres exploratoires de l'Almanach doivent rester identifiées comme telles.

---

## 7. Utilisation des sources et sécurité documentaire

L'IA doit utiliser exclusivement les informations autorisées dans `EditorialBriefingBundle`.

Ne pas donner au modèle un accès libre à Supabase ou aux calculateurs.

Ne pas activer de navigation web pendant l'appel.

Les actualités agricoles sont collectées et préparées en amont par T34.

Les titres, résumés et métadonnées de sources externes doivent être traités comme des données non fiables, jamais comme des instructions adressées au modèle.

Prévoir des protections contre les injections de prompt.

Limiter les données transmises à ce qui est nécessaire.

Ne pas envoyer des fichiers météo bruts ni la totalité des séries des 713 PRA.

Ne pas reproduire le contenu intégral d'articles de presse protégés.

La rédaction doit respecter les limites de réutilisation des contenus externes et privilégier des synthèses originales et des liens vers les sources.

---

## 8. Architecture OpenAI : un appel structuré par édition

### 8.1. Utiliser l'API OpenAI officielle

Développer un adaptateur serveur dédié.

Utiliser des sorties JSON structurées avec schéma strict, selon les capacités de l'API effectivement disponible.

Ne pas s'appuyer sur l'analyse libre d'une réponse Markdown pour reconstruire l'article.

Le modèle doit produire l'ensemble de l'édition dans une seule réponse structurée.

### 8.2. Modèle configurable

Ne pas coder le nom du modèle dans la logique métier.

Prévoir une configuration, par exemple :

- `OPENAI_API_KEY`
- `AGRICLIMAX_EDITORIAL_MODEL`
- `AGRICLIMAX_AI_ENABLED`
- `AGRICLIMAX_AI_MAX_OUTPUT_TOKENS`
- `AGRICLIMAX_AI_MONTHLY_BUDGET`
- `AGRICLIMAX_AI_MAX_EDITION_COST`

Adapter les noms aux conventions réelles du dépôt.

Les secrets ne doivent jamais être exposés au navigateur.

### 8.3. Comparaison de modèles

Prévoir de comparer :

- Un modèle économique compatible avec les sorties structurées.
- Un modèle plus performant pour l'analyse et la rédaction.

Ne pas supposer qu'un identifiant de modèle est disponible sans le vérifier.

Comparer les modèles sur les mêmes dossiers et avec une grille d'évaluation commune.

Les appels comparatifs doivent être déclenchés manuellement et comptabilisés.

En fonctionnement quotidien, un seul modèle est sélectionné.

### 8.4. Un seul appel normal

L'appel doit produire :

- Les arbitrages éditoriaux.
- Le titre.
- Le chapeau.
- L'article principal.
- Les chiffres clés sélectionnés.
- Les rubriques de production.
- Les éclairages régionaux.
- Les références documentaires.
- Les propositions d'illustrations.
- Les références aux preuves.
- Les mentions de limites.

Ne pas exécuter systématiquement un second appel pour corriger le texte.

Les corrections contrôlables doivent être réalisées par le validateur déterministe.

Si une génération échoue, conserver le diagnostic et recourir à une édition déterministe de secours.

---

## 9. Garde-fous budgétaires obligatoires

Je souhaite que le budget OpenAI reste extrêmement faible.

### 9.1. Budget cible

Fixer comme valeur initiale :

**5 € par mois maximum pour la rédaction IA.**

Le programme doit pouvoir fonctionner avec un budget inférieur.

Prévoir un plafond par édition, calculé à partir des tarifs applicables au modèle choisi.

Le budget doit prendre en compte les éventuels tokens de raisonnement, les sorties structurées et les appels exceptionnels.

### 9.2. Prévision des coûts

Avant chaque génération :

- Évaluer le volume d'entrée.
- Estimer le volume maximal de sortie.
- Vérifier les tarifs configurés du modèle.
- Calculer un coût maximal conservateur.
- Vérifier le budget mensuel restant.
- Vérifier le plafond par édition.

Si le budget disponible est insuffisant, ne pas effectuer l'appel.

Le JSON de T33 fait environ 82 Ko en exemple, mais il ne faut pas convertir sa taille en tokens par une simple règle approximative pour la décision finale.

Utiliser une méthode de comptage compatible avec le modèle ou une borne prudente.

### 9.3. Suivi réel

Après chaque appel :

- Enregistrer les tokens utilisés lorsque l'API les fournit.
- Enregistrer le modèle réellement utilisé.
- Estimer ou calculer le coût avec la grille tarifaire versionnée.
- Conserver l'identité de l'édition.
- Actualiser le budget mensuel consommé.
- Conserver les erreurs éventuelles.

Si le coût ne peut pas être établi de manière fiable, suspendre les nouvelles générations automatiques plutôt que supposer un coût nul.

### 9.4. Protection contre les doublons

Une édition doit disposer d'une identité stable.

Par exemple, utiliser une clé construite à partir de :

- Date éditoriale.
- Identité du dossier T33.
- Version du prompt.
- Modèle.
- Version de configuration éditoriale.

Mettre en place un verrou d'exécution et un mécanisme durable d'idempotence.

Deux exécutions simultanées du batch ne doivent pas générer deux éditions payantes équivalentes.

Une édition déjà validée et archivée doit être réutilisée.

### 9.5. Gestion des erreurs et des reprises

En cas de timeout ou de réponse ambiguë, ne pas relancer automatiquement la requête sans vérifier si une génération a déjà eu lieu.

Prévoir des états explicites :

- `not_started`
- `reserved`
- `running`
- `completed`
- `validation_failed`
- `provider_error`
- `outcome_unknown`
- `budget_exceeded`

L'état `outcome_unknown` doit empêcher une nouvelle dépense automatique tant que l'opération n'est pas réconciliée ou explicitement autorisée.

### 9.6. Protection supplémentaire côté OpenAI

Documenter les réglages recommandés du projet API OpenAI :

- Budget mensuel.
- Alertes de consommation.
- Limites de débit.
- Autorisations restreintes.
- Modèles autorisés.

Ne pas supposer que les budgets ou alertes de plateforme constituent à eux seuls un plafond financier instantané et absolu.

Le verrou et les limites applicatives sont indispensables.

### 9.7. Aucun coût automatique en développement

Par défaut, T35 doit utiliser un mode `dry-run` ou des réponses simulées pour les tests.

Aucun test CI ne doit appeler l'API OpenAI.

Un premier appel réel doit être explicitement autorisé et plafonné.

Si aucune clé API n'est disponible, développer et valider tout le fonctionnement simulé, mais ne pas prétendre avoir évalué la qualité réelle du modèle.

---

## 10. Contrat de sortie et validation

Créer un contrat versionné, par exemple :

`EditorialDraft`

Ce contrat devra comporter au minimum :

### Identité

- Identifiant de l'édition.
- Date éditoriale.
- Identifiant du dossier T33.
- Cycle climatique.
- Version du moteur.
- Version du prompt.
- Modèle IA.
- Date de génération.
- Paramètres de génération.

### Choix éditoriaux

- Sujet principal.
- Justification synthétique du choix.
- Autres sujets examinés.
- Sujets secondaires retenus.
- Raisons explicites des principaux arbitrages.

### Contenu

- Titre.
- Chapeau.
- Article principal.
- Chiffres clés.
- Rubriques régionales.
- Rubriques par production.
- Actualités techniques.
- Sources.
- Limitations.

### Illustrations

- Identifiant de la carte principale.
- Phénomène représenté.
- Période.
- Référence du cycle.
- Identifiants des graphiques disponibles.
- Légendes.
- Faits associés.

### Traçabilité

- Identifiants des preuves.
- Données utilisées.
- Versions.
- Résultats des vérifications.
- Statut de publication.
- Métadonnées de consommation API.

Ne pas autoriser des illustrations sans données correspondantes.

### Validation runtime

Définir un schéma strict et versionné.

Refuser les propriétés inconnues et les références invalides.

Créer des validateurs indépendants de l'IA.

---

## 11. Vérification scientifique indépendante

C'est une condition impérative de publication.

L'IA peut rédiger et interpréter des faits, mais sa sortie ne devient jamais automatiquement une vérité scientifique.

### 11.1. Contrôler les chiffres

Vérifier :

- Valeur exacte.
- Unité.
- Période.
- Source.
- Indicateur.
- Qualité.
- Couverture.
- Région.
- Dénominateur.

Un chiffre absent du dossier ne peut pas être ajouté librement par l'IA.

### 11.2. Contrôler les dates

Respecter le format éditorial français.

Exemples :

- « du 8 au 14 novembre 2026 »
- « depuis le début du mois »
- « au cours des sept derniers jours »

Les formulations relatives doivent être cohérentes avec la véritable date de l'édition et les dates des observations.

Une prévision ancienne doit rester présentée comme une prévision établie à cette date.

### 11.3. Contrôler les territoires

Les régions doivent exister dans le référentiel administratif.

Les PRA éventuellement citées doivent être identifiées et vérifiables.

Ne pas attribuer à une région entière une valeur correspondant seulement à une PRA.

### 11.4. Contrôler les affirmations agronomiques

Ne jamais déduire automatiquement :

- Un dommage agricole.
- Une perte de rendement.
- Un stade phénologique.
- Une date effective de semis.
- Une vendange effectivement réalisée.
- Une maladie.
- Une mortalité animale.
- Un impact économique.

Ces affirmations exigent des preuves spécifiques.

Le contexte saisonnier peut justifier une question agronomique, pas une conclusion non étayée.

### 11.5. Contrôler les actualités

Vérifier que les publications existent réellement dans le lot documentaire.

Conserver leurs dates et URL.

Les titres et résumés de presse ne doivent pas devenir des preuves climatiques.

Un rapprochement faible ne doit pas être présenté comme une confirmation.

### 11.6. Vérification de l'intégralité du texte

Chaque proposition factuelle importante doit être reliée à un ou plusieurs identifiants de preuves.

Éviter un validateur qui vérifie uniquement la présence des bons chiffres dans le JSON tout en laissant passer des phrases non justifiées dans l'article.

Structurer les blocs rédactionnels en unités contrôlables et prévoir un contrôle du texte rendu.

La validation déterministe doit notamment rejeter les valeurs, territoires et périodes non autorisés.

Elle doit également appliquer des règles explicites pour les formulations de causalité ou de risque interdites.

Les assertions sémantiques qui ne peuvent pas être vérifiées automatiquement doivent être signalées pour revue humaine.

**Ne pas prétendre qu'un contrôle purement algorithmique garantit l'exactitude scientifique de toutes les nuances d'un article.**

### 11.7. Statuts

Prévoir :

- `draft`
- `validated_automatically`
- `needs_editorial_review`
- `rejected`
- `approved`
- `published`

Un brouillon IA ne doit jamais être considéré comme publiable par défaut.

---

## 12. Archivage des éditions

L'archivage est une composante structurante du produit.

Je veux pouvoir consulter ultérieurement chaque édition du Journal exactement telle qu'elle a été publiée.

### 12.1. Édition immuable

Chaque édition doit conserver :

- Son texte complet.
- Son titre.
- Ses rubriques.
- Les chiffres clés.
- Les références cartographiques.
- Les graphiques.
- Le dossier de preuves.
- Le modèle utilisé.
- Le prompt versionné.
- Les paramètres de génération.
- Les sources documentaires.
- Les résultats de validation.
- Sa date et son identité.

Le modèle d'archive doit être versionné.

### 12.2. Cartes et graphiques historiques

Une édition ancienne ne doit pas afficher automatiquement les dernières données disponibles.

Les visualisations doivent être reliées au cycle exact utilisé lors de la rédaction.

Si les données correspondantes ne sont plus accessibles, afficher un état d'indisponibilité explicite.

Ne jamais remplacer silencieusement la carte historique par une carte actuelle.

### 12.3. Corrections éditoriales

Une édition publiée est figée.

Si une erreur doit être corrigée, créer une nouvelle révision identifiée.

Conserver la version originale et la raison de la modification.

### 12.4. Stockage économique

Utiliser prioritairement les mécanismes de stockage existants.

Privilégier des JSON compacts, des identifiants de données et des références de cartes.

Éviter de stocker chaque jour plusieurs copies de fichiers géographiques volumineux.

Prévoir des contrôles d'intégrité et d'empreinte.

### 12.5. Périmètre T35

Construire et tester le format d'archivage et le lecteur associé dans un environnement local ou DEV autorisé.

Préparer les opérations de publication atomique.

Ne pas écrire dans le stockage de production sans autorisation.

Le déploiement et l'automatisation quotidienne de l'archivage seront finalisés dans T36.

---

## 13. Intégration dans la maquette actuelle du Journal

### Conserver l'existant

Réutiliser les composants de T32B.

Ne pas lancer de refonte graphique.

### Preview d'une édition IA

Créer un mode de Preview permettant de consulter une édition produite à partir d'un dossier T33 réel.

Elle doit reprendre :

- Le bandeau AgriClimaX.
- La date de l'édition.
- Le titre principal.
- Le chapeau.
- La carte nationale dynamique PRA.
- Les trois chiffres clés.
- L'article principal.
- Les rubriques par production.
- Les focus régionaux.
- Les publications techniques pertinentes.
- Les sources et méthodes.

Les références scientifiques doivent rester consultables, mais ne doivent pas envahir la lecture.

### Sélecteur d'éditions

Préparer une navigation simple entre les éditions archivées.

Par exemple :

- Édition du jour.
- Édition précédente.
- Sélection par date.
- Archives du Journal.

La même maquette doit être utilisée quelle que soit la date.

Ne pas créer une page spécifique pour chaque édition.

Si aucune archive n'existe à une date, afficher un état vide explicite.

Ne pas déclencher de génération IA lors de la navigation.

### Sécurité

La Preview expérimentale ne doit pas remplacer le Journal public tant que la qualité rédactionnelle n'a pas été approuvée.

Les routes de génération IA doivent rester exclusivement serveur, avec autorisation explicite.

Aucune clé ou configuration sensible ne doit apparaître dans le JavaScript client.

---

## 14. Première expérimentation rédactionnelle

Je souhaite évaluer concrètement la qualité de l'IA.

Prévoir trois scénarios.

### Scénario A — Plusieurs phénomènes concurrents

Utiliser un dossier réel comportant plusieurs sujets climatiques.

Demander au modèle de sélectionner la une et de justifier son choix.

Évaluer la pertinence de la hiérarchisation.

### Scénario B — Forte concordance saisonnière

Utiliser un dossier où un événement climatique peut être rapproché d'une fenêtre agricole.

Évaluer la capacité à produire une analyse agronomique intéressante, sans transformer le contexte théorique en observation.

### Scénario C — Journée calme

Tester un dossier sans phénomène exceptionnel.

Vérifier que le modèle sait produire une édition sobre, ou un sujet saisonnier de fond, sans inventer une alerte.

### Comparaison des modèles

Comparer lorsque des appels réels sont explicitement autorisés :

- Qualité du titre.
- Pertinence du sujet retenu.
- Richesse du récit.
- Clarté du chapeau.
- Intérêt agronomique.
- Respect des sources.
- Exactitude scientifique.
- Gestion des incertitudes.
- Diversité des angles.
- Absence de répétitions.
- Coût.
- Temps de génération.

Conserver les résultats sous forme de brouillons et de rapports comparatifs.

Ne pas afficher comme résultats réels des générations seulement simulées.

---

## 15. Préparer le fonctionnement batch quotidien

Le fonctionnement cible est le suivant.

### Étape 1 — Acquisition

Les workflows climatiques existants acquièrent les données disponibles.

### Étape 2 — Calcul

Les indicateurs climatiques et agroclimatiques sont calculés et qualifiés.

### Étape 3 — Analyse T33

Le moteur construit les épisodes, confronte l'Almanach et prépare les sujets candidats.

### Étape 4 — Veille T34

Le lot documentaire est collecté et qualifié.

### Étape 5 — Conférence de rédaction IA

**Un seul appel OpenAI** examine le dossier complet et rédige l'édition.

### Étape 6 — Contrôle

Un validateur déterministe indépendant vérifie la sortie.

### Étape 7 — Archivage

L'édition validée est enregistrée de manière immuable.

### Étape 8 — Publication

Le site affiche le dernier article publié, sans appel à OpenAI.

### Objectif horaire

Le Journal doit être disponible chaque matin à :

**06 h 30 — Europe/Paris**

Préparer les interfaces de batch nécessaires.

Prévoir un cutoff éditorial, une gestion de la fraîcheur, un mode dégradé et une stratégie de repli sur la dernière édition valide.

Ne pas supposer que les données observées de J−1 sont systématiquement disponibles à cette heure.

Ne pas activer ni modifier les crons dans T35.

T36 sera chargée de la mise en production, de la programmation horaire et des essais opérationnels sur plusieurs nuits.

---

## 16. Tests obligatoires

Créer des tests couvrant au minimum :

### IA et API

1. Génération structurée valide.
2. Réponse mal formée.
3. Refus ou échec fournisseur.
4. Timeout.
5. Dépassement de tokens.
6. Budget mensuel insuffisant.
7. Coût par édition excessif.
8. Génération concurrente.
9. Absence de clé API.
10. Mode simulation sans dépense.
11. Absence de double appel en fonctionnement normal.
12. Aucune relance payante après un résultat ambigu.

### Validation scientifique

13. Chiffre inventé.
14. Unité incorrecte.
15. Date incorrecte.
16. Région inexistante.
17. PRA mal attribuée.
18. Confusion entre observation et prévision.
19. Historique ancien présenté comme actuel.
20. Extrapolation d'une PRA à une région entière.
21. Support partiel non qualifié.
22. Causalité agronomique non démontrée.
23. Stade phénologique inventé.
24. Dommage agricole non prouvé.
25. Source documentaire inexistante.
26. Rapprochement documentaire faible présenté comme confirmé.
27. Référence de carte incompatible avec la période.
28. Affirmation factuelle sans preuve.

### Journal et archivage

29. Édition produite et conservée.
30. Relecture sans appel OpenAI.
31. Changement de date.
32. Édition ancienne et carte correspondante.
33. Date sans édition.
34. Correction sous forme de révision.
35. Même dossier déjà généré.
36. Génération rejetée et repli déterministe.
37. Affichage desktop.
38. Affichage mobile.
39. Absence de secret dans les réponses client.
40. Aucun appel OpenAI lors du chargement des pages.

Les fixtures sont autorisées pour les tests unitaires.

Les cas présentés comme réels doivent utiliser des dossiers et données réellement vérifiés.

La CI ne doit jamais dépendre d'une clé OpenAI ni déclencher un appel payant.

Exécuter les tests TypeScript, Python, typecheck, lint, build, sécurité et tests navigateur habituels.

---

## 17. Performance et exploitation

Le moteur T33 produit actuellement des dossiers d'environ 82 Ko.

L'archive historique utilisée pour les tests contient trente journées climatiques réelles.

La mémoire du batch T33 atteint environ 500 Mio en recette.

Il faut préserver une architecture économique.

Le moteur de rédaction ne doit pas :

- Recalculer les 713 PRA.
- Recharger des décennies de données météorologiques.
- Relancer les calculs agroclimatiques.
- Aspirer la presse à chaque génération.
- Interroger OpenAI lors des consultations.
- Conserver inutilement des copies volumineuses des cartes.

Le dossier doit être préparé avant l'appel IA.

Mesurer :

- Taille des entrées.
- Nombre de tokens.
- Durée de génération.
- Coût.
- Taille des éditions archivées.
- Mémoire.
- Temps d'affichage des pages.
- Temps de récupération d'une archive.

Prévoir une architecture suffisamment extensible pour les futures productions agricoles, sans multiplier mécaniquement les appels IA.

---

## 18. Documentation obligatoire

Créer :

`docs/codex/task35/`

Avec les documents suivants.

### `ARCHITECTURE.md`

Architecture générale, réutilisation de T33/T34 et circulation des données.

### `EDITORIAL_WORKFLOW.md`

Fonctionnement de la conférence de rédaction et étapes de production d'une édition.

### `PROMPT_DESIGN.md`

Instructions éditoriales, stratégie de sortie structurée, arbitrages et gestion des sources.

### `AI_MODEL_EVALUATION.md`

Modèles évalués, résultats, limites et conditions des essais.

### `FACT_CHECKING.md`

Contrôles déterministes, preuves, gestion des hallucinations et limites de validation.

### `EDITORIAL_QUALITY.md`

Grille de qualité rédactionnelle et résultats des scénarios de test.

### `COST_BUDGET.md`

Tarifs configurés, plafonds, mécanismes d'idempotence, gestion des tokens, consommation et protections.

### `ARCHIVING.md`

Identité, stockage, immutabilité, révisions et consultation des anciennes éditions.

### `BATCH_INTEGRATION.md`

Interface d'exécution quotidienne, supervision, modes de repli et préparation de T36.

### `ACCEPTANCE.md`

Résultats des tests, captures, consommation réelle ou estimée et limitations restantes.

Conserver les exemples d'éditions, les dossiers de preuves et les rapports de validation.

Ne conserver aucune clé API ni secret dans les documents ou logs.

---

## 19. Livrables et critères de réussite

Je considérerai T35 réussie si :

1. Un moteur de rédaction IA est intégré de façon modulaire.
2. Le fonctionnement normal nécessite un seul appel OpenAI par édition.
3. L'IA sait choisir et justifier le sujet principal.
4. Elle rédige un véritable article journalistique.
5. Elle exploite le contexte saisonnier de l'Almanach.
6. Elle utilise les indicateurs agroclimatiques disponibles.
7. Elle peut intégrer les actualités pertinentes de T34.
8. Elle produit les rubriques par région et production.
9. Elle sélectionne des illustrations réellement disponibles.
10. Les affirmations factuelles sont traçables.
11. Les chiffres, unités, périodes et régions sont contrôlés.
12. Les extrapolations agronomiques non justifiées sont rejetées ou signalées.
13. Les protections budgétaires sont effectivement testées.
14. Les générations répétées ne provoquent pas de double facturation automatique.
15. La lecture d'une édition n'effectue aucun appel OpenAI.
16. Un format d'archive immuable est implémenté et testé.
17. La consultation des éditions archivées est fonctionnelle en Preview.
18. Le design actuel du Journal est préservé.
19. Le système dispose d'un mode de secours sans IA.
20. La CI complète est verte.
21. Aucune publication automatique en production n'est activée.

### Limite de recette importante

Si une clé et une autorisation d'appel réel ne sont pas disponibles, la tâche peut être validée techniquement en simulation, mais **la qualité rédactionnelle réelle ne doit pas être déclarée validée**.

Dans ce cas, indiquer explicitement `READY_FOR_LIVE_AI_TEST` et les conditions manquantes.

---

## 20. Organisation du travail

Je souhaite une tâche longue, complète et autonome.

Procéder dans cet ordre :

1. Audit de T33, T34 et du Journal.
2. Définition du contrat `EditorialDraft`.
3. Construction des instructions éditoriales.
4. Adaptateur API OpenAI.
5. Mécanisme d'appel unique et contrôles budgétaires.
6. Génération structurée de l'édition.
7. Validation scientifique indépendante.
8. Gestion des rejets et du repli déterministe.
9. Construction du format d'archive.
10. Intégration dans la Preview du Journal.
11. Consultation des éditions archivées.
12. Scénarios de recette éditoriale.
13. Tests techniques et de sécurité.
14. Mesures de performance.
15. Documentation.
16. Ouverture d'une PR draft.

Ne pas s'arrêter après la conception des contrats.

Ne pas demander une validation intermédiaire pour chaque étape purement locale.

Ne jamais effectuer d'appel API payant sans activation explicite.

Ne jamais effectuer d'écriture distante non autorisée.

Ne pas modifier les workflows de production.

---

## 21. Livraison attendue

Ouvrir une PR draft intitulée :

`T35 — AI Editorial Board & Archived Agroclimatic Journal`

Ne pas merger automatiquement.

Le rapport final doit présenter :

1. L'architecture du comité de rédaction IA.
2. Le mode de fonctionnement à appel unique.
3. Le modèle et la configuration retenus.
4. Les modèles réellement testés, le cas échéant.
5. Les coûts estimés et réels.
6. Les mécanismes de plafonnement.
7. Les résultats de validation factuelle.
8. Un ou plusieurs exemples d'articles.
9. La manière dont l'Almanach et les news T34 ont influencé la rédaction.
10. Les rubriques régionales et de production.
11. Le fonctionnement de l'archivage.
12. Les captures desktop et mobile.
13. L'URL de Preview.
14. Les résultats des tests.
15. Les limites restantes.
16. Les conditions nécessaires à l'automatisation quotidienne de T36.

## 22. Ambition finale

**Je veux découvrir dans la Preview un véritable Journal agroclimatique national, rédigé par une intelligence artificielle qui joue le rôle d'un excellent comité de rédaction scientifique et agricole.**

Ce Journal doit :

- Être passionnant à lire sans être sensationnaliste.
- Expliquer les événements plutôt que simplement énumérer les données.
- Donner de la profondeur temporelle aux phénomènes climatiques.
- Comprendre le rythme des saisons agricoles.
- Mettre en perspective les productions et les territoires.
- Confronter ses analyses aux publications techniques pertinentes.
- Rester scientifiquement prudent et vérifiable.
- Utiliser des cartes et graphiques issus des données réelles.
- Respecter un budget de quelques euros par mois.
- Ne réaliser qu'un seul appel OpenAI par édition quotidienne.
- Conserver chaque édition dans une archive consultable.
- Préserver l'identité graphique actuelle du Journal.

Le résultat doit préparer l'étape suivante :

**T36 — Industrialisation de la chaîne quotidienne et publication automatique du Journal à 6 h 30, heure de Paris.**

Aucun cron ou déploiement automatique ne doit être activé dans T35.

Ne pas merger.

Livrer une PR draft complète, testée, documentée, avec une Preview journalistique et les preuves des contrôles scientifiques et budgétaires.