# Orchestration Codex — AgriclimaX

## Stratégie
**Contract-first → workstreams isolés → integration owner unique → hardening.**

## Wave 0 — bloquante
Task 01 seule : foundation, contrats, validation, mode démo, architecture du monorepo.

## Wave 1 — parallèle après merge de Task 01
| Task | Workstream | Écrit principalement |
|---|---|---|
| 02 | Science engine | `engine/`, `config/` |
| 03 | Data ingestion | `engine/.../ingestion`, `scripts/`, workflows data |
| 04 | DB/API | `supabase/`, server repositories |
| 05 | Product shell/design | `apps/web/components/ui`, styles, assets, layout |
| 06 | Observation | `apps/web/features/observation` |
| 07 | Veille/IA | `apps/web/features/watch`, server narrative service |
| 08 | Diagnostic | `apps/web/features/diagnostic` |
| 09 | Quality/security | tests, CI, tooling, docs ops |

### Règle
Un agent n'édite pas le dossier primaire d'un autre agent. Si nécessaire, il ouvre une note `docs/codex/cross-workstream/<task>-request.md` plutôt que de modifier directement.

## Wave 2
Task 10 : intégration par un owner unique. Résoudre incompatibilités, pas redesign.

## Wave 3
Tasks 11 (RPG/exposure) et 12 (Sentinel) parallèles.

## Wave 4
Task 13 production hardening puis Task 14 pilote scientifique.

## Merge order conseillé Wave 1
09 (outillage non bloquant) → 02/03/04 → 05 → 06/07/08. Rebase avant merge. Task 10 valide l'ensemble.

## Definition of Done PR
- scope respecté ;
- contrats consommés listés ;
- aucun contrat modifié sans procédure ;
- tests automatisés ;
- vérification manuelle documentée ;
- impact scientifique/security/migration ;
- captures desktop + mobile pour UI ;
- aucune donnée démo non marquée ;
- aucun secret/client leakage.
