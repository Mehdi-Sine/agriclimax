# Frontières OPS-04

- Python conserve les acquisitions. `manual_sources.py` appelle les adaptateurs existants dans des répertoires isolés, sans persistance météo Supabase ni publication de pointeur. Les réponses partielles et échecs restent explicites.
- `nightly_prepare.ts` extrait la préparation existante de T36. Le cron garde les mêmes horaires, valeurs par défaut et règles de sélection. Les options locales permettent le recalcul/les nouvelles archives sans changer un gel de production.
- `manual_indicators.ts` capture les entrées AGRO-02 par ensemble de variables et rejoue le moteur pur pour les 713 identités. Les faits transmis au contrat T33 sont projetés explicitement ; les résultats complets restent dans l'artefact. Les cartes communes à plusieurs productions ne dupliquent pas les mêmes séries.
- `manual_journal.ts` porte les modes et le rapport. Le dry-run utilise des lectures RPC et fichiers locaux seulement ; aucune approbation humaine ou publication implicite. `resume` délègue l'étape manquante au propriétaire T36. `publish` lit le commutateur et les revues existantes avant promotion, puis vérifie la consultation.
- La preview utilise le lecteur d'archives existant et un jeu de cartes local sélectionné par configuration. Aucune nouvelle authentification ni nouvelle architecture d'hébergement. `/api/manual-journal` n'offre aucun jeu de données sans répertoire de test local configuré.
- Le workflow manuel sérialise ses exécutions par date ; les admissions persistantes gardent les verrous Supabase de T36/OPS-03. Le code n'ajoute aucun appel OpenAI en dry-run. Une narration existante n'est jamais attachée à un autre bundle.

Aucune migration SQL OPS-04 nécessaire. Aucun changement des tables, secrets ou contrôles de publication. Aucun recalcul scientifique réimplémenté ; aucune modification du workflow nocturne.
