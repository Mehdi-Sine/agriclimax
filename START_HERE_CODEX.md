# START HERE — procédure Codex AgriclimaX

## 0. Créer le dépôt

Créer un dépôt GitHub `agriclimax` et y déposer **le contenu de ce dossier** à la racine. Protéger `main` : PR obligatoire, checks obligatoires, pas de push direct.

## 1. Première tâche Codex — Wave 0 uniquement

Copier/coller ce prompt dans une nouvelle tâche Codex :

---
You are the principal engineer and product architecture guardian for **AgriclimaX**.

The canonical product name is `AgriclimaX`; use `agriclimax` for lowercase technical identifiers. This is a scientific agricultural climate-risk platform, not a generic dashboard.

Read in this order:
1. `AGENTS.md`
2. `README.md`
3. `docs/product/PRODUCT_CHARTER.md`
4. `docs/architecture/SYSTEM_ARCHITECTURE.md`
5. `docs/architecture/BOUNDARIES.md`
6. `docs/science/SCIENTIFIC_GOVERNANCE.md`
7. `docs/design/BRAND_GUIDELINES.md`
8. `docs/design/UX_ARCHITECTURE.md`
9. `contracts/README.md`
10. `docs/codex/ORCHESTRATION.md`
11. `docs/codex/tasks/01_FOUNDATION_CONTRACTS.md`

Inspect the repository before changing anything. Execute **Task 01 only** on branch `codex/01-foundation-contracts`.

Non-negotiable constraints:
- preserve the distinction hazard / exposure / sensitivity / risk / confidence;
- scientific thresholds come from versioned config, never UI colors;
- AI narrative may only use structured evidence supplied to it and must expose provenance;
- no service-role key in browser code;
- demo data must be visibly labelled fictitious;
- desktop and mobile are different compositions sharing the same design system;
- do not add Kubernetes, Redis, a queue, GeoServer, a microservice framework or a second UI framework without a benchmarked need and an ADR;
- do not silently rename persistent identifiers merely to remove legacy terminology;
- no unreviewed scientific parameter is labelled “validated”.

Required end state for Task 01:
- install succeeds;
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` succeed where implemented;
- Python unit tests succeed;
- schema/config validation succeeds;
- demo mode runs with no cloud credentials;
- contract fixtures are generated/checked;
- provide a PR summary including contracts consumed/changed, migrations, security, scientific impact, tests and limitations.

STOP after Task 01. Do not start another task.
---

## 2. Après merge de Task 01

Lancer les tâches de **Wave 1 en parallèle**, chacune dans sa branche. Les prompts sont autonomes :

- Task 02 — moteur scientifique
- Task 03 — ingestion & climatologie
- Task 04 — PostGIS/API & géospatial
- Task 05 — shell produit & design system
- Task 06 — observation cartographique
- Task 07 — veille & provenance IA
- Task 08 — diagnostic scientifique & graphiques
- Task 09 — qualité, sécurité, observabilité

Ne pas laisser deux tâches modifier un contrat partagé. Toute proposition de changement de `contracts/` devient une PR séparée `contract-change/*` et bloque l'intégration tant qu'elle n'est pas revue.

## 3. Wave 2

Exécuter Task 10 — intégration end-to-end, uniquement quand les branches Wave 1 sont vertes.

## 4. Wave 3

Exécuter Task 11 — RPG / exposition agricole, puis Task 12 — Sentinel/télédétection. Elles peuvent être lancées en parallèle après la V1 météo stable.

## 5. Wave 4

Exécuter Task 13 — hardening production et Task 14 — préparation du pilote scientifique.

Voir `docs/codex/ORCHESTRATION.md` pour la matrice de dépendances et les règles de merge.
