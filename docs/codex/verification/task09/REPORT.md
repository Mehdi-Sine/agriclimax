# Task 09 — vérification qualité / sécurité / observabilité

Date : 10 octobre 2026. Branche : `codex/09-quality-security`.
Base exacte : `5c2426f7510693143b4494107bb647b32a1b65e4`, main avec Task 01 mergée.

## Résultat

Les checks fonctionnels, contrats, lint/typecheck/build, guards, E2E/a11y et
migrations passent localement. **La sécurité dépendances n'est pas verte** :
braces high sans correctif publié, pytest vulnérable dans le lockfile hérité.
La PR doit conserver ces résultats visibles et ne doit pas être présentée comme
prête à merger. Aucun merge effectué.

## Checks exécutés

| Contrôle | Résultat |
|---|---|
| pnpm 10.0.0 install puis lockfile cohérent | OK |
| Python 3.12.14, requirements-dev.lock + editable engine | OK |
| make check (PNPM/PYTHON adaptés au runtime) | OK |
| ESLint web, zéro warning | OK |
| next typegen + tsc --noEmit | OK |
| Vitest 4.1.11 | 3 tests OK |
| pytest engine | 10 tests OK |
| Guards Python Task 09 | 7 tests OK |
| Logs structurés node --test | 2 tests OK |
| Coverage des guards sécurité/migrations/budget | 82 %, seuil CI 80 % |
| Ruff sur scripts/quality et tests/quality | OK |
| Contrats V1, formats, fixtures et YAML config | OK |
| YAML automation, clés uniques, permissions Task 09 | OK |
| Actionlint 1.7.7, sans ShellCheck | OK |
| Next.js 16.4.0 production build | OK |
| .next/static : patterns sensibles + sentinelle | OK, aucune fuite détectée |
| Total JS/CSS client gzip | 174 695 octets, budget 2 097 152 |
| Gitleaks 8.24.2 historique | OK, aucun secret détecté |
| Smoke HTTP du serveur production local | OK |
| E2E desktop/tablette/mobile | OK |
| axe WCAG A/AA aux trois tailles | 0 violation détectée |
| Migrations forward-only vs origin/main | OK, aucune modification SQL |
| Deux migrations sur PostGIS PostgreSQL 16 | OK, 5 tables attendues présentes |
| pnpm audit high/critical après correctifs | ÉCHEC : 1 high, 0 critical |
| pip-audit engine lock | ÉCHEC : pytest 8.4.2 |
| pip-audit lock des outils Task 09 | OK |
| npm audit outils navigateur | OK |
| git diff --check | OK |

Les traces détaillées figurent dans results.json et commands.log. Les rapports
CI sont configurés mais GitHub Actions n'a pas été exécuté par cette vérification
locale. Les audits utilisent les bases de vulnérabilités publiées au moment du test.

## Responsive et accessibilité

Captures : screenshots/desktop.png (1440×900), tablet.png (1024×768),
mobile.png (390×844). Le rapport screenshots/report.json contient les durées
939/771/723 ms et zéro violation axe pour chaque viewport.
Pas de débordement horizontal, démo visiblement fictive, langue fr et main visible,
aucune requête navigateur distante, aucun pageerror/console.error.
Le contexte URL invalide/vide conserve le marqueur de démo. Reduced-motion
est activé dans le navigateur. La page Task 01 n'a pas de contrôles interactifs :
le Tab conditionnel n'est pas une validation des futurs composants clavier.
Les captures montrent la fondation actuelle, sans travail Task 05.

## Vulnérabilités détectées et corrections

L'audit initial JS remontait 2 moderate, 1 high et 2 critical. Les overrides
racine Vitest 4.1.11 et Tinypool 2.1.2, avec lockfile mis à jour, suppriment les
alertes GHSA-82fw-gwwq-j7x9, GHSA-5gmw-xhrv-c9v3 et GHSA-85c8-ppgw-ccpr.
Aucun package.json web ni fichier métier modifié ; les 3 tests existants passent
avec le nouvel outillage. L'override Tinypool conserve une résolution corrigée
si cette dépendance réapparaît après intégration.

Reste `braces==3.0.3`, GHSA-vfj7-8cjw-p6xm, high, transitif de eslint-config-next.
L'avis indique aucune version corrigée. Aucun ignore ni patch non vérifié ajouté.

Python : pytest 8.4.2, PYSEC-2026-1845 / GHSA-6w46-j5rx-g56g / CVE-2025-71176.
Correctif annoncé >=9.0.3, mais engine/pyproject.toml borne pytest<9.
La note `../../cross-workstream/09-security-request.md` demande le correctif
à Task 02 conformément à la séparation des dossiers propriétaires.
Aucun fichier engine/ modifié par Task 09.

## Périmètre et limites

Contrats consommés : map-feature V1, risk-result V1 et watch-signal V1 via
les checks existants. Contrats changés : aucun. Config/règles/formules : aucune
modification. Migrations : aucune. Aucun accès à une base cloud ou vrai secret
nécessaire ; seul le faux tripwire a été transmis au build de contrôle.

La RLS du starter n'est pas configurée. Task 04 reçoit une note explicite,
sans intervention dans son domaine. Le harness SQL ne simule pas auth/storage.
Les checks de bundle sont conservateurs et ne couvrent pas toute obfuscation.
Le budget est un smoke budget, pas une mesure terrain Core Web Vitals.
La couverture de 82 % concerne les nouveaux guards ciblés, pas toute l'application.
Le logger proposé est un utilitaire testé ; il n'est pas injecté dans les moteurs
ou services développés en parallèle.

## Environnement

Le checkout initial était le starter. Le snapshot main a d'abord été importé
par le connecteur GitHub avec validation des SHA blobs/trees/commit ; un git fetch
réseau normal a ensuite rétabli l'historique complet. La branche pointe sur la
base GitHub réelle, sans commit de foundation recréé ou mélangé à Task 09.

Node local 24.19.0 ; CI prévue Node 22. pnpm système initial 11 incompatible :
shim local vers pnpm 10.0.0 uniquement dans work/, sans modification du produit.
Le premier build sandboxé échouait sur la capture TypeScript ; le même build
avec le profil réseau du runtime passe. La suite finale a été exécutée dans ce
profil sans contourner le proxy ni désactiver TLS.
Chromium système utilisé localement ; CI installera celui de Playwright 1.62.1.
PostGIS image : digest sha256:94146ac37bc61e2322f88016056c5920729cb8c64c8542ed590af8fc2abdac07.
La DB jetable est supprimée à la fin de son test.

## Fichiers impactés

- Racine : .gitignore, Makefile, README.md, package.json, pnpm-lock.yaml.
- .github : workflows/quality.yml, workflows/security.yml, dependabot.yml,
  pull_request_template.md.
- scripts/quality : security.py, migrations.py, budget.py, smoke.py,
  check_automation.py, logging.mjs, requirements.lock.
- tests/quality : test_guards.py, test_automation.py, logging.test.mjs.
- tests/e2e : demo.mjs, package.json, package-lock.json.
- docs/ops/QUALITY_SECURITY.md, docs/codex/cross-workstream/09-security-request.md.
- Ce dossier : REPORT.md, PR_SUMMARY.md, commands.log, results.json,
  screenshots/{desktop,tablet,mobile}.png et screenshots/report.json.
