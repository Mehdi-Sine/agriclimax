# Conclusion Task 04 — validation clôturée

10 octobre 2026. Branche codex/04-postgis-api ; projet DEV agriclimax-dev
(yyfbpecxvxglzxopsmel). Ce document remplace les anciens blocages documentés.

## Décision PostGIS

L'application du correctif de révocation est **abandonnée**, conformément à la
consigne utilisateur. La migration 20261010175220_postgis_client_permissions.sql
est retirée de supabase/migrations pour éviter un échec des déploiements futurs.
Sa tentative précédente a été entièrement rollbackée ; aucune entrée distante
n'a été créée. L'historique DEV conserve uniquement les quatre migrations 0001–0004.
Le SQL proposé dans la documentation reste un artefact historique clairement marqué
non applicable sur Supabase managé, à ne pas exécuter.

spatial_ref_sys est un objet technique de l'extension PostGIS : il contient des
références de systèmes de coordonnées, aucune donnée métier AgriclimaX. Les vues
geometry_columns/geography_columns et st_estimatedextent sont également des objets
techniques. Sur Supabase managé ils peuvent appartenir à supabase_admin ; le rôle
postgres fourni au plugin ne peut pas modifier ces ACL. L'alerte résulte de
l'installation de PostGIS dans public, schéma exposé au Data API. Elle ne constitue
pas une preuve de fuite de données métier AgriclimaX par spatial_ref_sys.

Les ACL techniques et les alertes restent présentes ; ce n'est pas un audit sans
avertissements. Les constats antérieurs de privilèges clients ne sont pas effacés.
Aucune fuite métier effective n'a été constatée. Les tables AgriclimaX restent
protégées séparément par RLS forcée et absence de grants table client ; seules
les trois RPC bornées exposent les résultats publiés.

Le durcissement recommandé à terme est **d'installer PostGIS dans un schéma dédié**
(gis ou extensions), conformément à la [documentation Supabase](https://supabase.com/docs/guides/database/extensions/postgis).
Pour l'installation existante, une telle évolution nécessite une migration préparée
et revue séparément, avec sauvegarde et examen des dépendances. Aucun déplacement,
réinstallation, changement de propriétaire, ACL ou donnée n'est réalisé dans Task 04.
Les trois RPC SECURITY DEFINER AgriclimaX restent intentionnelles et possédées par
un reader NOLOGIN/NOBYPASSRLS soumis à RLS, avec bornes et search_path fixés.

## Contrôles relancés

| Contrôle | Résultat |
|---|---|
| pnpm lint | Réussi, zéro warning |
| pnpm typecheck | Réussi |
| pnpm test | 25 tests réussis, dont 22 Task 04 |
| pnpm build | Réussi, routes API dynamiques |
| check_contracts.py | 3 contrats/exemples, GeoJSON et 4 YAML validés offline |
| PYTHONPATH=engine/src pytest engine/tests | 10 tests réussis |
| run-local.sh public | Migrations, SQL sécurité, contrats et EXPLAIN réussis |
| run-local.sh extensions | Mêmes contrôles réussis dans le schéma alternatif |
| check_client_secrets.py | Dix artefacts client, aucun secret courant ni SUPABASE_SECRET_KEY |
| HTTP map / series / territory | 200, résultats vides corrects, no-store, aucun 5xx ni secret |
| Trace RPC réelle | POST vers les trois RPC attendues, chacune 200, apikey serveur correcte |
| HTTP invalide | 400/INVALID_QUERY |
| SQL DEV | PostGIS 3.3.7 actif ; onze tables RLS activée/forcée ; aucun grant table client |
| Historique DEV | Seulement 0001–0004, inchangé |

Les tests SQL utilisent exclusivement des conteneurs locaux jetables et des
fixtures synthétiques transactionnelles rollbackées ; aucun seed n'est exécuté
sur DEV. Les conteneurs sont supprimés par le runner. Les tests HTTP utilisent
un nouveau serveur de production local relié au DEV réel, sans mock Supabase.
Le premier pytest a requis PYTHONPATH=engine/src pour retrouver le package local ;
la relance avec ce chemin réussit sans modification du code.

Preuves actuelles : evidence/closure-* ; les anciens journaux sont historiques.
La certification du bundle concerne le build inspecté, pas un futur code modifié.
Aucun secret n'est enregistré dans les preuves. Aucun code applicatif ou contrat
scientifique modifié dans cette clôture. Aucun merge dans main.

## État de review

Les critères fonctionnels et de sécurité applicative Task 04 sont validés.
Les avertissements techniques PostGIS sont documentés et acceptés dans le périmètre
actuel à la demande utilisateur ; le futur schéma dédié est différé explicitement.
PR #2 peut passer en Ready for review. Les anciens avertissements Vercel ne sont
pas présentés comme un déploiement Vercel réussi ; la validation repose sur les
contrôles locaux et DEV ci-dessus.
