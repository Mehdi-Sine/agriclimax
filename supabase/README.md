# Supabase / PostGIS — Task 04

## Extension Task 11 — observations station

La migration additive `20261014133958_meteofrance_station_ingestion.sql` ajoute
deux tables privées RLS pour stations Point EPSG:4326 et lots station/source/date,
avec trois RPC SECURITY INVOKER réservées au serveur. Elle est appliquée à DEV
pour le backfill réel autorisé. Les treize tables métier sont désormais couvertes
par les tests RLS ; les onze tables Task 04 et les RPC risques restent conservées.
Aucun polygone, interpolation, production, règle, résultat de risque ou publication
n'est créé par cette ingestion. [Mode live et API station](../engine/src/agriclimax/ingestion/METEOFRANCE.md)
et [inspection / proposition avant application](../docs/codex/verification/task11/PLAN.md).

Le test `station_weather.sql` est exclusivement local/transactionnel ; il est
rollbacké avant les tests Task 04. Ne jamais exécuter ce seed synthétique sur DEV.

## Architecture Task 04

Les fichiers `migrations/0001*` et `0002*` restent inchangés. Ajouter les migrations
dans l'ordre ; ne jamais rejouer une migration déjà enregistrée ni modifier son SQL.
Le bilan DEV, les effets/reversibilité et les résultats se trouvent dans
`../docs/codex/verification/task04/`. Aucun schéma distant n'a été modifié par Task 04.

## Séparation et publication

`public` conserve les cinq tables historiques. `agriclimax_private` contient
observations, définitions/résultats d'indicateurs, manifests d'exécution et versions
de paramètres/règles. Les observations gardent unités, dates UTC, source, qualité
et run ; les résultats d'indicateurs gardent règle/version et provenance.
Les contraintes uniques assurent l'idempotence au sein d'un run ; une nouvelle
exécution peut conserver une nouvelle révision. `idempotency_key` identifie le run.
Les versions de règles/paramètres sont append-only pour `service_role`.

RLS est activée et forcée sur les onze tables applicatives. Aucun droit de lecture
directe ou d'écriture n'est accordé à `anon`/`authenticated`. Les droits CREATE des
clients sont révoqués sur `public` et, s'il existe, `extensions`, pour protéger le
search path. Cela peut affecter des applications préexistantes qui créent du SQL
depuis un client : vérifier l'inventaire avant application.

La publication d'un résultat est explicite (`published = false` par défaut).
Les lignes historiques restent privées. Le pipeline doit valider le JSON Schema V1
et la gouvernance scientifique avant de publier ; SQL vérifie les formes de
publication, pas la validité scientifique. L'API valide à nouveau les contrats.
`run_id` est nullable pour préserver la compatibilité historique ; les nouvelles
ingestions devraient le renseigner. Aucun backfill automatique n'est effectué.

Seules trois RPC de lecture sont exposées. Leur propriétaire
`agriclimax_api_reader` est NOLOGIN, NOINHERIT, NOBYPASSRLS, distinct du propriétaire
des tables. Il peut lire géométries et risques publiés, sans droit d'écriture ou de
lecture du schéma privé. Les fonctions auxiliaires ne sont pas publiques.
Le moteur reste responsable du hazard/risk/confidence, des unités et de la fraîcheur.
Les RPC conservent les valeurs, versions, provenance et quality_flags fournies.

## API de lecture

Les trois routes Next.js GET utilisent `SupabaseRiskRepository` côté serveur.
Pas de CORS ajouté ni de fallback silencieux vers une fixture. `Cache-Control:
no-store` sur toutes les réponses, upstream sans cache et sans redirection,
expiration HTTP à 8 secondes. La secret key est lue à la requête et envoyée
uniquement dans l'en-tête upstream `apikey` ; une nouvelle secret key Supabase
n'est pas un JWT à placer dans `Authorization`. `server-only` interdit son import
depuis un Client Component. La clé publique n'est pas nécessaire au repository.

Paramètres communs obligatoires : `production`, `indicator`, `rule`, `version`.
Identifiants : 1–100 caractères alphanumériques/`_`/`.`/`-`.
Paramètres dupliqués, inconnus et dates impossibles sont rejetés.

| Route | Autres paramètres | Réponse |
|---|---|---|
| `/api/risks/map` | `date`, `bbox=west,south,east,north`, `zoom` (0–22, défaut 6), `limit` (1–2000, défaut 1000) | GeoJSON FeatureCollection, `truncated`, `limit` |
| `/api/risks/series` | `cell`, `start`, `end` | Tableau de `RiskResultV1`, ordonné par date |
| `/api/risks/territory` | `start`, `end`, `bbox` | Comptages par date/classe/confiance/fraîcheur, règle/version et date du calcul le plus récent |

