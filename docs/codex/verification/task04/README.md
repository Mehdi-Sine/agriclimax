# Vérification Task 04 — Supabase / PostGIS / API

> État de clôture : révocation PostGIS abandonnée, migration non applicable retirée.
> Tous les contrôles Task 04 relancés passent. Les anciens blocages ci-dessous
> sont historiques. Voir [CLOSURE.md](CLOSURE.md) pour la conclusion actuelle.

> Correctif désormais autorisé et migration versionnée créée. Tentative plugin
> rollbackée faute de droits supabase_admin ; permissions inchangées, PR toujours
> draft. Voir [PERMISSION_MIGRATION_STATUS.md](PERMISSION_MIGRATION_STATUS.md).

> Validation finale : HTTP map/series/territory 200, RPC réelles 200, build et
> 25 tests réussis, scan des dix artefacts client réussi. Le blocage réseau est
> résolu. Voir [FINAL_VALIDATION.md](FINAL_VALIDATION.md). La PR reste draft :
> risque de permissions PostGIS identifié, correction ciblée proposée, non appliquée.

> État actuel : **0001, 0002, 0003 et 0004 appliquées sur DEV via le plugin Supabase**
> le 10 octobre 2026, après autorisation du socle. Les anciens blocages de socle/SQL
> ci-dessous sont historiques. Voir [DEV_APPLIED_REPORT.md](DEV_APPLIED_REPORT.md)
> et [les preuves SQL](evidence/dev-plugin-applied.json).
> Onze tables vides, PostGIS et RPC vérifiés. PR toujours draft : alertes PostGIS
> à traiter ; HTTP serveur et scan du build client bloqués par le proxy injoignable.

État actualisé le 10 octobre 2026 : plugin Supabase disponible, accès SQL DEV vérifié.
Application **bloquée par l'absence physique du socle 0001/0002**. Voir
[DEV_PLUGIN_DIAGNOSTIC.md](DEV_PLUGIN_DIAGNOSTIC.md) pour l'inventaire SQL et la
comparaison de 0003/0004. Les résultats ci-dessous sont les preuves historiques de
la première passe ; les mentions d'accès SQL absent sont désormais dépassées.

État historique : implémentation et validation locale réalisées ; application/certification
du schéma DEV bloquées faute d'accès SQL. Aucune migration distante, aucun merge,
aucune autre Task. Base `main` `5c2426f`, branche `codex/04-postgis-api`.
Les captures d'état utilisent des timestamps UTC explicites.

## Résultats et commandes

Node 24.19.0, pnpm 10.0.0 via Corepack, Python 3.12.14. Le pnpm global de cet
environnement est 11 : un shim Corepack local sous `work/bin` a permis d'exécuter
les scripts du dépôt avec la version demandée. Aucun outil de build n'a été contourné.

| Commande | Résultat |
|---|---|
| `pnpm install --frozen-lockfile` (pnpm 10) | Réussi, y compris après ajout d'ajv 8.17.1, ajv-formats 3.0.1 et server-only 0.0.1 ; lock mis à jour |
| `pnpm lint` | Réussi, zéro warning |
| `pnpm typecheck` | Réussi, Next typegen et TS strict |
| `pnpm test` | 25 tests, dont 22 DB/API et 3 foundation |
| `pnpm build` | Réussi ; trois routes API dynamiques Node.js |
| `.venv/bin/python scripts/check_contracts.py` | 3 schémas/exemples, GeoJSON démo et 4 YAML validés offline |
| `.venv/bin/python -m pytest engine/tests` | 10 tests réussis |
| `PYTHON=.venv/bin/python bash supabase/tests/run-local.sh public` | Réussi : migrations 0001–0004, stockage, RLS/grants, RPC, contrats, EXPLAIN, inventaire |
| même commande avec `extensions` | Réussi avec PostGIS et pgcrypto dans extensions |
| `python supabase/scripts/check_client_secrets.py` | 10 artefacts navigateur : ni secret, ni nom de variable interdit |
| `ruff check` sur nouveaux scripts Python et `mypy --strict` sur inspect_dev.py | Réussis |
| `bash -n supabase/tests/run-local.sh`, `git diff --check` | Réussis |
| `python supabase/scripts/inspect_dev.py` | Lecture seule réellement effectuée sur DEV ; résultats ci-dessous |

