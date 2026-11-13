# COUV-01 — AgriClimaX : consolidation définitive de la couverture climatique des 713 PRA

## 1. Mission prioritaire

Tu travailles sur `Mehdi-Sine/agriclimax`.

Je souhaite résoudre de manière structurelle les problèmes de couverture climatique nationale qui persistent depuis les Tasks 19, 26, 28 et AGRO-01.

Cette tâche est **prioritaire et bloquante pour la poursuite du développement des indicateurs agroclimatiques**.

L'objectif est de disposer d'une couverture climatique nationale fiable, reproductible et durable sur les 713 petites régions agricoles officielles de France métropolitaine et de Corse.

Je veux pouvoir construire des cartes nationales complètes, des historiques et des indicateurs agroclimatiques sans retrouver systématiquement des PRA littorales indisponibles.

Cependant, il est impératif de ne pas inventer des données, de ne pas extrapoler silencieusement et de ne pas faire passer une estimation pour une observation ou une réanalyse native.

**Cette tâche doit réellement corriger les problèmes d'infrastructure identifiés, pas simplement changer les critères de complétude ou masquer les territoires absents.**

## 2. État de départ vérifié

La PR AGRO-01 #62 a mis en évidence les résultats suivants :

- Historique ERA5-Land 1 et 7 jours : 645 PRA complètes, 67 partielles, Crozon indisponible.
- Historique 30 jours : aucune PRA complète avec les archives actuellement accessibles.
- Prévision J+1 : 713 PRA numériquement disponibles, représentativité littorale non entièrement qualifiée.
- Prévision J+1 à J+7 : impossibilité de calculer des indicateurs intégrés homogènes à cause des changements de modèles ou de supports.

Ces constats sont documentés dans :

`docs/codex/agro01/NATIONAL_COVERAGE.md`

`docs/codex/agro01/SCIENTIFIC_VALIDATION.md`

La PR #62 est toujours en draft. Consulter sa documentation et ses preuves, mais ne pas fusionner ni écraser son travail.

D'autres travaux importants ont déjà été réalisés :

- Task 19 : construction du référentiel national des 713 PRA et intersections ERA5-Land.
- Task 26 : acquisition météo nationale, qualification littorale et expérimentations des supports ERA5-Land à 90 %.
- Task 28 : calculs nationaux sur des fenêtres historiques et prévisionnelles.
- Task 29 : travaux spécifiques de reconstruction côtière et récupération ERA5.
- Task 30 : sélection nationale, cartes et contrôle de qualité.

Relire tous ces travaux avant de développer une nouvelle solution.

## 3. Branche, sécurité et coordination

Créer une branche :

`codex/COUV-01-national-climate-foundation`

Depuis le dernier `main` stable.

La PR #61 (Journal T32/T32B) et la PR #62 (AGRO-01) sont en cours.

Ne pas modifier leurs composants métiers ou UI.

Concentrer le développement sur les sources climatiques, la géographie, l'agrégation PRA, les référentiels, les lecteurs d'archives et les contrats génériques de couverture.

Les adaptations spécifiques aux futures contributions agroclimatiques seront réalisées après intégration de cette tâche.

Ne pas merger automatiquement.

Ne pas écrire dans les données de production.

Utiliser des pilotes locaux ou un environnement DEV explicitement autorisé.

Les secrets existants ne doivent pas être affichés.

Ne pas modifier les quotas ou plafonds de ressources sans justification et validation explicites.

## 4. Première phase : audit scientifique et technique complet

Avant toute modification, établir un diagnostic exhaustif des 713 PRA.

Produire une matrice par :

- PRA et région administrative.
- Variable météorologique.
- Date.
- Nature : réanalyse, observation ou prévision.
- Source et modèle.
- Support géographique.
- Couverture spatiale.
- Couverture temporelle.
- Qualité.
- Motif d'indisponibilité.

Variables prioritaires :

- Température moyenne.
- Température minimale.
- Température maximale.
- Précipitations quotidiennes.
- Humidité relative, si disponible, pour les futurs indicateurs d'élevage.

Pour chacune des 68 PRA historiquement problématiques, déterminer précisément :