Les plages contiennent au maximum 366 dates inclusives. Les bbox sont EPSG:4326,
strictement ordonnées et limitées au monde ; une bbox traversant l'antiméridien
doit être scindée par le consommateur. Une absence de données renvoie une collection
ou un tableau vide, sans être interprétée comme absence de risque. Aucun mélange
de versions de règles ni sélection implicite de « dernière version ».

La carte transporte les propriétés du contrat `map-feature` et le `RiskResultV1`
complet dans `properties.result`. `truncated=true` exige de resserrer la bbox ou
d'augmenter le zoom ; aucune pagination complète n'est prétendue. L'agrégation
territoriale représente une bbox sur la grille existante : toutes les cellules
intersectées, y compris celles touchant la bordure, comptent une fois par date.
Ce n'est ni un risque territorial calculé, ni une moyenne/pondération surfacique.
Les provenance détaillées restent accessibles par la série de chaque cellule.

La géométrie de restitution utilise `ST_SimplifyPreserveTopology`, tolérance
`360 / (256 * 2^zoom)` degrés. Cette approximation visuelle varie en distance avec
la latitude ; elle n'est jamais utilisée pour l'intersection ou un calcul scientifique.
La géométrie source reste intacte. Benchmark avant une future pré-simplification
ou des tuiles ; aucune infrastructure supplémentaire n'est introduite.

Erreurs stables : `{ "error": { "code": "...", "message": "..." } }`.
`INVALID_QUERY` → 400 ; `NOT_CONFIGURED` → 503 ; `UPSTREAM_UNAVAILABLE` et
`INVALID_RESPONSE` → 502. Aucun SQL, détail d'exception ou corps upstream n'est
renvoyé. Les méthodes non prises en charge utilisent le 405 de Next.js.
Le schéma d'erreur est local à ce transport ; aucun contrat partagé n'est modifié.

## Index et rétention

GiST `grid_cells_geom_gix` pour `&&`/`ST_Intersects` ; index partiels map/series sur
les risques publiés ; index observations cellule/source/variable/date ; index de
lookup des indicateurs et des manifests par date ; index run_id pour les relations.
Les contraintes uniques ajoutent les index d'idempotence. Pas de BRIN/partitionnement
sans mesures montrant un besoin. Les neuf index ajoutés sont listés dans le bilan.

Aucune purge automatique. Pour le pilote : conserver résultats, manifests, règles,
paramètres et provenance ; envisager 90 jours d'observations en stockage chaud puis
archive vérifiée. Cette durée est une proposition opérationnelle à valider, pas une
règle scientifique. Avant toute suppression future : archive, intégrité, liens de
provenance, sauvegarde/restauration testée et justification explicite. L'action doit
être reproductible et auditée ; aucune politique destructive n'est livrée ici.

## Vérifications locales reproductibles

Après installation des dépendances verrouillées, avec Docker local disponible :

```sh
PYTHON=.venv/bin/python bash supabase/tests/run-local.sh public
PYTHON=.venv/bin/python bash supabase/tests/run-local.sh extensions
pnpm lint
pnpm typecheck
pnpm test
pnpm build
.venv/bin/python scripts/check_contracts.py
.venv/bin/python -m pytest engine/tests
python supabase/scripts/check_client_secrets.py
```

Le runner épingle l'image PostgreSQL/PostGIS par digest, crée ses propres conteneurs,
les supprime en sortie, et stocke les logs sous `work/task04-*`. Il ne consomme aucune
clé cloud. Les seeds sont fictifs, locaux, rollbackés. Les rôles bootstrap sont une
simulation minimale de Supabase ; Auth, gateway et politiques globales ne sont pas
reproduits. `SET statement_timeout='5s'` est configuré sur les RPC ; vérifier le
hoisting PostgREST/la limite transactionnelle sur DEV. Ce réglage interne n'est pas
une garantie de timeout pour un appel SQL direct déjà démarré.

## Extension Task 12 — références climatologiques

Migration additive `20261015073507_climatology_reference.sql` : deux tables privées
append-only `climate_references` et `climate_indicators`, deux index de lecture,
RPC INVOKER serveur `agriclimax_persist_climate`. RLS forcée, aucun droit client,
aucune mutation des observations Task 11 ni des résultats de risque.
Tests synthétiques locaux transactionnels : `tests/climate.sql` ; ne pas les
exécuter sur DEV. La migration est testée localement, **non appliquée à DEV**.
[Inspection préalable](../docs/codex/verification/task12/README.md) et
[méthodes/provenance](../engine/src/agriclimax/climate/README.md).