Le premier build en sandbox a échoué sur la capture stdout du sous-processus
TypeScript (`--showConfig`). Le même build avec accès d'exécution autorisé passe,
sans modification de Next.js, tsconfig ni désactivation de vérification. Le premier
runner Docker pouvait joindre le serveur temporaire d'initialisation ; il attend
désormais le processus PostgreSQL définitif. Les deux modes passent avec ce correctif.

Les tests SQL vérifient : onze tables RLS forcées, absence de grants client,
schéma privé inaccessible, rôle reader sans BYPASSRLS/écriture/CREATE, auxiliaires
protégés, publication filtrée, séparation des versions de règles, plafonds et bbox
invalides/NaN, JSON publié invalide rejeté, zoom/validité d'un polygone complexe,
stockage serveur des six tables privées, paramètres append-only et manifest unique.
Les seeds sont rollbackés et les conteneurs du runner supprimés. Les sorties SQL
réelles sont validées contre les contrats V1 : 2 features, 10 risques et 250
cellules-dates agrégées. Les tests web couvrent filtrage, bornes, erreurs, validation
JSON Schema, absence de fallback et non-réflexion des secrets/erreurs upstream.

## Schéma DEV : état exact connu, limites explicites

`evidence/dev-rest-inspection.json` contient les observations réelles en lecture
seule du 10 octobre 2026. Avec la secret key serveur, OpenAPI répond HTTP 200 : la
connexion REST côté serveur fonctionne. Il ne liste aucune table/RPC Task 04.
Les cinq tables historiques répondent HTTP 404 / `PGRST205` avec les deux clés.
OpenAPI avec la clé publique répond HTTP 401. Ces réponses ne permettent pas de
certifier les droits client ni l'état SQL ; un cache PostgREST absent/incomplet ou
un schéma non exposé ne signifie pas nécessairement absence physique de table.

| Élément DEV | État vérifié |
|---|---|
| Connexion REST serveur | HTTP 200 sur OpenAPI |
| Tables historiques visibles via REST | Non trouvées dans le cache : 404/PGRST205 |
| RPC Task 04 visibles dans OpenAPI serveur | Aucune |
| Tables SQL réellement présentes | Non vérifiées |
| Extension PostGIS, schéma/version | Non vérifiés |
| Index, RLS, policies, grants | Non vérifiés |
| Historique/version des migrations | Non vérifié |
| Migrations appliquées par cette tâche sur DEV | **Aucune** |
| 0003 et 0004 sur DEV | **Non appliquées par cette tâche** |
| 0001 et 0002 sur DEV | Historique inconnu ; aucun rejeu |

`DATABASE_URL`, `SUPABASE_DB_URL` et `SUPABASE_ACCESS_TOKEN` sont absents.
Le réseau TCP PostgreSQL n'est pas configuré. Les seules clés REST ne permettent
pas le DDL ; une demande de configuration d'accès SQL DEV a été présentée à l'utilisateur.
Le plan d'application et l'examen des quatre migrations sont dans `MIGRATION_REVIEW.md`.
On ne certifie pas des migrations appliquées ou une sécurité DEV qui n'ont pas pu
être inspectées. Le workstream doit rester en draft tant que ce blocage subsiste.

Le serveur Next.js de production a été lancé sur loopback puis testé réellement :
400/INVALID_QUERY pour une bbox invalide ; 502/UPSTREAM_UNAVAILABLE pour les trois
requêtes DEV, attendu en l'absence de RPC accessible. Toutes les réponses ont
`Cache-Control: no-store` et aucune valeur de secret. Voir `evidence/live-api.json`.
Ce test ne démontre pas une lecture réussie de données scientifiques DEV.