1. Le pourcentage de territoire couvert par les cellules natives.
2. Le nombre et la position des cellules contributrices.
3. L'origine des zones manquantes.
4. Les restrictions du masque terre/mer.
5. Les éventuelles erreurs de géométrie, projection ou pondération.
6. La possibilité d'utiliser une autre source officielle.
7. La faisabilité d'une restitution complète scientifiquement défendable.

Étudier tout particulièrement Crozon, La Hague, les PRA côtières méditerranéennes et les six PRA corses.

Ne pas considérer qu'une PRA est couverte simplement parce qu'elle possède au moins une valeur météorologique.

Distinguer support numérique, support spatial réellement représentatif et donnée qualifiée.

Produire une carte et un tableau des 713 PRA avec la classification exacte des problèmes.

## 5. Deuxième phase : évaluer SAFRAN/SIM comme source nationale historique

Il s'agit de la principale piste à examiner.

Les données publiques SIM quotidiennes de Météo-France reposent sur SAFRAN–ISBA et sont diffusées sous Licence Ouverte.

Source officielle :

https://www.data.gouv.fr/datasets/donnees-changement-climatique-sim-quotidienne

Documentation Météo-France :

https://confluence-meteofrance.atlassian.net/wiki/spaces/OpenDataMeteoFrance/pages/621510657/Donn+es+climatologiques

Examiner les ressources actuelles et leur organisation réelle.

Ne pas supposer que des URL anciennes ou des noms de fichiers historiques sont encore valables.

Étudier :

- Le maillage officiel SAFRAN/SIM à environ 8 km.
- Sa couverture géographique.
- Son système de coordonnées.
- Les métadonnées des points de grille.
- Les points situés en mer ou hors du territoire.
- Les variables disponibles.
- Les définitions exactes des températures et précipitations.
- Les périodes historiques disponibles.
- La disponibilité des dernières journées.
- Les règles de révision des données.
- Les volumes et possibilités de téléchargement.

### Pilote réel obligatoire

Développer un pilote borné, en lecture seule, pour plusieurs journées récentes et un échantillon de PRA contrastées.

Tester au minimum :

- Crozon.
- La Hague.
- Une PRA littorale méditerranéenne.
- Une PRA corse littorale.
- Une PRA corse montagneuse.
- Une PRA agricole intérieure.
- Une PRA de montagne continentale.

Comparer la disponibilité SAFRAN avec ERA5-Land.

Vérifier que SAFRAN fournit réellement des valeurs utilisables sur les territoires concernés.

Si le pilote est concluant, construire les intersections SAFRAN/PRA sur les 713 géométries officielles.

Les pondérations doivent être calculées avec une méthode spatiale justifiée, notamment dans une projection adaptée aux surfaces.

Conserver l'identité des cellules, leurs versions, leurs poids et les empreintes des sources.

### Choix architectural

Évaluer explicitement deux stratégies :

A. Utiliser SAFRAN comme source principale de l'historique national, avec une méthode homogène pour les 713 PRA.

B. Conserver ERA5-Land comme source principale et utiliser SAFRAN pour les territoires problématiques.

Comparer scientifiquement ces deux solutions.

Je privilégie a priori la solution A pour éviter une mosaïque nationale de méthodes historiques différentes. Mais le choix final doit reposer sur la couverture réellement démontrée, la comparabilité, les coûts et la pérennité.

Ne pas mélanger les séries ERA5-Land et SAFRAN dans les calculs de tendances ou de normales sans méthode versionnée et validation spécifique.

## 6. Troisième phase : correction des supports littoraux

Si SAFRAN couvre effectivement les PRA problématiques, développer un agrégateur territorial national permettant d'obtenir des données représentatives de leur support terrestre.

Vérifier :

- Les surfaces et intersections.
- Les traitements des cellules partiellement maritimes.
- Les effets de la résolution sur les très petites PRA.
- Les zones montagneuses et insulaires.
- Les résultats des méthodes de pondération.
- La cohérence des valeurs et des unités.

Comparer les résultats à :

