# Qualité, sécurité et observabilité — Task 09

Branche : `codex/09-quality-security`. Base rebasée : main Tasks 01–05 `a5c7c90`.
Aucune formule, configuration scientifique, migration ni contrat V1 modifié.

## Installation et checks

Conserver les prérequis Task 01 : Node >=20.9 (CI Node 22), pnpm 10.0.0,
Python 3.12. Les overrides Vitest 4.1.11 imposent Node >=20 ; privilégier Node 22.

```sh
pnpm install --frozen-lockfile
python -m venv .venv
. .venv/bin/activate
python -m pip install -r engine/requirements-dev.lock -e 'engine[dev]'
make check
python scripts/quality/migrations.py --base origin/main
QUALITY_SERVER_SENTINEL=quality-task09-tripwire pnpm check-bundle
pnpm check-budget
```

Le test sentinelle exige de construire avec la même valeur synthétique dans
SUPABASE_SECRET_KEY et SUPABASE_SERVICE_ROLE_KEY. Aucune vraie clé nécessaire.
Le workflow le fait automatiquement. Les guards refusent un bundle absent :
un test sans build ne peut donc pas être présenté comme réussi.

```sh
python -m venv work/tools
work/tools/bin/python -m pip install -r scripts/quality/requirements.lock
work/tools/bin/python -m coverage run --include='*/scripts/quality/security.py,*/scripts/quality/migrations.py,*/scripts/quality/budget.py' -m unittest discover -s tests/quality -p 'test_*.py'
work/tools/bin/python -m coverage report --fail-under=80
npm ci --prefix tests/e2e --ignore-scripts
node tests/e2e/node_modules/playwright/cli.js install --with-deps chromium
pnpm --filter @agriclimax/web exec next start --hostname 127.0.0.1
# Dans un second terminal :
pnpm smoke
pnpm test-e2e
```

Le runner utilise le Chromium Playwright installé. CHROMIUM_EXECUTABLE permet
une installation système locale. Les versions/transitives de Playwright sont
verrouillées dans tests/e2e/package-lock.json. axe-core provient du lockfile web
via eslint-config-next/JSX a11y ; aucun téléchargement pendant les E2E.

## CI et résultats

Quality : guards, couverture minimale 80 % des nouveaux guards de sécurité/
migrations/budget, tests JS de logs, contrats/config, tests Python, Ruff ciblé
sur Task 09, ESLint, typecheck, Vitest, build Next, bundle client, budget,
smoke HTTP et navigateur, migrations SQL sur PostGIS jetable.

Security audits : jobs indépendants JS, Python, navigateur et Gitleaks historique.
Un échec JS ne masque pas l'audit Python. Les audits Python runtime/outillage
conservent leurs deux résultats. JS bloque high/critical ; Python bloque toute
vulnérabilité publiée. Les indisponibilités des services d'audit échouent aussi.
Gitleaks s'exécute sans compte payant et masque les secrets dans ses rapports.
Ne jamais réexécuter un scan avec sortie des valeurs secrètes pour déboguer.

Les actions sont fixées par SHA, l'image PostGIS par digest et Gitleaks par
version + SHA256. Permissions GitHub limitées à contents:read, aucun trigger
pull_request_target, aucun secret cloud consommé. Dependabot propose les mises
à jour des quatre classes de dépendances. L'environnement démo bloque toute
requête navigateur vers une origine distante.

Les rapports CI sont conservés comme artifacts, y compris sur échec : tests
Python, captures/a11y démo, Gitleaks masqué et audits. Ne pas uploader les env,
logs serveur bruts, requêtes ou bundles contenant une éventuelle fuite.

## Portée des checks

La validation de schémas/config respecte celle de Task 01, hors ligne.
check_automation valide les YAML de .github et les clés uniques. Les contraintes
structure/permissions/timeout concernent uniquement les workflows Task 09 pour
ne pas imposer leur politique aux pipelines data des autres Tasks. Actionlint
valide les expressions et la syntaxe Actions de tous les workflows (sans
ShellCheck) ; ce n'est pas un schéma officiel complet des workflows.

Le scan source détecte clés privées, tokens usuels, secrets Supabase/JWT
service_role, noms publics privilégiés et références privilégiées dans les
modules use client. Le scan de .next/static inclut JS, CSS et sourcemaps, les
valeurs évidentes et la sentinelle. Il complète Gitleaks ; aucune regex ne prouve
l'absence de tous secrets encodés/obfusqués. La garde des références privilégiées
est volontairement conservatrice et peut nécessiter revue pour un SDK futur.

