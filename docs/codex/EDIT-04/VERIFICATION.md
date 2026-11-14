# Vérification EDIT-04

Base main : `bdce460`, branche `codex/edit-04`. Vérifications locales le 14 novembre 2026. Aucun déploiement ni appel OpenAI réel.

| Vérification | Résultat / preuve |
|---|---|
| Préparation depuis les trois snapshots gelés | Empreintes exactes des cartes publiées retrouvées : [preparation.json](evidence/preparation.json) |
| Comparaison avant/après | Trois éditions réelles, dix cartes publiées chacune, six retenues par classement sans quota : [comparaison](evidence/COMPARISON.md) |
| Préservation distante | Relecture des trois archives et bundles, checksums identiques aux copies initiales : [remote-preservation.json](evidence/remote-preservation.json) |
| Unitaires éditoriaux, cartes, OPS-07 et préparation | **263 tests, 28 fichiers, tous réussis** : [tests.log](evidence/tests.log), cas de réponse IA valide, principale différente, édition courte, aucune carte admissible, références inventées/croisées, doublons, panne, modèle incompatible et rejet scientifique |
| Types web et scripts | TypeScript strict, projets web et `scripts/tsconfig.edit04.json`, succès |
| Lint | ESLint sur tous les modules web touchés, succès |
| Build | Compilation Next production avec bootstrap original et sans accès Supabase : [build.log](evidence/build.log) |
| Contrats et secrets | Contrats offline et garde des secrets, succès |
| Desktop/mobile | 1440×1000 et 390×844, trois dates, six cartes par scénario, 36 liens interactifs vérifiés : [rapport](evidence/browser/report.json) |
| Identité et rendu | Identifiant, édition, données exactes, période, titre, légende, miniatures WebP vérifiés pour chaque lien ; clavier, swipe mobile, absence de débordement, absence de MapLibre au chargement du carrousel |
| États et accessibilité | Chargement, erreur de miniature, édition absente ; zéro violation axe WCAG A/AA, zéro erreur JS dans les six scénarios |
| Coût | Schéma strict audité, plafond de sortie 6000 inchangé, scénarios tarifés et dépassement de l’ancien plafond indicatif documentés ; aucun appel supplémentaire, coût réel du test 0 € |

La recette navigateur est une projection locale des sélections déterministes sur les données exactes archivées, explicitement marquée comme non publiée. Le bootstrap temporaire a été restauré avant les tests définitifs et le build. Aucune copie de bootstrap de recette n’est commise.

Aucun fichier de workflow, acquisition, SAFRAN/SIM, règle scientifique, moteur PRA, migration, fixture EDIT-03 ou archive publiée existante n’est modifié. L’unique copie d’archive ajoutée est celle du 14 novembre, vérifiée par SHA-256 dans `fixtures/editorial/edit04/manifest.json`. Le script de préparation appelle les calculs déjà existants en lecture des entrées gelées pour vérifier la liaison, sans modifier leur implémentation ni leurs résultats stockés.

Les sorties IA sont contrôlées dans les tests ; cette recette ne prétend pas mesurer qualitativement les choix d’un modèle réel. Les prochaines éditions pourront fournir les tokens retournés par Responses et un coût recalculé au tarif diagnostique. Le montant facturé et le solde du compte OpenAI ne sont pas retournés par ce reçu ; aucun appel supplémentaire de validation n’est ajouté. Activation et retour arrière : [README](README.md#activation-et-retour-arrière).