- ERA5-Land lorsqu'il existe un support suffisamment complet.
- Des stations Météo-France appropriées lorsque cela est pertinent.
- Les précédentes reconstructions côtières du projet.

Les comparaisons doivent utiliser les mêmes journées et variables, avec des indicateurs d'écart : biais, MAE, distribution des différences et cas extrêmes.

Ne pas présenter une station comme vérité territoriale parfaite.

Si certaines PRA restent insuffisamment couvertes par SAFRAN, examiner une méthode explicite de reconstruction ou d'estimation à partir des données disponibles, avec validation indépendante.

Toute estimation doit posséder :

- Une méthode versionnée.
- Une qualité et une incertitude.
- Un support spatial identifiable.
- Une provenance.
- Un indicateur distinguant valeur native et estimation.

Ne pas remplacer silencieusement des valeurs NULL par des estimations.

Ne pas adopter automatiquement la règle des 90 % testée dans les anciennes tâches sans démontrer qu'elle est adaptée aux indicateurs considérés.

## 7. Quatrième phase : rétablir un historique continu

AGRO-01 ne trouve actuellement que quatorze jours d'archives réanalysées, du 19 octobre au 1er novembre 2026.

Pourtant, la Task 28 avait documenté une fenêtre calculable de trente jours sur octobre.

Il faut comprendre cette différence.

Auditer :

- Le catalogue d'archives.
- Les manifestes.
- Les références des objets historiques.
- Les éventuelles expirations.
- Les versions de lecteurs.
- Les anciennes données déjà récupérées.
- Les différences entre résultats des Tasks 28 et AGRO-01.

Vérifier si les journées antérieures sont encore présentes, éventuellement dans des archives conservées mais non référencées.

Ne pas supposer qu'un résultat autrefois calculé signifie que son archive source est toujours accessible.

Si des journées manquent réellement, prévoir un backfill borné et reprenable.

### Objectif historique

Obtenir, sous une méthode homogène et qualifiée :

- Des journées climatiques continues.
- Des fenêtres mobiles de 7 jours.
- Des fenêtres mobiles de 14 jours.
- Des fenêtres mobiles de 30 jours.

Et cela pour les 713 PRA, au moins pour les variables fondamentales effectivement disponibles et qualifiées.

Les périodes doivent être calculées à partir de journées réelles, avec contrôle des dates manquantes.

Une fenêtre incomplète reste indisponible.

Préparer aussi la conservation de ces séries dans le temps, afin que le journal puisse reconnaître l'apparition, la persistance et la fin d'un événement.

Ne pas intégrer un modèle de tendance éditoriale dans cette tâche.

## 8. Cinquième phase : résoudre la discontinuité des prévisions

La sélection nationale actuelle utilise plusieurs modèles, notamment AROME, ARPEGE et IFS.

Cela permet une bonne couverture quotidienne, mais pose problème pour certains cumuls et séquences sur sept jours.

Étudier les solutions possibles.

### Option A : chaîne homogène

Vérifier si un modèle unique et une initialisation compatible permettent de couvrir J+1 à J+7 sur l'ensemble des PRA, avec les variables nécessaires.

Examiner les grilles, supports, masques terre/mer, fenêtres temporelles, qualité et disponibilités.

### Option B : combinaison scientifiquement qualifiée

Étudier la possibilité d'une intégration de journées provenant de modèles distincts, uniquement avec une méthode de continuité et de comparabilité explicitement validée.

Une telle méthode devra traiter les différences de grilles, biais et supports et être versionnée.

Ne pas supprimer les barrières existantes simplement pour obtenir artificiellement un résultat.

### Option C : calculs séparés

Si les deux premières approches ne sont pas suffisamment défendables, conserver des prévisions quotidiennes complètes et des segments homogènes, sans publier de cumul hebdomadaire non qualifié.

En complément, établir la représentativité réelle des prévisions littorales : disponibilité numérique ne signifie pas nécessairement une bonne représentation terrestre.

La solution retenue doit pouvoir fonctionner au quotidien et être compatible avec les différents indicateurs agroclimatiques futurs.

## 9. Architecture d'une couverture nationale durable

L'objectif n'est pas seulement de réparer une archive.

