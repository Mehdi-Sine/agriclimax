# Application et vérification DEV — 10 octobre 2026

> État de clôture : révocation PostGIS abandonnée, migration non applicable retirée.
> Tous les contrôles Task 04 relancés passent. Les anciens blocages ci-dessous
> sont historiques. Voir [CLOSURE.md](CLOSURE.md) pour la conclusion actuelle.

> Validation finale : HTTP map/series/territory 200, RPC réelles 200, build et
> 25 tests réussis, scan des dix artefacts client réussi. Le blocage réseau est
> résolu. Voir [FINAL_VALIDATION.md](FINAL_VALIDATION.md). La PR reste draft :
> risque de permissions PostGIS identifié, correction ciblée proposée, non appliquée.

Projet : **agriclimax-dev**, `yyfbpecxvxglzxopsmel`, eu-west-1, PostgreSQL 17.11.
Branche : `codex/04-postgis-api`. Plugin Supabase SQL accessible ; toutes les écritures
DB ont utilisé apply_migration. Autorisation explicite du socle 0001/0002 obtenue
après diagnostic de son absence. Aucun merge ni seed.

## Inspection avant écriture

0001/0002 sont identiques sur main et sur la branche Task 04 (blobs dans les preuves).
0001 active PostGIS et pgcrypto si absentes ; crée sources, productions, grid_cells,
risk_results ; géométries Polygon/Point EPSG:4326 ; PK ; CHECK catégorie crop/livestock ;
FK cellule/production ; UNIQUE cellule/date/production/indicateur/règle/version ;
index GiST grid_cells_geom_gix et B-tree risk_results_lookup_idx.
0002 crée watch_signals avec PK UUID, FK production et UNIQUE signal_key.
Ces deux fichiers ne créent aucune politique RLS et n'insèrent aucune donnée métier.
Aucun DROP, TRUNCATE, DELETE, UPDATE métier, seed ou purge. Résumé présenté avant écriture.
Les REVOKE et modifications de visibilité de 0003 sont détaillés dans MIGRATION_REVIEW.md.

## Application dans l'ordre, historique Supabase réel

| Migration locale | Version enregistrée | Résultat |
|---|---|---|
| 0001_extensions_and_core | 20261010173457 | success=true |
| 0002_watch_and_ai_provenance | 20261010173509 | success=true |
| 0003_persistence_and_rls | 20261010173523 | success=true |
| 0004_bounded_read_api | 20261010173532 | success=true |

Les cinq tables du socle ont été vérifiées avant application de 0003.
Le plugin attribue les versions horodatées ; les SQL locaux restent inchangés.
Ne pas rejouer 0001–0004 sur ce projet ; réconcilier les noms/versions lors d'un futur usage CLI.

## Schéma réellement vérifié

- PostGIS **3.3.7**, actif dans public ; calcul de centroid : POINT(0.5 0.5).
  pgcrypto préexistant dans extensions.
- Socle : sources, productions, grid_cells, risk_results, watch_signals.
- Persistance privée : indicators, parameter_versions, rule_versions, run_manifests,
  observations, indicator_results.
- Toutes les onze tables applicatives ont ENABLE et FORCE RLS.
- Neuf index Task 04 et deux index explicites du socle présents ; PK/uniques également.
  Aucun index invalide ou non prêt dans les deux schémas.
- Contraintes cataloguées ; risk_results.published NOT NULL DEFAULT false et FK run_id
  présents via migrations appliquées et inventaire.
- Onze policies agriclimax_server service_role ; policies reader sur grid_cells
  (true) et risk_results (published). Aucun grant table PUBLIC/anon/authenticated.
- service_role dispose des accès serveur ; paramètres et règles sont append-only :
  UPDATE/DELETE effectivement interdits. Les tables du socle conservent aussi des
  grants service_role hérités de Supabase (dont TRUNCATE), au-delà du CRUD explicite.
  Aucun de ces droits n'a été utilisé pour détruire des données.
- Reader NOLOGIN, NOINHERIT, NOBYPASSRLS, pas de CREATE public/extensions,
  SELECT seulement sur grid_cells et risk_results, aucun droit sur les tables privées.
