# Task 17 — Pipeline quotidien live

Branche `codex/17-daily-live-pipeline`, depuis `main` 8b73bfd.
Demande : ingestion Météo-France, validation, persistance, calcul blé, calcul bovins,
mise à jour des indicateurs, logs/contrôles et idempotence. GitHub Actions manuel
et quotidien, retries bornés, timeout, concurrency, artifacts sans secrets.
Conserver la dernière donnée valide en cas d'échec source, échouer proprement et
documenter la reprise. Tests, audits, make check, push et PR draft sans merge.

Frontières : orchestration et ingestion ; DB/API pour publication atomique privée ;
consommation des fonctions scientifiques existantes sans changer leurs règles,
les contrats partagés ou l'UI. Pas de migration distante pendant cette tâche.
