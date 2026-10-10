# Task 09 — Quality Security Observability

**Branche :** `codex/09-quality`

## Objectif
Installer les garde-fous permettant à plusieurs agents de développer sans dégrader sécurité, contrats ou UX.

## Scope
- CI JS/Python/contracts/migrations ;
- Playwright parcours critiques ;
- a11y automatisée ;
- secret scanning/dependency audit ;
- test bundle client pour absence de service role ;
- structured logging conventions ;
- run health page/admin minimal si nécessaire ;
- budgets performance web ;
- templates PR + CODEOWNERS suggéré.

## Règles communes
Lire `AGENTS.md` et la documentation liée. Ne pas modifier `contracts/` sans procédure. Travailler sur la branche indiquée. Ajouter tests et documentation. À la fin : commandes exécutées, résultats, fichiers modifiés, risques/limites, résumé PR.

## Critères d'acceptation
- CI échoue sur contrat invalide, secret évident, type error et tests ;
- E2E desktop + mobile ;
- rapports exploitables sans service payant obligatoire.