## Inventaire local vérifié

Deux bases éphémères reproduisent les migrations finales avec PostGIS 3.5 et
PostgreSQL 17 (versions exactes dans les inventaires). Onze tables applicatives :
sources, productions, grid_cells, risk_results, watch_signals ; private.indicators,
parameter_versions, rule_versions, run_manifests, observations, indicator_results.
Toutes ont RLS activée et forcée. Les neuf index additionnels, contraintes, policies,
grants, propriétaires/configurations des cinq fonctions sont enregistrés dans
`evidence/local-schema-{public,extensions}.log`. Ce sont des preuves **locales**,
distinctes de l'état DEV. Les tables sont vides après rollback des seeds.

## Performance synthétique

Image épinglée par digest : voir runner. 10 000 rectangles EPSG:4326 et
100 000 risques fictifs (10 dates, une production/indicateur/règle/version).
Bbox `[-5,43,-4.8,43.2]` : 25 cellules intersectées ; agrégation sur 10 dates.
Analyse statistique explicite, planner par défaut, aucune désactivation des scans
séquentiels. Mesures uniques, environnement local chaud ; pas un SLO DEV/production.

| Requête | PostGIS dans public | PostGIS dans extensions |
|---|---:|---:|
| Sélection carte + géométrie | 0,873 ms | 1,250 ms |
| Sélection temporelle d'une cellule | 0,068 ms | 0,070 ms |
| RPC carte complète, sous rôle anon | 4,351 ms | 5,864 ms |
| RPC agrégation, sous rôle anon | 1,739 ms | 2,399 ms |

Les sélections utilisent `grid_cells_geom_gix` et
`risk_results_published_series_idx` (index only/bitmap). Les EXPLAIN complets avec
buffers sont conservés. Les tests antérieurs rollbackés peuvent laisser des tuples
morts ; les mesures ne prétendent pas modéliser une base production compactée.
Le dataset rectangulaire n'évalue pas le coût de millions de géométries complexes,
des réponses réseau ou des bbox mondiales. Le test de zoom utilise séparément un
polygone de 257 sommets. Il faudra mesurer DEV avant partitionnement, géométries
pré-simplifiées ou tuiles. Aucune purge automatique n'est mise en place.

## Fichiers et frontières

Migrations/tests/scripts/README sous `supabase/` ; repository, validation et
gestionnaire HTTP sous `apps/web/lib/server/` ; routes sous `apps/web/app/api/risks/` ;
trois dépendances web et lock ; ce dossier de preuves et une note cross-workstream.
Les contrats JSON, moteur/config scientifique, ingestion, composants UI, interface
démo et autres workstreams restent inchangés. L'intégration future de l'interface
demo/live est signalée dans `docs/codex/cross-workstream/04-live-repository-request.md`.
Le résumé PR est dans `PR_SUMMARY.md`.

## Contrôles distants de la PR

PR draft : https://github.com/Mehdi-Sine/agriclimax/pull/2. Le commit de code
`3877745a8ab60993522225925b3d2b22aa29483f` a un check Vercel en état `failure` ;
son URL cible renvoie à une invitation d'équipe Vercel. Le connecteur GitHub
ne fournit pas sa description détaillée ; l'API GitHub interrogée par CLI répond
Forbidden. Le motif exact n'est donc pas confirmé et aucun build Vercel réussi
n'est revendiqué. Aucune modification d'équipe/déploiement ou d'identité de commit
n'est effectuée. Aucun workflow GitHub Actions n'est associé au commit ; le dépôt
ne contient pas de `.github/workflows/`. Les résultats de tests/build ci-dessus
sont locaux. L'ajout d'outillage CI reste hors périmètre Task 04.