Construire une architecture réutilisable pour toutes les productions :

- Sources climatiques qualifiées.
- Adaptateurs par source.
- Agrégation PRA.
- Contrôle du support géographique.
- Qualification de la complétude.
- Archivage quotidien versionné.
- Lecture historique.
- Contrôles automatiques.
- Export compact vers les moteurs agroclimatiques.

Prévoir un contrat commun distinguant :

- Valeur native complète.
- Valeur reconstruite ou estimée et qualifiée.
- Support partiel.
- Indisponibilité.
- Source inconnue ou non comparable.

Séparer clairement la provenance, la représentativité, la couverture et le niveau de validation scientifique.

L'arrivée d'un nouvel indicateur ne doit pas nécessiter une nouvelle opération de réparation du littoral.

Les nouveaux indicateurs pourront déclarer les types de valeurs et de supports qu'ils acceptent.

Un indicateur nécessitant une valeur native ne doit pas consommer automatiquement une estimation côtière.

## 10. Ressources et hébergement économique

Respecter l'objectif d'hébergement gratuit ou très économique.

Les fichiers SAFRAN peuvent être volumineux.

Ne pas importer des décennies de grilles brutes dans Supabase.

Privilégier :

- L'acquisition bornée sur GitHub Actions.
- Le traitement temporaire des fichiers sources.
- L'extraction des dates et variables nécessaires.
- Les résultats agrégés par PRA.
- Les archives compressées et vérifiées.
- Les métadonnées et manifestes légers.
- Un historique compact et réutilisable.

Étudier les options de récupération par lot et la rétention des fichiers.

Chiffrer les besoins de téléchargement, de mémoire, de calcul et de stockage.

Ne pas augmenter silencieusement les budgets existants.

Toute opération longue doit être découpée en étapes reprenables, avec checkpoints et sans réacquisition des données déjà validées.

## 11. Contrôles de qualité obligatoires

Mettre en place une campagne de validation réelle.

### Géographie

- Exactement 713 PRA.
- Six PRA corses.
- Géométries officielles inchangées.
- Tous les identifiants conservés.
- Contrôle des intersections et pondérations.
- Support spatial documenté pour chaque PRA.
- Aucune couverture inventée.

### Historique

- Couverture par date et variable.
- Fenêtres continues de 7, 14 et 30 jours.
- Origine et version des séries.
- Validation des unités.
- Vérifications indépendantes sur un échantillon contrasté.
- Différenciation native/reconstruction.
- Aucune concaténation incompatible.

### Prévisions

- Disponibilité quotidienne des 713 PRA pour les variables prioritaires.
- Contrôle du support terrestre.
- Continuité par modèle et initialisation.
- Conservation des règles d'indisponibilité.
- Contrôles de valeurs physiques.
- Validation des jours frontières.
- Contrôle de la compatibilité des périodes cumulées.

### Non-régression

- Les anciennes valeurs et archives restent accessibles.
- Les calculateurs existants ne sont pas modifiés silencieusement.
- Les anciennes cartes restent compatibles.
- Les règles de provenance restent respectées.
- Aucun faux indicateur n'apparaît dans le Journal.
- Aucun changement de méthode sans nouvelle version.

## 12. Critères d'acceptation

Je souhaite atteindre une couverture nationale réellement utilisable sur les 713 PRA.

### Critère A — Couverture historique

Objectif : 713/713 PRA avec une restitution qualifiée des variables fondamentales de température et de précipitation sur une période historique complète.

La restitution peut utiliser une source maillée homogène ou des estimations explicitement validées, mais ne doit pas cacher leur nature.

Si certaines variables ou PRA restent indisponibles, ne pas déclarer ce critère atteint.

### Critère B — Fenêtres de trente jours

Objectif : permettre les calculs historiques de 7, 14 et 30 jours sans journées manquantes, sur les périodes effectivement publiées.

### Critère C — Couverture prévisionnelle

Objectif : disposer de données quotidiennes fiables sur les 713 PRA de J+1 à J+7 pour les variables fondamentales, avec qualification du support littoral.

Les indicateurs intégrés sur plusieurs jours doivent conserver des règles de compatibilité scientifique.

