# Task 11 — livraison Météo-France live

## Résultat

Depuis `main 5df60e3` après Task 10, branche/worktree
`codex/11-meteofrance-live`, identité demandée configurée avant modifications.
Secrets prêts et appels réels vérifiés sans afficher/copier leurs valeurs.
Provider Task 03, normalisation étendue, persistance station Point PostGIS, mode
CLI/API `live_meteofrance`, backfill, mise à jour et corrections quotidiennes,
retries, provenance, sources SHA-256, gestion des absences et erreur technique
station faisant échouer le run sans interrompre les autres dates.

Archives et observations récentes séparées, aucune interpolation spatiale ou
substitution par fixture. Aucun contrat partagé, règle, seuil, production,
configuration Vercel, accès de sécurité existant ou écran métier modifié.

## Écritures DEV autorisées et vérifiées

Inspection et proposition : `PLAN.md`, avant toute écriture distante.
Migration additive CLI `20261014133958_meteofrance_station_ingestion.sql`,
testée en PostGIS jetable dans les schémas `public` et `extensions`, puis appliquée
par MCP sur DEV. Historique distant : version `20261014135644`, nom
`meteofrance_station_ingestion`. SQL identique au fichier proposé ; aucun
DROP/TRUNCATE, suppression de donnée ou migration historique modifiée.
Les timestamps de l'historique MCP sont distincts des noms de fichiers locaux,
comme pour les quatre migrations préexistantes ; ne pas rejouer une migration
déjà enregistrée sans vérifier cet inventaire.

| Acquisition réelle | Période | Stations | Lots station/jour | Valeurs disponibles |
|---|---|---:|---:|---:|
| Backfill initial | 1–30 septembre 2026 | 5 | 150 | 900 |
| Commande quotidienne, fenêtre de correction | 7–13 octobre 2026 | 5 | 35 | 210 |
| Dernier échantillon horaire | 14 octobre 2026 | 5 | 5 | 15 |

**Total vérifié : 190 lots, 1 125 valeurs disponibles, 5 stations, 76 reçus DB,
zéro doublon.** Le rejeu exact du backfill n'a modifié aucune des 30 partitions
et n'a créé aucun reçu DB supplémentaire (`replay.log`). Pas de données ajoutées
pour les 1–6 octobre : les fenêtres exécutées sont explicites, pas de remplissage.

La revue finale a remplacé le repère de publication par `published_at=null`
quand la source ne publie pas cette date. Les 38 premiers reçus techniques sont
conservés pour audit ; les 38 acquisitions rejouées avec cette correction de
provenance mettent à jour les mêmes lots, sans dupliquer les observations.
La vérification SQL confirme zéro date de publication de remplacement dans les
lots courants. Le rejeu final reste sans changement de contenu.

Chaque journée du backfill contient TN, TX, TM, UM, RR et ETPMON pour chacune des
cinq stations. Aucun null dans ces acquisitions vérifiées. Les comportements
missing/partial/invalid/station indisponible sont testés avec exemples synthétiques
locaux ; ils ne sont pas présentés comme des cas observés pendant ce backfill.

`supabase-verification.json` confirme les clés d'idempotence, les deux nouvelles
tables RLS forcées, l'absence de droits directs clients, trois RPC INVOKER sans
EXECUTE anon/authenticated, et zéro grid_cell/risk_result/rule_version.
Les sources réelles sont les seules données métier ajoutées ; aucun seed local
n'est passé sur DEV. Aucun calcul de risque avec la règle YAML fictive.

## Parcours jusqu'aux endpoints

Build de production local avec les variables cloud et `NODE_USE_ENV_PROXY=1`,
Supabase DEV réel, sans mock ni écriture via navigateur :

- `/api/weather/stations?mode=live_meteofrance` : HTTP 200, cinq stations ;
- `/api/weather/series` archive Brest, 1–30 septembre : HTTP 200,
  30 jours / 180 observations, valeurs et provenance réellement persistées ;
- `/api/weather/series` observations Brest, 14 octobre : HTTP 200,
  trois valeurs du dernier échantillon, Kelvin normalisé en Celsius.

`live-api.json` conserve URL locale de requête, status, no-store, checksum de
réponse et un lot exemple. Points station, aucune interpolation, aucun risque
calculé ; publication_freshness unknown, archive stale séparée de récupération
récente. Pas de clés dans les réponses. Les trois endpoints risques Task 04
restent vides, vérifiés dans l'E2E d'intégration réelle.

## Vérifications

- `make check` final PASS : 63 tests Python, 127 tests web, lint, typecheck,
  build, contrats gelés, guards qualité/source/automation/migrations et exception ;
- ruff des nouveaux modules/scripts/tests et mypy du domaine ingestion/CLI PASS ;
- SQL jetable public/extensions PASS : migrations, RLS, grants, unités/contrats
  existants, idempotence, correction, refus demo, préservation des valeurs connues,
  rejet d'une récupération plus ancienne, aucune surface ou risque artificiel ;
- E2E `INTEGRATION_LIVE=real` PASS : 30 états aux formats 1440×900,
  1024×768, 390×844, parcours demo et Supabase réel, aucun débordement global,
  aucun problème axe détecté ; résumé `integration-report.json` ;
- audits Python moteur/outillage et navigateur : zéro vulnérabilité connue ;
- audit JS high : seule exception héritée GHSA-vfj7-8cjw-p6xm / braces 3.0.3,
  uniquement dev, zéro chemin production, 14 traces build vérifiées ;
