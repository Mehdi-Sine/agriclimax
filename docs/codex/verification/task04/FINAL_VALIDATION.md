# Validation finale Task 04 — 10 octobre 2026

> État de clôture : révocation PostGIS abandonnée, migration non applicable retirée.
> Tous les contrôles Task 04 relancés passent. Les anciens blocages ci-dessous
> sont historiques. Voir [CLOSURE.md](CLOSURE.md) pour la conclusion actuelle.

> Correctif désormais autorisé et migration versionnée créée. Tentative plugin
> rollbackée faute de droits supabase_admin ; permissions inchangées, PR toujours
> draft. Voir [PERMISSION_MIGRATION_STATUS.md](PERMISSION_MIGRATION_STATUS.md).

Branche `codex/04-postgis-api`, code inchangé ; projet DEV `yyfbpecxvxglzxopsmel`.
Les migrations 0001–0004 appliquées précédemment ne sont ni modifiées ni rejouées.
Aucun seed ni insertion métier ; validation exclusivement en lecture.

## HTTP réel et secret client : conformes

Installation pnpm 10 avec lockfile gelé ; build Next.js de production réussi ;
25 tests web réussis. Le serveur local de production utilise le projet DEV réel.
Le réseau fonctionne avec les permissions réseau de l'exécuteur et
`NODE_USE_ENV_PROXY=1` pour respecter le proxy de session. Pas de mock Supabase.

| Endpoint | Statut HTTP | Réponse sur base vide | RPC réellement appelée |
|---|---|---|---|
| `/api/risks/map` | 200 | FeatureCollection vide, limit 1000, truncated false | agriclimax_map_risks |
| `/api/risks/series` | 200 | [] | agriclimax_risk_series |
| `/api/risks/territory` | 200 | groups [], intersecting_cell_counts | agriclimax_territory_risks |

Chaque RPC répond 200, appelée par POST avec apikey serveur ; pas de redirection,
cache no-store. La trace instrumente fetch sans modifier le repository et
n'enregistre ni valeur de clé ni headers. Aucun 5xx sur ces requêtes valides.
Une requête invalide renvoie 400/INVALID_QUERY avant appel RPC.
Les réponses HTTP ne contiennent ni la clé serveur courante, ni sb_secret_,
ni le nom SUPABASE_SECRET_KEY. La lecture REST serveur répond également 200.

`python supabase/scripts/check_client_secrets.py` : PASS, dix artefacts client
contrôlés, y compris recherche de la valeur courante de SUPABASE_SECRET_KEY.
Le repository est server-only ; aucune modification des chemins d'import ou des
variables publiques. Ce résultat certifie le build inspecté ; il ne peut garantir
l'absence de fuite dans un futur code modifié. Aucun secret sauvegardé dans les preuves.

Preuves actuelles sous `evidence/final-*` : build, tests, scan, HTTP, trace RPC,
inspection REST. Les preuves antérieures restent historiques.

## PostGIS : exposition normale et risque réel distingués

La table spatial_ref_sys contient des définitions de systèmes de coordonnées,
pas des données métier ou secrets. Son existence, sa lecture publique et les vues
geometry_columns/geography_columns sont des objets techniques normaux PostGIS.
La vue geometry_columns filtre par has_table_privilege(...,'SELECT').
L'absence de RLS sur cette table technique ne prouve donc pas une fuite métier.
PostGIS dans public explique les alertes ; déplacer l'extension n'est pas nécessaire
pour valider Task 04 et introduirait des opérations/dependencies hors du correctif minimal.

**Risque réel : écriture client.** Les ACL accordent INSERT/UPDATE/DELETE/TRUNCATE
sur spatial_ref_sys à anon/authenticated, sans RLS. EXPLAIN UPDATE sous anon
(sans ANALYZE, WHERE false, transaction read only) réussit : le serveur autorise
la planification de cette écriture. Aucune instruction UPDATE n'a été exécutée.
Un client pourrait altérer les références spatiales ou leur disponibilité.
Les RPC Task 04 utilisent aujourd'hui EPSG:4326, envelope/intersects/simplify sans
ST_Transform : aucune altération constatée et aucun impact actuel démontré ;
cela ne justifie pas un droit d'écriture anonyme sur un objet partagé.

Trois surcharges st_estimatedextent sont SECURITY DEFINER supabase_admin, sans
search_path fixé et exécutables par les clients. Ce sont des fonctions C PostGIS
standard ; aucun exploit de search_path n'est démontré. Elles peuvent néanmoins
exposer des estimations de l'étendue spatiale via les statistiques avec les droits
du propriétaire, indépendamment des accès table du client. L'appel anon sur grid_cells
réussit et renvoie NULL sur la base vide : aucune fuite effective de données ici,
mais cette surface technique n'est pas nécessaire aux trois RPC AgriclimaX.
Les alertes sur les RPC AgriclimaX sont intentionnelles : elles appartiennent au
reader NOBYPASSRLS et lisent seulement les résultats publiés avec bornes explicites.

Références : [PostGIS Supabase](https://supabase.com/docs/guides/database/extensions/postgis),
[RLS audit](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public),
[fonctions definer publiques](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

## Correction proposée, non appliquée

[POSTGIS_PERMISSION_PROPOSAL.sql](POSTGIS_PERMISSION_PROPOSAL.sql) : retirer uniquement
les droits d'écriture clients sur spatial_ref_sys et EXECUTE client sur les trois
st_estimatedextent. Conserver SELECT, PostGIS, données, schémas, propriétaires,
RLS applicative et les trois RPC AgriclimaX. Pas de DROP, purge ou seed.
Appliquer ultérieurement par une nouvelle migration forward-only via Supabase,
**après accord utilisateur**, conformément à sa demande de proposition préalable.
Si le propriétaire supabase_admin impose une intervention administrative, ne pas
changer le propriétaire ni contourner les droits ; signaler cette limite.
Après correction : revérifier privilèges, RPC, HTTP et audit ; une alerte RLS technique
peut rester malgré des droits réduits à la lecture, à documenter sans prétendre audit vierge.

## Conclusion

HTTP/RPC et bundle client : conformes pour ce build et ce projet DEV vide.
La validation complète reste en attente de décision sur le correctif de permissions
PostGIS. PR #2 maintenue en draft ; aucun merge dans main. Seule la documentation
et les preuves de Task 04 sont modifiées pendant cette validation.
