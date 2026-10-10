# Diagnostic DEV via plugins — 10 octobre 2026

> État actuel : **0001, 0002, 0003 et 0004 appliquées sur DEV via le plugin Supabase**
> le 10 octobre 2026, après autorisation du socle. Les anciens blocages de socle/SQL
> ci-dessous sont historiques. Voir [DEV_APPLIED_REPORT.md](DEV_APPLIED_REPORT.md)
> et [les preuves SQL](evidence/dev-plugin-applied.json).
> Onze tables vides, PostGIS et RPC vérifiés. PR toujours draft : alertes PostGIS
> à traiter ; HTTP serveur et scan du build client bloqués par le proxy injoignable.

Branche inspectée : `codex/04-postgis-api`, tête initiale `3826556f5c5d796514a4eda3dfe6bc1c3c91d1ef`.
Frontières affectées : documentation de vérification et description de la PR uniquement.
Aucune modification du code, des migrations, des contrats, de la science ou de l'UI.

## Contrôle préalable et identité

Le plugin Supabase a répondu avec succès à list_projects puis execute_sql avant toute écriture.
Projet ciblé : `agriclimax-dev`, ref `yyfbpecxvxglzxopsmel`, région eu-west-1,
ACTIVE_HEALTHY, PostgreSQL 17.11. Le catalogue SQL est accessible comme postgres.
Le domaine DEV correspond au domaine Supabase autorisé dans l'environnement.
Aucun autre projet n'a été interrogé en SQL.

## Inventaire distant en lecture seule

- list_tables(public, verbose=true) : aucune table.
- Catalogue pg_class(public/agriclimax_private, tables et vues) : aucune relation applicative.
- list_migrations : historique vide.
- Extensions installées : plpgsql 1.0, pg_stat_statements 1.11, uuid-ossp 1.1,
  pgcrypto 1.3 (extensions), supabase_vault 0.3.1. **PostGIS absent**.
- Schéma agriclimax_private absent ; rôle agriclimax_api_reader absent.
- Fonctions public.agriclimax_% : aucune.
- Index et politiques public/agriclimax_private : aucun.
- RLS et grants sur les onze tables attendues : sans objet, tables absentes.

Requêtes utilisées : pg_class JOIN pg_namespace ; pg_extension JOIN pg_namespace ;
inventaire jsonb_build_object avec pg_roles, pg_proc, pg_indexes et pg_policies.
Les résultats SQL ne sont pas déduits des erreurs REST.

## Comparaison précise des migrations Task 04

`0003_persistence_and_rls.sql` (blob `90b85eabcd920776a59a8e40b25ca7d62b603348`) :

- Installation PostGIS si absent ; pgcrypto déjà présent, conservé.
- Création du schéma agriclimax_private et de six tables : indicators, parameter_versions,
  rule_versions, run_manifests, observations, indicator_results ; PK, uniques, FK et CHECK.
- Modification de public.risk_results : published boolean NOT NULL DEFAULT false ;
  run_id uuid nullable avec FK ; CHECK risk_results_publication_shape.
- Neuf index : observations_cell_time_idx, observations_run_idx,
  observations_source_time_idx, indicator_results_lookup_idx, indicator_results_run_idx,
  run_manifests_started_idx, risk_results_published_map_idx,
  risk_results_published_series_idx, risk_results_run_idx ; index PK/unique en supplément.
- Création du rôle agriclimax_api_reader NOLOGIN NOINHERIT NOBYPASSRLS ; appartenance
  accordée à l'exécuteur, USAGE public/extensions, SELECT grid_cells/risk_results.
- ENABLE et FORCE RLS sur sources, productions, grid_cells, risk_results, watch_signals
  et les six tables privées ; onze policies agriclimax_server service_role (ALL).
- Deux policies SELECT reader : agriclimax_map_geometry et agriclimax_published_results.
- Révocation de tous les droits table PUBLIC/anon/authenticated ; CRUD service_role,
  puis retrait UPDATE/DELETE sur parameter_versions/rule_versions.
- Retrait CREATE public/extensions pour les clients ; fermeture du schéma privé,
  USAGE service_role et default privileges privés fermés.

`0004_bounded_read_api.sql` (blob `9650e24696063b91ebf9b8b6c0a8ce914b5f83e6`) :

- Deux helpers : agriclimax_validate_query et agriclimax_risk_payload.
- Trois RPC : agriclimax_map_risks, agriclimax_risk_series, agriclimax_territory_risks.
- RPC SECURITY DEFINER appartenant au reader soumis à RLS, search_path fixé,
  statement_timeout 5s, validations des identifiants/dates/bbox/zoom/limite.
- Helpers non exécutables par les clients ; EXECUTE reader.
- RPC : retrait EXECUTE PUBLIC puis grants anon/authenticated/service_role.
- CREATE public accordé temporairement au reader pour transfert ownership puis révoqué.
- Notification de rechargement du schéma PostgREST.

**Diagnostic non conforme pour application :** 0003 référence les cinq tables
historiques de 0001/0002 qui sont physiquement absentes. Elle échouerait dès la FK
observations -> public.grid_cells. 0004 dépend ensuite de risk_results et du reader.
Aucun apply_migration appelé, ni même tentative partielle. 0001/0002 ne sont pas
appliquées car l'autorisation porte uniquement sur Task 04.

## Destruction et données

Aucun DROP, TRUNCATE, DELETE de données, seed, backfill, purge ou insertion métier
dans 0003/0004. Les REVOKE retirent des permissions, pas des données. La RLS et
published=false changeraient volontairement la visibilité des lignes historiques.
Les index ordinaires peuvent bloquer temporairement les écritures.
Aucune donnée réelle ou synthétique n'a été insérée dans DEV pendant cette reprise.

## API et secrets : limites de vérification

Revue du repository serveur : import server-only, lecture SUPABASE_SECRET_KEY
uniquement côté serveur, clé envoyée comme apikey, no-store, redirect:error,
erreurs upstream sanitifiées par api-handler. Aucun changement de code.
Les preuves antérieures de build/scan navigateur et HTTP restent historiques ;
elles ne sont pas présentées comme des tests relancés pendant cette reprise.

Le git fetch de la branche échoue : proxy:8080 injoignable. Le checkout local ne
contient que la base ; aucun build de cette base n'est utilisé pour certifier Task 04.
Lecture et écritures documentaires réalisées via GitHub sur la branche existante.
La connexion SQL plugin est vérifiée ; la connexion REST serveur et les endpoints
Next.js n'ont pas été retestés dans cette reprise. Aucune lecture DEV réussie ne
peut être certifiée tant que les RPC sont absentes. Le scan des artefacts client
avec la clé courante reste à relancer après récupération/build de la branche.

## Suite requise

Faire autoriser et préparer séparément le socle vide 0001/0002, sans seed.
Relancer l'inventaire, puis appliquer uniquement les migrations pendantes autorisées
par apply_migration et vérifier PostGIS/tables/index/RLS/RPC/grants, REST serveur,
endpoints carte/série/territoire et artefacts client.
La PR reste draft ; aucun merge dans main.
