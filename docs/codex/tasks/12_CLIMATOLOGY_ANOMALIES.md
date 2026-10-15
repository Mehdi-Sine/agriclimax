# Task 12 — Climatology / anomalies

Branche : `codex/12-climatology-anomalies`, depuis main après Task 11 Météo-France.
Cette tâche explicitement demandée remplace l'ancien intitulé Task 12 Sentinel
pour cette livraison. Aucune télédétection, RPG ou autre Task n'est exécutée.

Objectif : référence historique homogène ERA5-Land, séparée des observations live
Météo-France ; normales, anomalies, percentiles, fréquences empiriques et position
historique de périodes homologues. Calculs indépendants des productions.

Période, méthode, unités, support spatial, date de récupération, version et
provenance explicites. Pas d'imputation de variable absente, d'interpolation
agricole prétendue ni de résultat marqué validé sans gouvernance.
Stockage Supabase par migration additive inspectée, retries/reprise/idempotence.
Acceptation : petit backfill **réel**, comparaison Task 11 vérifiée, contrôles
Python/contrats/lint/typecheck/build/audits/make check, documentation et preuves,
branche poussée, PR draft vers main, aucun merge.

État et limites : `docs/codex/verification/task12/VERIFICATION.md`.
