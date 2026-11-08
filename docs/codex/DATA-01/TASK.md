# TASK DATA-01 — AgriClimaX : historique climatique continu, archivage durable et fiabilité des traitements quotidiens

## 1. Contexte et ambition

Tu travailles sur le dépôt GitHub `Mehdi-Sine/agriclimax`.

Les tâches T32B, AGRO-01 et CORE-01 ont permis de construire :

- Un Journal agroclimatique avec carte des 713 PRA.
- Dix indicateurs blé techniquement fiabilisés.
- Un contrat de qualité climatique commun `climate-coverage-1`.
- Une gestion unifiée des supports spatiaux complets, partiels et indisponibles.
- Une alimentation commune de Climat, Analyse, Veille nationale et Journal.

**La priorité est maintenant de fiabiliser l'alimentation temporelle de toute l'application.**

Je souhaite que les données climatiques soient acquises, contrôlées, conservées et rendues disponibles de façon quotidienne et pérenne.

À terme, le Journal devra pouvoir publier une édition analysée et rédigée chaque matin à **6 h 30, heure de Paris**, alimentée par les dernières données effectivement disponibles.

Cette tâche doit préparer ce fonctionnement sans encore intégrer l'IA de rédaction.

## 2. Branche et règles d'exécution

Partir du dernier `origin/main`, après fusion de la PR #64 (CORE-01).

Créer :

`codex/DATA-01-daily-climate-reliability`

La PR #63 (COUV-01) reste ouverte en draft et contient des travaux expérimentaux sur SAFRAN et la récupération d'archives.

Consulter ses documents et ses scripts, notamment :

- `HISTORICAL_BACKFILL.md`
- `NATIONAL_SOURCE_STRATEGY.md`
- `RESOURCE_BUDGET.md`
- Les outils de récupération des archives ERA5 historiques.

Réutiliser ou adapter les portions pertinentes après vérification, sans fusionner toute la branche.

Ne pas modifier les interfaces du Journal, les calculateurs métiers du blé ou les contrats de qualité de CORE-01, sauf adaptation de compatibilité indispensable et justifiée.

Ne pas effectuer de merge automatique.

Aucune écriture dans les données de production sans autorisation explicite. Les pilotes peuvent utiliser un environnement DEV isolé et autorisé.

## 3. Phase 1 — Audit de la chaîne quotidienne actuelle

Examiner les workflows et scripts opérationnels :

- `.github/workflows/daily-live.yml`
- `.github/workflows/pra-climate.yml`
- `.github/workflows/meteofrance-ingestion.yml`
- Les traitements ERA5-Land.
- Les acquisitions AROME/ARPEGE/IFS.
- Les traitements d'agrégation PRA.
- Les manifestes et archives Supabase.
- Les traitements agroclimatiques déclenchés après ingestion.
- Les outils de monitoring existants, notamment ceux de CORE-01.

Établir un inventaire réel des tâches planifiées, manuelles, désactivées et conditionnées par les variables GitHub.

Identifier :

1. Les fréquences et horaires effectifs.
2. Les sources climatiques utilisées.
3. Les dates réellement disponibles chez chaque fournisseur.
4. Les durées des différentes étapes.
5. Les étapes susceptibles d'échouer.
6. Les mécanismes de reprise.
7. Les règles de publication atomique.
8. Les rétentions et limites de stockage.
9. Les différences entre les données récentes, historiques et prévisionnelles.

Ne pas considérer une programmation cron comme la preuve que les traitements se sont réellement exécutés.

Produire une représentation précise de la chaîne opérationnelle et de ses dépendances.

## 4. Phase 2 — Rétablir un historique de 30 jours réellement accessible

C'est une priorité absolue.

AGRO-01 et CORE-01 retrouvent seulement 14 journées ERA5-Land dans le catalogue Storage actuel.

Cependant, COUV-01 a démontré l'existence d'anciens agrégats historiques consultables par RPC sur 30 journées, du 1er au 30 octobre 2026.

Je souhaite retrouver et exploiter correctement ces données.

### Travail attendu

- Auditer les deux chemins de lecture : archives Storage modernes et données historiques legacy.
- Vérifier les dates, variables, identités PRA et versions.
- Vérifier les empreintes et preuves des archives existantes.
- Comparer les journées communes pour détecter des divergences.
- Déterminer si les anciennes journées peuvent être réindexées ou exposées via un adaptateur sans réacquisition.
- Réutiliser les mécanismes de récupération bornée développés dans COUV-01.
- Construire une stratégie de conservation historique unique pour les nouvelles données.

### Précaution scientifique

Ne jamais assembler silencieusement deux séries ayant des méthodes, unités, périodes ou supports incompatibles.

Les anciennes valeurs doivent conserver leur provenance et leur version.

Si une fenêtre de 30 jours est réellement homogène, la rendre accessible aux calculateurs existants.

Sinon, documenter les lacunes et les conditions de compatibilité nécessaires.

