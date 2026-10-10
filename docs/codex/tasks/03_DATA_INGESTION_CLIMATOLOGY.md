# Task 03 — Data Ingestion Climatology

**Branche :** `codex/03-data-ingestion`

## Objectif
Créer le pipeline d'acquisition normalisé, rejouable et idempotent, sans verrouiller le moteur à une source météo unique.

## Scope
- interface `WeatherProvider`;
- provider `DemoWeatherProvider`;
- squelette robuste provider France (configuration URL/format séparée, retries/backoff, checksum) ;
- normalisation UTC/unités ;
- backfill `--from --to`;
- logs structurés, manifest de run ;
- calcul climatologie/percentiles dans une étape séparée ;
- cache fichiers source hors Postgres.
Ne pas simuler une source réelle si accès/format non confirmé.

## Règles communes
Lire `AGENTS.md` et la documentation liée. Ne pas modifier `contracts/` sans procédure. Travailler sur la branche indiquée. Ajouter tests et documentation. À la fin : commandes exécutées, résultats, fichiers modifiés, risques/limites, résumé PR.

## Critères d'acceptation
- un run répétitif ne duplique pas ;
- reprise sur erreur ;
- mode dry-run ;
- fixtures provider ;
- traçabilité source/retrieved_at.