### Critère D — Pérennité

Objectif : permettre l'alimentation quotidienne des données sans retraitement manuel du littoral et sans nouvelle intervention sur les calculs de chaque production.

### Critère E — Honnêteté scientifique

Aucun critère ne peut être déclaré satisfait sur la seule base d'une présence numérique, d'un remplissage artificiel ou d'une carte sans zones grises.

Si un critère ne peut pas être satisfait avec les sources disponibles, produire une démonstration claire des obstacles, accompagnée d'une solution technique et d'un plan chiffré.

Ne pas dégrader les contrôles scientifiques pour obtenir artificiellement 713/713.

## 13. Livrables documentaires

Créer :

`docs/codex/COUV-01/`

Produire :

**`ROOT_CAUSE_AUDIT.md`**

Diagnostic complet des problèmes, avec références aux anciennes Tasks 19, 26, 28, 29 et AGRO-01.

**`COASTAL_713_MATRIX.csv`**

Table de couverture des 713 PRA, avec source, support, couverture, méthode et statut.

**`SAFRAN_PILOT.md`**

Accès aux données, méthodes, essais réels, couverture, limites et comparaisons avec ERA5-Land.

**`NATIONAL_SOURCE_STRATEGY.md`**

Choix de l'architecture nationale et justification scientifique de la source principale et des compléments.

**`HISTORICAL_BACKFILL.md`**

Audit des archives existantes, récupération et stratégie de conservation continue.

**`FORECAST_CONTINUITY.md`**

Analyse AROME/ARPEGE/IFS, continuité et méthodes de calcul.

**`RESOURCE_BUDGET.md`**

Téléchargements, durées, mémoire, stockage et coûts.

**`ACCEPTANCE.md`**

Résultats réels, critères atteints ou non, tests indépendants et limitations résiduelles.

Conserver également les preuves numériques exploitables et des cartes de couverture avant/après.

## 14. Organisation du développement

Ne pas interrompre le travail après un simple diagnostic.

Enchaîner les étapes de manière autonome :

1. Audit des données et de la géographie.
2. Pilote SAFRAN réel.
3. Comparaison des stratégies.
4. Implémentation de la meilleure solution justifiée.
5. Pilote national sur les 713 PRA.
6. Reconstitution ou prolongation de l'historique.
7. Analyse et correction de la continuité prévisionnelle.
8. Tests indépendants et non-régression.
9. Documentation.
10. PR draft et rapport final.

Respecter les plafonds existants. Si une acquisition ou publication distante exige une autorisation non disponible, réaliser toutes les étapes locales possibles et fournir les commandes de reprise, sans prétendre avoir achevé la validation distante.

Ne pas bloquer tout le chantier sur un seul fournisseur si une autre source officielle et libre permet d'obtenir une meilleure couverture scientifiquement qualifiée.

## 15. Livraison et verdict final

Ouvrir une PR draft dédiée à COUV-01.

Ne pas merger.

Présenter un tableau avant/après avec :

- PRA historiques complètes.
- PRA historiques partielles.
- PRA indisponibles.
- Couverture corse.
- Couverture littorale.
- Fenêtres de 7, 14 et 30 jours.
- Couverture des prévisions quotidiennes.
- Continuité des prévisions sur sept jours.
- Temps de calcul et stockage.

Fournir un verdict distinct pour :

- `READY_HISTORICAL_713`
- `READY_COASTAL_QUALIFICATION`
- `READY_30_DAY_HISTORY`
- `READY_FORECAST_DAILY_713`
- `READY_FORECAST_MULTI_DAY`
- `READY_FOR_AGROCLIMATIC_EXPANSION`

Chaque verdict doit être fondé sur des essais réels.

**Objectif final : mettre un terme au problème récurrent de couverture nationale, en construisant une infrastructure scientifique permettant de travailler durablement sur les 713 PRA, toutes les régions et les futures productions agricoles.**

Ne pas masquer les problèmes. Les résoudre à la source, en remontant dans les anciennes tâches si nécessaire.

Avancer aussi loin que possible de façon autonome, avec preuves vérifiables et PR draft sans merge.