### Résultat attendu

Disposer d'au moins une fenêtre historique de 30 jours réels vérifiés, permettant de tester :

- Les températures.
- Les précipitations cumulées.
- Les sommes thermiques.
- Les jours chauds et gelés.
- Les séquences sans pluie significative.

Les 645 PRA historiquement complètes doivent conserver leurs valeurs.

Les 67 PRA partielles doivent respecter les règles de CORE-01 et conserver leurs valeurs descriptives lorsqu'elles sont calculables.

Crozon peut rester indisponible avec ERA5-Land.

Ne pas inventer une complétude nationale supérieure à ce que démontrent les archives.

## 5. Phase 3 — Construire une conservation quotidienne durable

Je souhaite éviter qu'un historique soit calculable une semaine et ne le soit plus la suivante.

Proposer une architecture d'archivage avec :

- Journées climatiques immuables et versionnées.
- Index par source, date, modèle, variable et méthode.
- Manifestes de disponibilité.
- Empreintes d'intégrité.
- Historique des révisions de données.
- Récupération d'archives anciennes.
- Reprise après interruption.
- Déduplication des données.
- Conservation durable dans un stockage économique.

Ne pas conserver un nouvel instantané complet de plusieurs dizaines de jours chaque matin si les mêmes journées sont recopiées inutilement.

Privilégier des objets quotidiens compacts, avec une indexation permettant de reconstruire les périodes demandées.

Évaluer les solutions de stockage déjà disponibles dans Supabase et les coûts à 3, 12 et 24 mois.

Distinguer les archives de données nécessaires au fonctionnement de l'application et les artefacts temporaires des GitHub Actions.

Les artefacts GitHub à rétention limitée ne constituent pas un archivage pérenne.

Ne pas supprimer les anciennes données ni introduire une politique de purge non validée.

## 6. Phase 4 — Fiabiliser le traitement quotidien

Concevoir une chaîne quotidienne robuste et reprenable.

Elle devra :

1. Vérifier la disponibilité de nouvelles données.
2. Identifier les journées ou variables manquantes.
3. Acquérir uniquement les éléments nécessaires.
4. Vérifier les données sources.
5. Réaliser les agrégations PRA.
6. Vérifier les 713 identités officielles et les supports.
7. Calculer les indicateurs compatibles.
8. Produire les archives et les manifestes.
9. Effectuer les contrôles de qualité.
10. Publier atomiquement un nouveau cycle vérifié.

En cas d'échec :

- Conserver le dernier cycle valide.
- Ne jamais publier un cycle incomplet comme complet.
- Conserver les checkpoints de reprise.
- Éviter les téléchargements ou calculs redondants.
- Fournir un diagnostic lisible.

Réutiliser les workflows et les composants existants plutôt que développer une deuxième chaîne parallèle.

Prévoir des contrôles automatiques de fraîcheur, de complétude et de qualité spatiale.

Les supports partiels doivent être qualifiés selon CORE-01.

Ne pas confondre l'absence de nouvelles données chez un fournisseur et un dysfonctionnement de notre pipeline.

## 7. Phase 5 — Préparer la publication du Journal à 6 h 30

C'est une exigence produit importante.

La future édition quotidienne doit être disponible à **06 h 30 Europe/Paris**, hiver comme été.

Auditer les horaires actuellement configurés et mesurer la disponibilité réelle des sources.

Construire un plan de fonctionnement comprenant :

- Acquisition et mise à jour nocturnes.
- Validation des données.
- Calculs agroclimatiques.
- Préparation du dossier de preuves éditoriales.
- Future collecte des actualités agricoles.
- Future rédaction IA.
- Vérification et publication.
- Archivage de l'édition.

Le plan doit distinguer explicitement observations/réanalyses récentes, prévisions et données dont la livraison est différée.

**Ne pas prétendre fournir des données observées J−1 à 6 h 30 si le fournisseur ne les a pas encore publiées.**

Dans ce cas, utiliser la dernière observation ou réanalyse disponible avec sa vraie date, et les prévisions vérifiées disponibles pour la situation à venir.

Prévoir une gestion correcte du changement d'heure Europe/Paris.

GitHub Actions étant déclenché selon une planification non garantie à la minute, prévoir des marges, une supervision et un repli sur la dernière édition valide.

Ne pas déclencher la rédaction IA dans cette tâche.

Ne pas activer immédiatement de nouveaux horaires de production.

Préparer un pilote contrôlé en DEV permettant de vérifier la faisabilité des horaires avant activation.

## 8. Phase 6 — Capacité et performances

CORE-01 a mesuré :

- Une synthèse nationale de veille d'environ 3,64 Mo.
- Un plafond de réponse de 4 Mo.
- Une consommation mémoire serveur d'environ 500 Mo dans les essais.
- Des calculs réutilisant déjà un cache par cycle.

Ces chiffres appellent une vigilance.

