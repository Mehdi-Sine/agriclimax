# OPS-04 — Exécution à la demande et validation de bout en bout du Journal AgriClimaX

## Contexte

Dépôt : `Mehdi-Sine/agriclimax`

La tâche OPS-03 (PR #78) a corrigé la préparation des snapshots, ajouté une gestion dégradée des acquisitions, permis le rattrapage du Journal du 11 novembre 2026 et introduit la gestion des révisions éditoriales.

La migration OPS-03 est appliquée dans Supabase.

La révision 2 du Journal du 11 novembre est enregistrée, sans nouvel appel OpenAI, mais la publication certifiée nécessite toujours une revue humaine. Le contrôle de publication est actuellement désactivé.

**Avant de commencer : vérifier que la PR #78 est fusionnée dans `main`. Sinon, ne pas démarrer une implémentation divergente et signaler le problème.**

## Objectif principal

Permettre de relancer manuellement, à tout moment, les traitements quotidiens d'AgriClimaX sans attendre la nuit suivante.

Nous voulons pouvoir tester plusieurs fois dans une même journée les acquisitions météorologiques, les calculs agroclimatiques, la génération éditoriale et le rendu du Journal.

Le fonctionnement automatique nocturne doit rester inchangé et utiliser autant que possible les mêmes fonctions que l'exécution manuelle.

## 1. Ajouter un déclenchement manuel GitHub Actions

Créer ou adapter un workflow `workflow_dispatch` intitulé :

**AgriClimaX — Produire / tester le Journal**

Paramètres :

- `edition_date` : date de l'édition, par défaut la date du jour en Europe/Paris.
- `mode` : `dry-run`, `resume`, `publish`.
- `refresh_sources` : relancer les acquisitions nécessaires.
- `recompute_indicators` : recalculer les indicateurs agroclimatiques.
- `reuse_ai` : réutiliser la réponse OpenAI existante si elle est compatible avec le snapshot et le contrat éditorial.
- `force_ai_regeneration` : désactivé par défaut, avec garde-fous explicites.

Ne pas ajouter de secrets ni de services externes supplémentaires.

## 2. Trois modes d'exécution

### dry-run

- Vérifier les données disponibles.
- Recalculer les indicateurs si demandé.
- Construire un snapshot de test.
- Exécuter les validations nécessaires.
- Produire un rapport détaillé.
- Ne pas écraser la publication courante.
- Ne pas déclencher d'appel OpenAI par défaut.

Si une génération IA est indispensable à un test, elle doit être explicitement autorisée.

### resume

- Reprendre une édition interrompue.
- Identifier la dernière étape valide.
- Réutiliser les acquisitions, snapshots et générations compatibles.
- Exécuter uniquement les étapes manquantes.
- Éviter les doublons et appels OpenAI inutiles.
- Ne jamais contourner les validations.

### publish

- Exécuter les traitements nécessaires à la production.
- Contrôler la qualité et la fraîcheur des données.
- Construire ou sélectionner le snapshot.
- Générer ou réutiliser l'analyse IA.
- Valider le contenu.
- Respecter la revue humaine et les autorisations existantes.
- Publier uniquement si toutes les conditions sont satisfaites.
- Vérifier la visibilité de l'édition.

Ne pas activer implicitement un contrôle de publication désactivé. Si une action humaine ou une configuration est nécessaire, l'indiquer clairement.

## 3. Rendre les recalculs agroclimatiques indépendants

Permettre de relancer les calculs des indicateurs à partir des données météorologiques déjà présentes.

Objectif : tester les développements AGRO sans refaire systématiquement les téléchargements Météo-France et ERA5-Land.

Vérifier que :

- Les 713 PRA restent le niveau de restitution.
- Les calculs sont reproductibles.
- Les indicateurs sont associés à leurs dates et sources.
- Les données anciennes ne sont pas présentées comme récentes.
- Les règles de couverture sont respectées.
- Les résultats sont accessibles à la cartographie et au moteur éditorial.

Une modification d'indicateur doit pouvoir être testée immédiatement sur les données disponibles.

## 4. Faciliter les tests de l'interface

Prévoir un mécanisme permettant de consulter une édition de test, sans remplacer automatiquement l'édition publiée.

L'objectif est de pouvoir tester :

- La page d'accueil Journal.
- Les cartes climatiques à la maille PRA.
- Les cartes agroclimatiques.
- Les informations de fraîcheur et de couverture.
- Les archives.
- Les liens entre Journal, cartes détaillées et documentation.

Réutiliser les composants UX existants.

Ne pas entreprendre une nouvelle refonte graphique dans OPS-04.

## 5. Produire un rapport de chaque exécution

À la fin du workflow, afficher un résumé lisible dans GitHub Actions :

| Contrôle | Information attendue |
|---|---|
| Édition | Date demandée |
| Mode | dry-run / resume / publish |
| Acquisitions | Succès, échecs et réutilisations |
| Fraîcheur | Date de référence par source |
| Couverture | PRA exploitables et limites |
| Indicateurs | Nombre calculé et erreurs |
| Snapshot | Identifiant, qualité et statut |
| OpenAI | Appel effectué ou réutilisé |
| Validation | Résultat et éventuels blocages |
| Publication | Publiée, en attente ou refusée |
| Consultation | URL de l'édition ou de test |

Le rapport doit permettre de comprendre rapidement ce qui a fonctionné et ce qui bloque.

## 6. Tests et sécurité

Tester :

1. Exécution manuelle sans acquisition.
2. Exécution avec nouvelles acquisitions.
3. Recalcul des indicateurs uniquement.
4. Reprise après interruption.
5. Édition déjà publiée.
6. Absence de prévisions.
7. Données partiellement anciennes.
8. Exécutions concurrentes.
9. Réutilisation d'une réponse IA.
10. Publication nécessitant une revue humaine.

Garantir l'idempotence, la maîtrise des coûts et la conservation des éditions validées.

Le mode dry-run ne doit pas modifier les données de production visibles par les utilisateurs.

## 7. Démonstration réelle demandée

Après implémentation :

- Tester une exécution manuelle pour l'édition du 11 novembre 2026.
- Utiliser d'abord le mode `dry-run`.
- Vérifier les indicateurs et le snapshot.
- Tester ensuite `resume` si nécessaire.
- Ne pas déclencher de nouvel appel OpenAI sans justification.
- Ne pas publier sans validation humaine si celle-ci est requise.
- Vérifier que l'édition précédemment enregistrée reste intacte.

Si les droits GitHub ou Supabase empêchent une exécution réelle, fournir les étapes exactes à effectuer manuellement.

## 8. Livrables

- Workflow GitHub Actions manuel.
- Adaptations minimales des scripts existants.
- Tests automatisés.
- Documentation courte d'utilisation.
- Rapport de démonstration.
- Pull request dédiée `codex/ops-04-manual-journal`.

Ne pas fusionner automatiquement.

## Critère de réussite

**Je dois pouvoir modifier un indicateur agroclimatique le matin, déclencher un recalcul et tester son intégration dans le Journal le jour même, sans attendre 24 heures et sans appel OpenAI inutile.**

La chaîne nocturne doit continuer à fonctionner indépendamment, sans régression.