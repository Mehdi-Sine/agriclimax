# Task 11 — Météo-France live ingestion

**Branche :** `codex/11-meteofrance-live`, depuis `main` après Task 10.

Tâche prioritaire explicitement demandée à la place de la Task 11 RPG dans cette
session. RPG reste une tâche future distincte.

Provider `meteofrance` dans l'architecture Task 03, auth environnement, stations
et métadonnées, archives quotidiennes Tmin/Tmax/TM/UM/RR, ETP source conservée si
disponible avec qualification de méthode ; observations récentes séparées.
Normalisation, provenance, fraîcheur, données absentes/partielles, retries bornés,
idempotence, backfill et correction quotidienne, persistance Supabase/PostGIS.
Petit ensemble métropolitain MVP, sans interpolation ni grille continue.
ERA5-Land reste une future climatologie/fallback, pas le live principal.

Inspection Supabase et proposition de migrations avant toute écriture distante.
Aucune migration destructive. Aucun token hardcodé ou livré au navigateur.
Mode `live_meteofrance` testable séparément de la démo, sans fallback fictif.

Acceptation : backfill réel d'au moins 30 jours sur plusieurs stations, contrôle
Supabase et réponse jusqu'aux endpoints, tests/lint/typecheck/build/audits/make check,
preuves dans `docs/codex/verification/task11/`, branche poussée, PR draft sans merge.
Un manque d'accès API doit arrêter proprement avec la variable/subscription requise,
après préparation du provider. Ne pas publier une règle fictive comme risque live.
