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

636 tests web réussis, huit ignorés par les suites existantes ; 458 tests Python
réussis, 35 sous-tests d'ordonnancement/retry. Les tests couvrent : exécution sans
acquisition, commandes d'acquisition isolées/échec fournisseur, rejeu AGRO seul,
reprise, édition publiée préservée, absence de prévisions (OPS-03), historique ancien,
concurrence persistante (T36), réutilisation IA et publication soumise à revue.
Les 17 tests ciblés de la politique manuelle passent, y compris la conversion explicite
d’un dossier de test qualifié vers un nouveau gel de production avec entrées immuables.
Les contrôles de type, lint, contrats, migrations, automation et secrets sont
exécutés avant livraison. Aucune migration SQL OPS-04.

Build Next.js, typechecks web/CLI, lint, contrats, contrôles migrations/automation/secrets réussis. Deux rejeux AGRO complets produisent des fichiers de résultats strictement identiques. La carte est réellement chargée et colorée (`data-ready=true`) avant les captures desktop/mobile.

## Déclenchement GitHub

Tentative réelle depuis la branche poussée : `gh workflow run manual-journal.yml --ref codex/ops-04-manual-journal ...` retourne **HTTP 404** sur `/actions/workflows/manual-journal.yml`. Le nouveau workflow n'est pas encore enregistré sur la branche par défaut. Aucun contournement ni fusion automatique.

Après revue/fusion manuelle de cette PR, exécuter la commande du RUNBOOK avec `--ref main`. Les entrées et le résumé Actions sont versionnés et contrôlés ; les trois modes et l'absence de mutation ont été testés localement. Aucune exécution Actions manuelle réussie n'est revendiquée avant cette activation. La recette locale `dry-run` puis `resume` reste réelle et vérifiée contre les archives Supabase de production.
