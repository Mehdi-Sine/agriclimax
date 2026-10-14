# Vérification V0.1

## Préalables et plan

`git fetch origin main` puis vérification des merges :
01 `5c2426f`, 02 `6559790`, 03 `dfbd981`, 04 `e3c14d6`, 05 `a5c7c90`,
06 `9159764`, 07 `c2b203a`, 08 `bde2ab2`, 09 `be3711e`.
Le checkout fourni était en retard (`9159764`) et son origin/main était ancien ;
aucune intégration n’a été fondée sur ces refs obsolètes.

Lecture AGENTS racine/web, Task 10, ORCHESTRATION, code/tests des parcours,
repository/API, rapports Tasks 07/08 et exception de sécurité.
`make check` lancé avant modification : premiers essais bloqués par l’environnement
(pytest absent, spawn pnpm interdit, dépendances non installées). Après installation
verrouillée et permissions réseau de commande, la suite complète passe.
`baseline-check.log` conserve ce contrôle ; il a été lancé avant les corrections.

Incohérences identifiées : cellule perdue au retour d’un diagnostic direct,
sélection courante perdue par reconstruction d’URL shell, navigation diagnostic
shell différente du deep-link, règle/version manquantes du lien signal → carte,
identifiants pointés acceptés par l’API mais rejetés par l’UI, deux chevauchements
mobiles. Veille live indisponible : limite conservée, pas de fallback ajouté.

Plan annoncé avant modification : conserver le contexte entre espaces, corriger
les raccordements sans toucher la science, vérifier parcours/formats/états, puis
documenter et livrer une PR draft avec Preview. Frontières affectées : URL et
shell, présentation diagnostic/veille/carte, tests d’intégration et CI qualité.
Repository, moteur, contrats, DB et RLS restent inchangés.

## Commandes

```sh
export PATH=/workspace/.agriclimax-setup/tools/node_modules/.bin:$PATH
pnpm install --frozen-lockfile --store-dir /workspace/.agriclimax-setup/pnpm-store
python -m venv work/python
work/python/bin/pip install -r engine/requirements-dev.lock -r scripts/quality/requirements.lock
PYTHONPATH=engine/src make check PYTHON=$PWD/work/python/bin/python
pnpm audit --audit-level high
npm audit --prefix tests/e2e --audit-level high
work/python/bin/pip-audit --cache-dir work/audit-cache --strict --disable-pip --no-deps -r engine/requirements-dev.lock --format json --output work/python-audit.json
work/python/bin/pip-audit --cache-dir work/audit-cache --strict --disable-pip --no-deps -r scripts/quality/requirements.lock --format json --output work/tools-audit.json
work/gitleaks/gitleaks git --redact --exit-code 1 --report-format json --report-path work/gitleaks.json .
work/python/bin/python scripts/quality/security.py --bundle apps/web/.next/static
work/python/bin/python supabase/scripts/check_client_secrets.py
work/python/bin/python scripts/quality/budget.py
work/python/bin/python scripts/quality/smoke.py
NODE_USE_ENV_PROXY=1 pnpm --filter @agriclimax/web exec next start --hostname 127.0.0.1
CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/e2e/demo.mjs
OBSERVATION_ARTIFACTS=work/observation-browser CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/e2e/observation.mjs
DIAGNOSTIC_ARTIFACTS=work/diagnostic-final node tests/e2e/diagnostic.mjs
INTEGRATION_LIVE=real INTEGRATION_ARTIFACTS=docs/codex/verification/task10/screenshots node tests/e2e/integration.mjs
```

Node 24 nécessite `NODE_USE_ENV_PROXY=1` dans cet environnement : sans ce réglage
les appels fetch serveur échouent en DNS et renvoient une erreur explicite 502.
Il s’agit du transport de l’environnement ; aucune modification du repository
ni désactivation TLS. Secrets hérités utilisés sans les afficher ou les copier.

## Résultats et preuves

`make check` : lint, typecheck, 109 tests web, 44 tests Python, contrats V1,
qualité, automation, migrations forward-only, build Next et guard de l’exception.
Audits Python moteur/outillage et navigateur : aucune vulnérabilité connue.
JS : seule exception héritée braces, zéro chemin production, 12 traces vérifiées.
Gitleaks et scans source/client : aucun secret détecté.

`supabase/tests/integration-empty.sql` a été exécuté en lecture seule via MCP
sur DEV : sept assertions vraies, trois RPC vides, RLS des tables métier,
rôle lecteur sans bypass et droits EXECUTE conformes à 0004. Les quatre migrations
0001–0004 sont présentes. Aucun DDL, modification RLS, donnée métier ou seed.
`sql-verification.json` et `live-api.json` attestent les résultats.
Les suites historiques SQL avec fixtures transactionnelles restent inchangées ;
elles ne sont pas exécutées sur DEV. Leur exécution isolée est assurée par la CI
existante (public/extensions) et suivie dans DELIVERY.md.

E2E : accueil → carte, sélection, diagnostic, deep-link sans territoire, retour
restaurant cellule, navigation shell Diagnostic, carte → veille → détail →
diagnostic, égalité règle/version des liens, demo, Supabase live réellement vide,
veille live non connectée, erreurs HTTP et transport simulées.
Formats : 1440×900, 1024×768, 390×844. Contrôles axe WCAG 2/2.1 AA, absence
de débordement global, absence de requêtes externes du navigateur, MapLibre visible.
Les suites existantes couvrent clavier, focus sheet, thèmes, loading, stale et vide.

La CI ajoute `tests/e2e/integration.mjs` sans credentials : collection vide
explicitement simulée côté API navigateur, diagnostic live non configuré.
Ce mode n’est pas présenté comme une connexion Supabase réelle. Pour reproduire
le contrôle réel, passer `INTEGRATION_LIVE=real` avec les variables serveur prêtes.
Un serveur de test sans variables Supabase sur le port 3001 valide le mode CI.

Inspection visuelle des captures carte/diagnostic/veille aux trois formats.
Corrections : action diagnostic sous la validité du bottom sheet, marge basse
veille empêchant la navigation fixe de recouvrir le dernier contenu. Assertions
spatiales ajoutées à l’E2E mobile. Captures pleine page et viewport conservées.
Axe complète l’inspection ; aucun statut de certification WCAG n’est revendiqué.

Vérification complémentaire : pip check et ruff passent ; couverture des guards
82 % (seuil 80 %), actionlint 1.7.7 passe, migrations inchangées contre origin/main.
Les relances E2E après rebuild ont d’abord rencontré un serveur Next orphelin
occupant 3000 et servant des chunks obsolètes : serveur remplacé, suites finales
relancées avec succès, sans modifier MapLibre ni affaiblir les assertions.

La CI a ensuite reproduit une course préexistante : le moveend différé réécrivait
l’URL avec la sélection du dernier render pendant la navigation RSC. Correction :
la ref de contexte est mise à jour immédiatement à chaque intention, caméra
comprise ; la publication URL reste débouncée et compare l’URL réellement visible.
Un E2E retient volontairement la réponse RSC, déclenche zoom et sélection dans
le même tour, puis exige cellule conservée et zoom +1 après libération. Le timeout
ayant révélé le défaut est conservé, sans attente artificielle avant sélection.