Les migrations existantes sont immuables et leurs versions uniques. Le job SQL
réutilise le harness Task 04 sans le modifier, sur PostGIS 17 fixé par digest,
avec matrice public/extensions : quatre migrations, permissions/RLS, publication,
RPC bornées, idempotence, contrats JSON et plans de requêtes sur données fictives.
Il ne remplace pas un test de la plateforme Supabase complète auth/storage.
Le workflow data-ingestion de main est conservé : aucun second pipeline data.

Les E2E couvrent 1440×900, 1024×768 et 390×844 : démo hors ligne, absence
d'overflow, erreurs navigateur, lien d'évitement clavier, dialogues et restauration
du focus mobile, panneau tablette, diagnostic fictif, contexte invalide, thèmes
clair/sombre et catalogue. axe exécute WCAG A/AA sur les deux pages et deux thèmes.
Les violations sont collectées pour tous les formats puis font échouer la suite.
Le smoke teste aussi les trois API invalides (400, no-store, nosniff) et garantit
qu'un contexte live incomplet ne bascule pas vers les fixtures.
Le scanner Task 04 vérifie également la valeur SUPABASE_SECRET_KEY réelle injectée,
en complément de la sentinelle Task 09. Aucun secret n'est imprimé.

Budget initial : total JS/CSS gzip <=2 MiB, HTML démo <256 KiB, navigation locale
networkidle <15 s. Ce sont des smoke budgets conservateurs ; ni score Lighthouse
ni preuve de Core Web Vitals sur appareils réels. Toute modification de budget
exige justification mesurée dans la PR. Le runner peut être relancé avec
QUALITY_ARTIFACTS pour choisir un répertoire de rapports.

## Logs structurés et erreurs

`scripts/quality/logging.mjs` propose un logger NDJSON testable. Il est destiné
aux processus serveur/outillage ; aucune nouvelle route ou dépendance client.
Il émet uniquement timestamp UTC ISO, level, event, run_id, error_code,
duration_ms et demo. Les champs inconnus sont éliminés. Aucun message d'Error,
stack, header, cookie, corps de requête, coordonnées personnelles ou secret.
Les IDs sont des identifiants opérationnels générés, jamais des tokens d'accès.

```js
import { createLogger } from './scripts/quality/logging.mjs';
const log = createLogger();
log({ level: 'error', event: 'ingestion.failed', run_id: 'run-001',
      error_code: 'UPSTREAM_TIMEOUT', duration_ms: 5000, demo: false });
```

| Code | Sens | Action opérateur |
|---|---|---|
| CONFIG_INVALID | Configuration structurelle invalide | Corriger et revalider avant exécution |
| DATA_UNAVAILABLE | Source/donnée indisponible | Afficher l'état absent, vérifier fraîcheur/provenance |
| UPSTREAM_TIMEOUT | Source trop lente | Vérifier la source ; retry borné par l'owner |
| INTERNAL_ERROR | Erreur technique inattendue | Corréler par run_id ; ne pas exposer stack au client |

Ces codes ne classifient jamais le risque ou la confiance. Une erreur de source
ne devient jamais « aucun risque ». Les résultats scientifiques continuent de
porter leurs champs de traçabilité V1 ; les logs opérationnels ne les remplacent
pas. Chaque futur adaptateur pourra adopter le logger dans sa Task, avec ses
propres tests et sans changement de contrat imposé ici.

## Points bloquants observés

Voir `../codex/cross-workstream/09-security-request.md` : alerte braces high sans
correctif annoncé, pytest encore présent sur main ; la RLS métier est désormais couverte par Task 04.
Le shell actuel présente une violation label-content-name-mismatch sur le lien
de marque (signature visible omise du nom accessible). Le gate E2E reste bloquant.
AJV 8.17.1 présente aussi une alerte moderate ; aucun audit n’est masqué.
Aucune suppression d'alerte, allowlist générale ou continue-on-error sur ces gates.
La CI security sera rouge tant que les alertes de dépendances restent présentes.

CODEOWNERS reste une proposition : l'owner d'intégration doit désigner des
mainteneurs réels pour .github/, contracts/ et supabase/migrations/. Aucun owner
GitHub inventé et aucune protection de main modifiée par Task 09.

Gitleaks : .gitleaksignore ne contient qu’un fingerprint historique précis du
hash Git de migration 0004 dans le rapport Task 04. Vérifié par git hash-object
et git cat-file : il s’agit d’un blob SHA-1, pas d’une clé. Aucun chemin ou type
de secret entier n’est exclu. Les alertes de dépendances ne sont pas allowlistées.
