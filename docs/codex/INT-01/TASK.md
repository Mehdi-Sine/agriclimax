# INT-01 — Mise en service du Journal agroclimatique et des cartes PRA

## 0. Objectif prioritaire

Nous voulons obtenir aujourd'hui une application AgriClimaX pleinement exploitable sur le plan fonctionnel :

1. Une page d'accueil affichant le Journal agroclimatique réel.
2. Une carte nationale interactive à la maille des 713 PRA dans le Journal.
3. Une rubrique « Cartes du jour » présentant les cartes climatiques et agroclimatiques disponibles.
4. Des données météorologiques aussi récentes que possible, avec leur véritable date de validité.
5. Une édition quotidienne archivée, consultable et cohérente avec les cartes.

Il ne s'agit PAS de refaire l'interface UX. La priorité est de raccorder les composants existants aux données et aux cartes opérationnelles.

## 1. État du projet

Dépôt : `Mehdi-Sine/agriclimax`.

La PR #80 AGRO-UX-01 a été fusionnée dans `main`, commit de fusion `4c538492`.

La Preview validée a été promue manuellement en production sur Vercel.

Les nouvelles interfaces sont visibles, mais :
- Aucune carte n'apparaît dans le Journal.
- La rubrique « Cartes du jour » ne présente pas les cartes attendues.
- Les données météorologiques visibles semblent anciennes.
- L'utilisateur souhaite un Journal quotidien réellement alimenté, pas une démonstration statique.

Les derniers workflows T36 Operational Nightly Journal et Météo-France Live Station Ingestion ont été exécutés manuellement et sont signalés comme réussis.

La PR #81 MF-01 reste ouverte, en draft, non fusionnée. Elle a démontré des acquisitions réelles Météo-France et IFS, mais les données de recette n'ont pas été publiées.

La PR #63 COUV-01 reste ouverte, non fusionnée, avec des réserves scientifiques importantes.

La PR #77 UX-01 est absorbée par #80 et ne doit pas être fusionnée séparément.

Un dry-run OPS-04 du 11 novembre a généré 92 690 mesures et 40 cartes, mais celles-ci ne constituent pas des cartes opérationnelles publiées.

## 2. Règle fondamentale

Ne pas confondre :
- Acquisition réussie ;
- Donnée disponible dans Supabase ;
- Indicateur calculé ;
- Carte générée ;
- Carte persistée ;
- Carte référencée par une édition ;
- Carte affichée par l'interface ;
- Édition publiée.

Chaque étape doit être vérifiée séparément, avec des preuves.

Ne jamais utiliser des cartes de test comme cartes de production sans qualification et procédure de publication explicite.

## 3. Phase A — Diagnostic complet de bout en bout

Avant toute modification, reconstruire la chaîne :

Sources Météo-France / ERA5 / IFS
→ acquisition
→ stockage Supabase
→ calcul des indicateurs
→ génération des cartes PRA
→ persistance des cartes
→ association à une édition
→ publication éditoriale
→ API Next.js
→ Journal et Cartes du jour.

Pour chaque étape, identifier :
- Le code responsable ;
- Le workflow responsable ;
- Les tables, buckets ou contrats utilisés ;
- Le dernier traitement réellement réussi ;
- Les dates des données ;
- Les sorties effectivement persistées ;
- Les éventuelles erreurs ;
- Les composants consommateurs.

Examiner les derniers runs T36, Météo-France et OPS-04, ainsi que leurs artefacts.

Ne pas conclure qu'une carte existe en production simplement parce qu'un fichier PNG ou JSON a été produit dans un artefact GitHub Actions.

Produire un diagnostic identifiant précisément les ruptures de chaîne.

## 4. Phase B — Intégration contrôlée de MF-01

Auditer la PR #81 et ses dépendances.

Vérifier sa compatibilité avec `main` après fusion de #80.

Préserver les travaux existants et éviter toute duplication.

Si MF-01 doit être intégrée pour obtenir des données fraîches :
- Préparer sa mise à jour sur `main` ;
- Vérifier les conflits éventuels ;
- Exécuter ses tests ;
- Documenter l'ordre d'intégration.

Ne pas fusionner automatiquement #81.

Ne pas cherry-picker silencieusement l'ensemble de MF-01 dans INT-01.

INT-01 doit rester testable indépendamment des corrections MF-01 lorsque cela est possible.

## 5. Phase C — Production et persistance des cartes

Identifier les générateurs de cartes déjà présents dans le moteur.

Réutiliser les contrats et les calculs existants.

Mettre en place, si nécessaire, le chaînon de persistance et de lecture des cartes qualifiées.

Exigences :
- 713 PRA, dont six en Corse ;
- Géométries PRA officielles ;
- Sélection et interaction avec les PRA ;
- Indicateur, unité et période clairement identifiés ;
- Provenance et date des données ;
- Couverture surfacique et valeurs manquantes conservées ;
- Pas d'interpolation ou d'imputation non qualifiée ;
- Palettes conformes au phénomène climatique ;
- Archivage des cartes par édition ;
- Identifiants stables et vérification d'intégrité ;
- Conservation des anciennes éditions.

Privilégier des données cartographiques structurées permettant une carte interactive plutôt qu'une image statique.

Les cartes doivent être accessibles par l'application déployée, et pas uniquement par un artefact local ou GitHub Actions.

Éviter la duplication inutile de grandes quantités de données dans Supabase Storage.

