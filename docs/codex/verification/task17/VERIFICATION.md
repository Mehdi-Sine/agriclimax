# Task 17 — vérification

Base : dernier main vérifié `8b73bfd`, branche `codex/17-daily-live-pipeline`.
Identité Git configurée : Mehdi-Sine <mehdi.sine@acta.asso.fr>.

- `make check` : PASS ; 126 tests Python, 176 tests web, qualité/contrats,
  lint, typecheck, build et portée de l'exception d'audit existante.
- Tests nouveaux pipeline : 10 PASS. Sources synthétiques marquées dans les tests ;
  pas de conclusion sur la disponibilité réelle Météo-France.
- Ruff/mypy sur les nouveaux modules : PASS.
- Actionlint 1.7.7 : PASS (binaire/checksum épinglés comme dans la CI).
- Gitleaks 8.24.2 historique : PASS, aucun secret trouvé ; scan staged complémentaire
  effectué avant commit.
- `pnpm audit --audit-level high` : PASS avec l'exception existante
  GHSA-vfj7-8cjw-p6xm (braces 3.0.3, outillage dev, aucun chemin production).
- pip-audit : aucune vulnérabilité connue sur les trois lockfiles Python.
- Bundle security, clés client, budgets, migration forward-only : PASS.
- SQL/PostGIS local jetable, deux schémas `public` et `extensions` : PASS.
  Toutes les migrations, RLS/permissions, contrats, plans, publication initiale,
  replay sans doublon, refus snapshot incomplet et rollback atomique vérifiés.
  Aucun accès anonyme/authenticated ajouté ; RPC invoker, search_path fixe,
  données privées append-only. Le compteur de tables RLS est passé de 19 à 20.

Les dépendances requises ont été installées depuis les lockfiles ; aucun
lockfile modifié. pnpm 10.0.0 utilisé (la version globale 11 ne convient pas).
Les tests et audits n'ont pas utilisé de credentials de production.

## Limites opérationnelles

Aucune migration distante appliquée, aucun cron live lancé depuis la branche draft,
aucune fusion. L'activation exige migration et secrets GitHub, puis variable
`AGRICLIMAX_DAILY_ENABLED=true` après un essai manuel ; voir le runbook.
Le changelog Supabase était inaccessible (HTTP 403) ; les conventions de fonctions
invoker/permissions ont été vérifiées par la documentation MCP et les tests SQL.
Pas de modification UI ni de validation responsive nécessaire. Les bovins sont
persistés dans le snapshot privé ; l'UI conserve ses chemins de lecture existants.

Le cron DPClim est transféré au pipeline unifié. L'ancien workflow reste disponible
manuellement pour les observations horaires, que cette tâche ne calcule pas.
Les reçus sont conservés 30 jours dans Actions, les publications réussies dans
la DB privée ; le point de reprise est documenté par étape dans le runbook.
