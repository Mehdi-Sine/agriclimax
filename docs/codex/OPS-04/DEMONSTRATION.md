# Recette OPS-04 du 11 novembre 2026

Précondition vérifiée : PR #78 fusionnée dans main, commit `5d5e486`.
Branche dédiée : `codex/ops-04-manual-journal`.

## Exécutions réelles locales

1. `dry-run`, sans acquisition, recalcul AGRO activé : terminé, aucun appel OpenAI.
   Réanalyses du 29 octobre au 4 novembre et prévisions des 11–12 novembre ;
   92 690 mesures production/indicateur/PRA calculées par le moteur existant.
   Deux groupes de 713 PRA ; 40 cartes de recettes communes sans duplication par production.
   Réanalyse datée de sept jours, couverture historique complète 645/713 PRA.
   Dossier et texte déterministe de test valides, revue sémantique requise.
2. `resume`, sans acquisition ni recalcul : réutilisation du snapshot et de la
   révision 2 compatibles ; consultation de production vérifiée ; zéro appel IA.
3. Deux rejeux des entrées capturées, sans réseau ni IA : empreintes de résultats
   identiques pour chaque groupe. Les résultats ne sont pas promus en publication.

Contrôle Supabase après la recette : snapshot
`2e9ed6d01173cb0851505863ecd28c3e916fe0a10de3a92f2fb5769987d8446e` intact ;
les deux archives et leurs checksums OPS-03 inchangés ; un seul appel OpenAI
historique, aucun appel nouveau ; aucune publication certifiée ajoutée,
`publication_enabled=false` conservé.

## Interface

Preview locale sur les composants existants : Journal du 11 novembre, notice de
secours déterministe, cartes de test, 713 identités uniques par carte, dates de
réanalyse explicites, liens Sources & méthodes. Captures desktop/mobile et
rapport navigateur dans le répertoire de travail de recette. Aucun changement du
Journal courant ni de ses choix UX.

## Vérifications

632 tests web réussis, huit ignorés par les suites existantes ; 458 tests Python
réussis, 35 sous-tests d'ordonnancement/retry. Les tests couvrent : exécution sans
acquisition, commandes d'acquisition isolées/échec fournisseur, rejeu AGRO seul,
reprise, édition publiée préservée, absence de prévisions (OPS-03), historique ancien,
concurrence persistante (T36), réutilisation IA et publication soumise à revue.
Les contrôles de type, lint, contrats, migrations, automation et secrets sont
exécutés avant livraison. Aucune migration SQL OPS-04.

Les résultats Actions et le build sont consignés après la recette distante.
