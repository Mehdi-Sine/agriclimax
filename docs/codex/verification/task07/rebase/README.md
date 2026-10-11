# Rebase et intégration Task 07

Date : 2026-10-11. Base main : `bde2ab2` (Tasks 06/08 intégrées).
Branche `codex/07-watch`, PR #23 draft, aucun merge.

`git fetch origin main codex/07-watch` puis `git rebase origin/main` : aucun
conflit. Le commit initial `9946cf2` devient `9e829e7`.
Identité configurée depuis le profil GitHub connecté :
`Mehdi-Sine <mehdi.sine@acta.asso.fr>`.

Toutes les fonctionnalités Task 07 sont conservées : `/watch`, filtres GET,
cartes compacte/détaillée, détail, provenance, EvidenceBundle fermé et narration
déterministe désactivable sans LLM. Aucune modification des modèles, providers,
preuves, règles scientifiques, contrats ou migrations.

Raccordements : shell Task 05 → `/watch` et redirection des anciens liens ;
Task 08 via son `diagnosticHref` avec cell/production/indicator/date/rule/version
exacts ; Task 06 avec bbox/zoom conservés aussi en démo, territoire et comparaison.
Un test charge réellement le loader du diagnostic et retrouve le résultat du
signal. Le BrandLockup plus récent de main est réutilisé. Le smoke Task 09 suit
le parcours shell → veille → détail → diagnostic.

Les seuls changements hors Task 07 portent sur quelques lignes d’intégration
de `app/page.tsx`, `components/shell/product-shell.tsx`, `tests/e2e/demo.mjs`.
Aucun fichier carte/diagnostic/UI, lockfile, guard, workflow, budget ou exception
de sécurité de main remplacé. AJV 8.18.0 et pytest 9.0.3 sont conservés.

## Commandes et résultats

pnpm 10.0.0 via PATH `/workspace/.agriclimax-setup/tools/node_modules/.bin`.
Python installé dans `work/python` depuis les lockfiles moteur et qualité.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
PYTHONPATH=engine/src work/python/bin/python -m pytest engine/tests
PYTHONPATH=engine/src make check PYTHON=$PWD/work/python/bin/python
pnpm check-bundle
pnpm check-budget
work/python/bin/python scripts/quality/smoke.py
node scripts/quality/audit-exceptions.mjs --build
pnpm audit --audit-level high
npm audit --prefix tests/e2e --audit-level high
work/python/bin/pip-audit --strict --disable-pip --no-deps -r engine/requirements-dev.lock --format json
work/python/bin/pip-audit --strict --disable-pip --no-deps -r scripts/quality/requirements.lock --format json
work/gitleaks/gitleaks git --redact --exit-code 1 --report-format json .
```

Succès : lint sans warning, typecheck, 106 tests web, 44 tests Python, build,
make check, contrats/qualité/migrations, smoke HTTP, scans de secrets et budget.
Bundle gzip : 565269 octets / 2097152 autorisés. Gitleaks 8.24.2 (archive vérifiée
par le hash du workflow) : aucun leak. Audits Python/outils/navigateur : aucune
vulnérabilité connue. Unique exception JS héritée : braces 3.0.3,
GHSA-vfj7-8cjw-p6xm, limitée au dev ; zéro chemin production et 12 traces serveur
contrôlées. Aucun seuil ni exclusion ajouté, expiration de main inchangée.

Le sandbox bloquait initialement `spawnSync pnpm` du guard existant. Le même
make check a passé avec permissions adaptées, sans modifier le guard.

## Navigateur

Chromium local, next start sur 127.0.0.1:3000, requêtes externes bloquées.

```sh
WATCH_ARTIFACTS=docs/codex/verification/task07/rebase node docs/codex/verification/task07/verify-browser.mjs
QUALITY_ARTIFACTS=docs/codex/verification/task07/rebase/shell CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/e2e/demo.mjs
OBSERVATION_ARTIFACTS=docs/codex/verification/task07/rebase/observation CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/e2e/observation.mjs
DIAGNOSTIC_ARTIFACTS=docs/codex/verification/task07/rebase/diagnostic CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/e2e/diagnostic.mjs
```

Desktop 1440×900, tablette 1024×768, mobile 390×844 : filtres, liste/détail,
vide, live indisponible, thèmes, clavier, focus sheet, anciens liens et parcours
Veille → Diagnostic → Carte → Veille. 25 états axe passent, zéro overflow,
erreur navigateur ou requête externe. Suites shell/observation/diagnostic passent.
Le premier lancement parallèle d’Observation a relevé un bbox différent au
reload ; sa relance isolée passe sans changement au code carte ni assertion
affaiblie. Le signal intermittent est consigné ici.

Captures actuelles dans ce dossier et ses sous-dossiers. Les preuves du dossier
parent restent historiques. Axe/Chromium ne sont pas une certification WCAG ni
une vérification sur appareil physique.

## Livraison et Preview

Le rebase est poussé avec un lease explicite sur le HEAD distant de la PR pour
protéger les modifications concurrentes. Aucun push sur main ni merge.
Vercel est redéclenchée par le push GitHub ; statut et URL du commit final sont
reportés dans le suivi de la PR #23, avec les limites d’accès Preview éventuelles.
Le build local n’est pas présenté comme une validation de Preview.