- anon/authenticated : pas de CREATE public/extensions, pas d'USAGE privé,
  pas d'appartenance reader.
- Trois RPC SECURITY DEFINER possédées par le reader ; search_path fixé,
  statement_timeout 5s ; EXECUTE anon/authenticated/service_role, sans PUBLIC.
  Deux helpers SECURITY INVOKER non exécutables par les clients.
- Refus réel SELECT risk_results sous anon : SQLSTATE 42501.
  Refus helper sous authenticated : SQLSTATE 42501.
  Bbox inversée : SQLSTATE 22023.

## Tests RPC et données

Les trois RPC ont été appelées sous chacun des rôles anon, authenticated et service_role
dans des transactions read only terminées par rollback : toutes réussissent.
Carte : FeatureCollection vide, limit 1000, truncated false ; série : [] ;
territoire : groups [], aggregation intersecting_cell_counts.
Les identifiants de test sont de simples paramètres de lecture ; aucune insertion.
Les onze tables applicatives ont **exactement zéro ligne** après application.
PostGIS installe ses propres références spatiales : ce sont des données techniques
d'extension, pas des données métier AgriclimaX.

## Alertes de sécurité réelles : certification complète en attente

L'audit Supabase n'est **pas vierge** :

- [RLS disabled in public](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public) :
  public.spatial_ref_sys, table technique PostGIS appartenant à supabase_admin.
  RLS absente ; droits UPDATE effectifs anon/authenticated constatés.
- [Extension in public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public) :
  PostGIS installé conformément à 0001 dans public.
- [SECURITY DEFINER anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
  et [authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) :
  les trois RPC publiques AgriclimaX (intentionnelles, reader soumis à RLS) et
  trois surcharges PostGIS st_estimatedextent (exposition à revoir).

Aucun déplacement d'extension, changement de propriétaire ni migration supplémentaire
appliqué au-delà de 0001–0004. Préparer une correction forward-only distincte pour
fermer les accès techniques PostGIS non nécessaires ; ne pas réécrire les migrations
appliquées. La PR demeure draft avec ces alertes explicites.

## Connexion serveur, HTTP et secrets

Connexion SQL via plugin confirmée ; succès RPC sous service_role confirmé.
Le proxy shell proxy:8080 est injoignable : git fetch et l'inspection REST
(inspect_dev.py) échouent avant réponse HTTP, avec les deux clés.
Une copie de sources Task 04 a été reconstruite via le patch GitHub dans work/ ;
pnpm install --offline --frozen-lockfile échoue sur ajv 8.17.1 absent du cache.
Aucune modification du lockfile ou contournement des versions pour produire un faux build.

En conséquence, les endpoints Next.js carte/série/territoire, la connexion REST
avec SUPABASE_SECRET_KEY et le scan des artefacts navigateur **ne sont pas certifiés
après application**. check_client_secrets.py refuse correctement l'absence de build.
Les tests locaux antérieurs restent historiques, ils n'ont pas été relancés ici.

Revue statique des sources : le nom SUPABASE_SECRET_KEY figure seulement dans
le repository server-only et ses tests, aucune référence dans les modules clients.
La clé est envoyée dans apikey côté serveur ; erreurs sanitifiées, no-store,
redirect:error. Aucune valeur de clé n'est imprimée ou enregistrée dans les preuves.
Cette revue ne remplace pas le scan du build avec la clé courante.

## Preuves et suite

Inventaires SQL, ACL, index, contraintes, zéro ligne, RPC sous trois rôles et historique :
[evidence/dev-plugin-applied.json](evidence/dev-plugin-applied.json).
Le diagnostic initial reste historique : son blocage de socle est désormais résolu.
Seuls les documents de vérification et la description PR sont modifiés.
À reprendre dès que le proxy fonctionne : installation du lockfile, build, scan
client-secret, lecture REST serveur et tests HTTP des trois endpoints ; traiter
séparément le durcissement PostGIS. Aucune lecture de résultats métier non vides
n'est revendiquée et aucun seed n'est nécessaire à ces contrôles.