- Gitleaks historique et dossiers source PASS, sorties expurgées ; scan source
  et valeurs configurées dans les 30 fichiers client PASS, aucun secret ;
- budget JS/CSS client : 565 472 octets gzip pour 2 097 152 autorisés ;
- actionlint 1.7.7, YAML automation, migrations immuables et diff whitespace PASS.

Les captures d'intégration sont dans `work/task11-integration/` ; elles portent
sur le build local, pas sur une Preview Vercel. Les schémas et unités réelles
sont corroborés par les réponses Météo-France ; les fixtures ne servent pas à
valider une règle scientifique. Une erreur de typage d'un test détectée au premier
make check a été corrigée avant le contrôle final, sans réduire les assertions.

## Limites et sécurité

ETPMON est conservée sous son identité source ; l'équivalence ET0 n'est pas
automatiquement affirmée en l'absence de méthode/version par valeur. Dates
quotidiennes = labels fournisseur, pas instants de mesure ni journée universelle
UTC. Codes Q conservés sans classification de confiance inventée. Publication
non fournie = unknown explicite. DPObs v1 fonctionne ; v2 retourne 403 avec la
subscription actuelle. Le récent est un dernier échantillon/jour, pas une série
horaire complète ni un bilan quotidien calculé.

Le MVP station ne représente pas une grille France ni toutes les productions.
Le mode live station est accessible par CLI et API météo, pas dans les écrans
carte/diagnostic/veille. Le modèle de risque gouverné reste une étape suivante.
Les pertes techniques station font échouer le run ; une absence fournisseur
légitime reste explicite sans devenir un zéro. Les dernières versions complètes
restent servies avec leur ancienne provenance en cas de tentative partielle.

Advisor DEV avant/après : mêmes constats préexistants, aucun nouveau finding lié
aux tables/RPC Task 11. `spatial_ref_sys` reste sans RLS avec des droits clients
d'écriture confirmés ; PostGIS est dans public. Proposition de traitement séparé
dans PLAN.md, sans remédiation automatique de table d'extension.
[Remédiation RLS](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public).
Les warnings des RPC risques SECURITY DEFINER correspondent au design Task 04
déjà testé (lecteur NOLOGIN/NOBYPASSRLS, accès uniquement aux risques publiés).

Cron live livré à 07:40 UTC, désactivé tant que la branche n'est pas revue/mergée
et que `METEOFRANCE_LIVE_ENABLED` et les quatre secrets GitHub ne sont pas
configurés. Les secrets cloud n'ont pas été copiés sur GitHub. Aucun workflow
live distant, modification de settings, merge ou auto-merge déclenché.
Le suivi PR/checks/Preview est dans `DELIVERY.md`.

## Commandes principales

```sh
git fetch origin
git config user.name "Mehdi-Sine"
git config user.email "mehdi.sine@acta.asso.fr"
git worktree add /workspace/work/agriclimax-task11 -b codex/11-meteofrance-live origin/main
npx --yes supabase@2.120.0 migration new meteofrance_station_ingestion
PATH=/workspace/.agriclimax-setup/tools/node_modules/.bin:$PATH pnpm install --frozen-lockfile --store-dir /workspace/.agriclimax-setup/pnpm-store
PYTHON=/workspace/.agriclimax-setup/venv/bin/python bash supabase/tests/run-local.sh public
PYTHON=/workspace/.agriclimax-setup/venv/bin/python bash supabase/tests/run-local.sh extensions
PYTHONPATH=engine/src python scripts/ingest_weather.py --mode live_meteofrance --from 2026-09-01 --to 2026-09-30 --dry-run
PYTHONPATH=engine/src python scripts/ingest_weather.py --mode live_meteofrance --from 2026-09-01 --to 2026-09-30 --root work/meteofrance
# Même commande rejouée pour idempotence réelle.
PYTHONPATH=engine/src python scripts/ingest_weather.py --mode live_meteofrance --daily --root work/meteofrance
PYTHONPATH=engine/src python scripts/ingest_weather.py --mode live_meteofrance --product observations --daily --root work/meteofrance
PATH=/workspace/.agriclimax-setup/tools/node_modules/.bin:$PATH PYTHONPATH=engine/src make check PYTHON=/workspace/.agriclimax-setup/venv/bin/python
INTEGRATION_BASE=http://127.0.0.1:3100 INTEGRATION_LIVE=real INTEGRATION_ARTIFACTS=work/task11-integration CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/e2e/integration.mjs
pnpm audit --audit-level high
npm audit --prefix tests/e2e --audit-level high
work/audit/bin/pip-audit --strict --disable-pip --no-deps -r engine/requirements-dev.lock --format json
work/audit/bin/pip-audit --strict --disable-pip --no-deps -r scripts/quality/requirements.lock --format json
python scripts/quality/security.py --bundle apps/web/.next/static
python supabase/scripts/check_client_secrets.py
python scripts/quality/budget.py
python scripts/quality/migrations.py --base origin/main
work/actionlint/actionlint -shellcheck= .github/workflows/*.yml
git diff --check
```

Les appels réseau utilisent le proxy/CA hérités avec permission réseau de commande.
Les inspections/applications SQL ont utilisé les outils Supabase du projet DEV,
pas des secrets DB copiés dans des fichiers. Fichiers modifiés : `files.txt`.
