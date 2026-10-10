# Examen préalable des migrations DEV

> État de clôture : révocation PostGIS abandonnée, migration non applicable retirée.
> Tous les contrôles Task 04 relancés passent. Les anciens blocages ci-dessous
> sont historiques. Voir [CLOSURE.md](CLOSURE.md) pour la conclusion actuelle.

> État actuel : **0001, 0002, 0003 et 0004 appliquées sur DEV via le plugin Supabase**
> le 10 octobre 2026, après autorisation du socle. Les anciens blocages de socle/SQL
> ci-dessous sont historiques. Voir [DEV_APPLIED_REPORT.md](DEV_APPLIED_REPORT.md)
> et [les preuves SQL](evidence/dev-plugin-applied.json).
> Onze tables vides, PostGIS et RPC vérifiés. PR toujours draft : alertes PostGIS
> à traiter ; HTTP serveur et scan du build client bloqués par le proxy injoignable.

Actualisation du 10 octobre 2026 : accès SQL établi via le plugin Supabase.
Le projet agriclimax-dev est vide de tables applicatives, sans PostGIS ni historique
migratoire. Le blocage actuel est l'absence du socle 0001/0002, pas l'accès SQL.
Voir [DEV_PLUGIN_DIAGNOSTIC.md](DEV_PLUGIN_DIAGNOSTIC.md). Aucune migration appliquée.
Les mentions d'accès SQL absent dans la procédure ci-dessous décrivent la première passe.

Base : `main` `5c2426f`, Task 01 mergée. Branche : `codex/04-postgis-api`.
Les migrations n'ont été appliquées qu'aux bases locales jetables. Aucun accès SQL
DEV n'est fourni ; aucune migration DEV n'a été exécutée par cette tâche.

| Fichier | Effet / objets | Réversibilité |
|---|---|---|
| `0001_extensions_and_core.sql` (existant inchangé) | PostGIS, pgcrypto ; sources, productions, grid_cells, risk_results ; grid_cells_geom_gix, risk_results_lookup_idx | Suppression physique destructive si données présentes ; aucun retrait prévu |
| `0002_watch_and_ai_provenance.sql` (existant inchangé) | watch_signals et contrainte d'unicité signal_key | Même limite ; aucun retrait prévu |
| `0003_persistence_and_rls.sql` (nouveau) | Extensions si absentes ; schéma agriclimax_private ; indicators, parameter_versions, rule_versions, run_manifests, observations, indicator_results ; risk_results.published/run_id et contrainte de publication ; neuf index ; RLS forcée, politiques et grants sur onze tables ; rôle agriclimax_api_reader ; protection CREATE des schémas public/extensions | Désactivation opérationnelle sans perte de données ; retrait physique des tables/colonnes non livré. Les droits clients antérieurs sont restreints intentionnellement |
| `0004_bounded_read_api.sql` (nouveau) | RPC agriclimax_map_risks, agriclimax_risk_series, agriclimax_territory_risks ; helpers agriclimax_validate_query/agriclimax_risk_payload ; ownership, search_path fixe, grants minimaux et reload PostgREST | Révocation des droits EXECUTE par migration corrective ; données et extensions conservées |

Index ajoutés : `observations_cell_time_idx`, `observations_run_idx`,
`observations_source_time_idx`, `indicator_results_lookup_idx`,
`indicator_results_run_idx`, `run_manifests_started_idx`,
`risk_results_published_map_idx`, `risk_results_published_series_idx`,
`risk_results_run_idx`. Les PK/uniques créent aussi leurs index de contrainte.

Aucun DROP, DELETE, TRUNCATE, renommage, déplacement de table, backfill ou calcul
scientifique. `published=false` masque toutes les lignes historiques jusqu'à une
publication serveur explicite. Les nouveaux index ordinaires peuvent bloquer les
écritures pendant leur création : planifier une fenêtre DEV et mesurer les volumes.
0003/0004 sont transactionnelles ; un échec annule la migration correspondante.
Les migrations historiques ne sont pas réécrites pour en changer la transaction.

## Procédure DEV, bloquée à l'étape 1

1. Configurer un accès SQL **DEV** et le réseau PostgreSQL approprié, sans coller
   de secret dans le chat. La secret key REST n'accorde pas l'exécution SQL/DDL.
   L'environnement actuel autorise le domaine HTTPS ; aucun accès TCP PostgreSQL
   n'est configuré. Le rôle de migration doit pouvoir gérer schémas, extensions,
   rôles et ownership (typiquement postgres Supabase).
2. Exécuter `supabase/scripts/preflight.sql` en lecture seule. Vérifier identité
   du projet, historique `supabase_migrations.schema_migrations`, schémas/extensions,
   colonnes, policies, grants, rôle éventuel existant et volumes. Ne pas conclure
   qu'une table est absente à partir d'un seul PGRST205.
3. Confronter la liste ci-dessus avec cet inventaire. Ne jamais rejouer une version
   appliquée. Si des objets homonymes ou des policies non documentées existent,
   produire une migration d'adaptation revue au lieu de contourner le conflit.
   Le rôle reader déjà présent fait échouer 0003 intentionnellement.
4. Après sauvegarde DEV et examen concret des effets, appliquer uniquement les
   versions pendantes via le mécanisme de migrations Supabase autorisé, avec
   enregistrement d'historique. Ne pas envoyer du DDL via une RPC improvisée.
5. Rejouer le preflight : tables, PostGIS, index, RLS/policies/grants, propriétaires
   des RPC, historique. Vérifier REST avec clés serveur/publique et les endpoints.
   Enregistrer le résultat ici. Ne pas exécuter `bootstrap.sql` ou les seeds sur DEV.
6. Publier uniquement des résultats réels validés en amont ; tester bbox, règle/date,
   série et agrégation sur des données DEV connues, ainsi que l'interdiction d'écriture
   avec les rôles client. Ne pas prendre des erreurs d'intégrité pour une preuve RLS.

## Retour arrière non destructif, forward-only

En cas d'incident : ajouter une **nouvelle** migration versionnée qui révoque
EXECUTE sur les trois RPC pour anon/authenticated/service_role, puis désactiver
l'utilisation des endpoints. Conserver tables, colonnes, index, données et RLS.
Réactiver ultérieurement par une migration corrective revue. Ne pas rétablir les
anciens droits clients non sécurisés. Aucun script DOWN destructif n'est livré.
Un retrait physique ne serait pas totalement réversible sans sauvegarde ; il exige
une justification explicite et une procédure distincte. Ne jamais supprimer PostGIS
partagé pour retirer cette fonctionnalité.