Étudier :

- Le coût de reconstruction des fenêtres historiques.
- La taille des archives quotidiennes.
- Les lectures et décodages répétitifs.
- Le temps de calcul des indicateurs.
- Le nombre de requêtes.
- La taille des réponses API.
- Les conséquences du passage à 50 ou 100 productions.

Identifier des optimisations sans perdre de preuves scientifiques.

Privilégier le partage des données calculées et la factorisation des références.

Les calculs lourds doivent être effectués une fois par cycle, puis servir les utilisateurs via des résultats compacts.

Ne pas créer un service national qui recalcule toutes les données à chaque visite du Journal.

Préserver la possibilité d'ajouter de nouvelles productions sans répliquer la chaîne météorologique.

## 9. Phase 7 — Recette opérationnelle réelle

Tester la chaîne sur des données réelles.

### Historique

- Lecture d'une journée.
- Lecture de sept jours.
- Lecture de quatorze jours.
- Lecture de trente jours si série disponible.
- Contrôle de continuité.
- Validation des sources et supports.
- Cas des PRA littorales.
- Comparaison avec les anciennes valeurs.

### Quotidien

- Journée avec nouvelles données.
- Journée sans nouvelle livraison.
- Acquisition partiellement réussie.
- Échec de téléchargement.
- Reprise après interruption.
- Rejeu idempotent.
- Publication atomique.
- Vérification de la fraîcheur.

### Indicateurs et Journal

- Calcul des indicateurs blé sur une fenêtre homogène.
- Conformité aux contrats de CORE-01.
- Compatibilité avec la veille et le Journal.
- Distinction observation/réanalyse/prévision.
- Absence de valeurs fictives.
- Dates de validité correctes.

Effectuer un pilote DEV réel lorsque les autorisations existantes le permettent.

Ne pas considérer des fixtures comme des validations opérationnelles.

## 10. Documentation et livrables

Créer :

`docs/codex/DATA-01/`

Avec :

- `PIPELINE_AUDIT.md` : état actuel des workflows et acquisition.
- `HISTORICAL_RECOVERY.md` : restauration et lecture des archives.
- `ARCHIVE_ARCHITECTURE.md` : stratégie de conservation et versionnement.
- `DAILY_OPERATIONS.md` : déroulement quotidien, reprises et contrôles.
- `0630_PUBLICATION_PLAN.md` : architecture horaire du futur Journal.
- `RESOURCE_BUDGET.md` : stockage, calculs, mémoire et coûts.
- `ACCEPTANCE.md` : validations réelles, limites, performances et verdict.

Conserver les preuves numériques avec leurs sources, dates et versions.

## 11. Critères de réussite

Je considère DATA-01 réussie si :

1. Les anciennes archives disponibles sont retrouvées et inventoriées.
2. Une fenêtre homogène de 30 jours est effectivement accessible aux calculateurs, ou les obstacles exacts sont démontrés.
3. La stratégie d'archivage évite de perdre les journées précédentes.
4. Les nouveaux cycles sont versionnés et vérifiables.
5. Les traitements sont idempotents et reprenables.
6. La qualité des supports de CORE-01 est préservée.
7. Les calculateurs et le Journal restent compatibles.
8. Les temps et volumes de calcul sont mesurés.
9. Un plan réaliste de publication à 6 h 30 est établi.
10. Les contrôles quotidiens sont exécutables et vérifiés.
11. Aucun workflow ne publie de données fictives ou incomplètes.
12. Aucune écriture dans la production n'est effectuée sans autorisation.
13. Aucun nouveau service payant n'est nécessaire.
14. Les tests et CI sont au vert.

## 12. Organisation et livraison

Je souhaite une tâche complète, sans arrêt après un simple diagnostic.

Enchaîner les phases de manière autonome, avec priorité à la réutilisation des données et outils existants.

Ne pas demander de validations intermédiaires pour les opérations locales ou les lectures autorisées.

Si l'accès distant est indisponible ou si une écriture DEV nécessite une autorisation non fournie, terminer toutes les étapes hors écriture, conserver les preuves et documenter précisément les commandes de reprise.

Ouvrir une PR draft.

Ne pas merger.

En conclusion, présenter :

1. La cause de l'historique limité à 14 jours.
2. Les journées anciennes effectivement récupérées.
3. La nouvelle profondeur historique exploitable.
4. La couverture réelle par source et variable.
5. Les mécanismes de conservation durable.
6. Le fonctionnement de la chaîne quotidienne.
7. Les tests réels et les performances.
8. Les éventuels obstacles à l'exécution automatique.
9. Le calendrier proposé pour l'édition de 6 h 30.
10. Les dernières actions nécessaires avant de lancer T33.

**L'objectif final est de disposer d'une chaîne climatique continue, robuste et pérenne, qui puisse alimenter chaque jour les calculateurs agroclimatiques et le futur Journal IA sans intervention manuelle récurrente.**