## 6. Phase D — Raccordement au Journal

Utiliser l'interface issue de la PR #80 sans la redessiner.

Sur la page Journal :
- Afficher une carte PRA interactive associée à l'édition.
- Choisir une carte principale à partir des données réellement disponibles.
- Afficher son titre, sa période, sa source, son unité et sa légende.
- Permettre de sélectionner une PRA.
- Rendre explicites les données manquantes ou insuffisamment couvertes.
- Préserver le texte éditorial, les rubriques et les archives.

Ne jamais associer une carte d'une autre période à un article sans l'indiquer.

Si aucune carte qualifiée n'est disponible, afficher un état explicite et diagnostiquable, sans fabriquer de contenu.

## 7. Phase E — Rubrique « Cartes du jour »

Connecter cette rubrique aux mêmes cartes opérationnelles que le Journal.

Prévoir :
- Une carte principale ;
- Une navigation entre les indicateurs disponibles ;
- Une sélection PRA ;
- Une légende adaptée ;
- Les dates de validité ;
- Les sources ;
- Un indicateur de couverture ;
- Un état clair lorsque certaines données sont absentes.

La sélection des cartes doit être cohérente avec le registre des indicateurs existant.

Ne pas exposer comme cartes opérationnelles des données issues uniquement d'un dry-run.

## 8. Phase F — Fraîcheur et exploitation quotidienne

Vérifier pourquoi les données visibles ne sont pas à jour malgré des workflows réussis.

Identifier :
- Les dernières dates réellement acquises ;
- Les dernières dates persistées ;
- Les dates utilisées pour les calculs ;
- Les dates des cartes publiées ;
- Les dates des éditions affichées.

Ne pas confondre heure d'exécution et date de validité.

Prévoir un mécanisme idempotent permettant de compléter une édition sans écraser les archives certifiées.

Objectif cible :
- Observations proches de J-1 lorsque disponibles ;
- Prévisions J+5/J+7 lorsque disponibles ;
- Actualisation quotidienne du Journal ;
- Conservation des données antérieures en cas d'échec.

Les limites de couverture Météo-France et ERA5 doivent rester visibles.

Ne pas modifier les critères scientifiques de qualification pour obtenir artificiellement une couverture complète.

## 9. Phase G — Recette intégrée

Effectuer une recette sur une édition réelle du 11 novembre 2026.

Tester :
1. Accueil et Journal.
2. Carte principale visible.
3. Interaction avec une PRA.
4. Rubrique Cartes du jour.
5. Changement d'indicateur.
6. Légende, dates et sources.
7. Valeurs manquantes.
8. Bretagne et littoraux.
9. Corse.
10. Archives historiques.
11. Navigation desktop et mobile.
12. Cohérence entre API, stockage et interface.
13. Idempotence et absence de réécriture d'archives.
14. Absence d'appel OpenAI non autorisé.

Exécuter les tests TypeScript, Python, build, qualité, sécurité et les tests navigateur pertinents.

Tester également le comportement lorsqu'une carte n'est pas encore publiée.

## 10. Sécurité de mise en production

Ne pas modifier automatiquement la production.

Ne pas déclencher d'appel OpenAI payant.

Ne pas changer les secrets.

Ne pas supprimer ou réécrire les éditions archivées.

Ne pas modifier les migrations ou les contrats scientifiques sans justification et validation explicites.

Préparer une procédure de publication contrôlée, réversible pour le code, avec protection des données persistées.

La publication d'une nouvelle édition doit rester distincte du déploiement du code.

## 11. Livrables obligatoires

Créer une branche `codex/int-01-journal-maps-operational` et une PR en draft.

Fournir :

1. `docs/codex/INT-01/DIAGNOSTIC.md` : audit complet de la chaîne.
2. `docs/codex/INT-01/INTEGRATION.md` : dépendances avec #80, #81 et #63.
3. `docs/codex/INT-01/VALIDATION.md` : tests et preuves.
4. `docs/codex/INT-01/RELEASE.md` : procédure exacte de mise en production, étapes manuelles, vérifications et retour arrière.
5. Captures desktop/mobile du Journal et des Cartes du jour.
6. État de fraîcheur des sources, indicateurs et cartes.
7. Liste des éventuels blocages externes.

Conclure par :
- READY : chaîne fonctionnelle, testée, publication contrôlée possible ;
- PARTIAL : fonctionnalités réalisées mais réserves ou dépendances restantes ;
- BLOCKED : obstacle empêchant une intégration sûre.

Ne pas annoncer READY sur la seule base d'une CI verte.

Ne pas fusionner automatiquement.

## 12. Priorité d'exécution

Priorité absolue : obtenir une carte PRA interactive réelle, persistée, qualifiée et correctement affichée dans le Journal et « Cartes du jour ».

Ne pas consacrer le temps de développement à des fonctionnalités secondaires, à un redesign ou à une extension du nombre d'indicateurs.

Si plusieurs solutions sont possibles, choisir la plus simple, robuste et économique.

Avancer jusqu'à une PR testable avec des preuves concrètes, sans interrompre le travail pour des validations intermédiaires non indispensables.

À la fin, indiquer très précisément :
- Ce qui fonctionne déjà ;
- Ce qui a été corrigé ;
- Ce qui reste bloqué ;
- Les actions humaines nécessaires ;
- L'ordre de fusion recommandé ;
- La prochaine action à effectuer pour voir une carte réelle en production.