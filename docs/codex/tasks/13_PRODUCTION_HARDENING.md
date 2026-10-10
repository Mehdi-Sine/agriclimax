# Task 13 — Production Hardening

**Branche :** `codex/13-production-hardening`

## Objectif
Passer du prototype staging à un service exploitable de façon fiable et sobre.

## Scope
- threat model ;
- backups/restore ;
- migration runbook ;
- retries/alerts sur pipeline ;
- SLO fraîcheur ;
- quotas/cost guardrails ;
- cache ;
- perf carte ;
- privacy/analytics opt-in si analytics ;
- runbook incident ;
- dépendances/licences.

## Règles communes
Lire `AGENTS.md` et la documentation liée. Ne pas modifier `contracts/` sans procédure. Travailler sur la branche indiquée. Ajouter tests et documentation. À la fin : commandes exécutées, résultats, fichiers modifiés, risques/limites, résumé PR.

## Critères d'acceptation
- restore testé ;
- pipeline failure visible ;
- stale banner automatique ;
- aucune dépendance critique non documentée ;
- budget de coût mensuel estimé par environnement.
