# Sécurité ciblée — réserve d’administration

Les tables PRA privées vérifiées sur DEV ont toutes RLS activée et aucun privilège de lecture/écriture anon/authenticated. Les quatre RPC PRA, dont la persistance, restent SECURITY INVOKER, search_path pg_catalog et timeout borné, sans EXECUTE anon/authenticated. Les nouvelles routes Next.js n’exposent que les projections de lecture validées de l’édition Task19D. La clé serveur reste dans les modules server-only ; aucun client Supabase privilégié n’est ajouté.

## État PostGIS réel

`public.spatial_ref_sys` appartient à **supabase_admin**, RLS désactivée ; anon/authenticated conservent des privilèges directs, notamment SELECT et INSERT. Trois surcharges `st_estimatedextent` SECURITY DEFINER sont également exécutables publiquement. Ce sont des accès existants, non corrigés par cette Task. La réserve est réelle, pas une preuve de sécurité satisfaite.

Le compte connecté ne possède pas les droits du propriétaire. Un essai REVOKE en transaction annulée n’a pas retiré les droits effectifs. Aucun changement de propriétaire, élévation ou contournement n’a été tenté. **Aucune migration distante appliquée.**

Le 31 octobre 2026, l’utilisateur a explicitement accepté que l’absence d’accès propriétaire ne bloque pas la clôture Task20 et a demandé de conserver le correctif pour une intervention d’administration ultérieure. Le verdict fonctionnel READY_FOR_V0.3 porte sur DEV, avec cette réserve admise. L’ouverture publique du nouveau parcours reste désactivée par défaut (`PRA_NATIONAL_ENABLED` absent).

## Correctif préparé

[20261031101938_postgis_public_access.sql](../../../../supabase/migrations/20261031101938_postgis_public_access.sql) active RLS, retire les privilèges PUBLIC/anon/authenticated de la table et EXECUTE sur les trois helpers, conserve les accès serveur nécessaires et vérifie les droits effectifs. Il ne déplace pas l’extension et ne modifie pas les RPC historiques intentionnellement publiques.

Le correctif est testé sur PostGIS jetable en **public et extensions**, avec la suite SQL v0.2. Les gardes échouent si la fermeture n’est pas effective. Il accepte aussi un état déjà corrigé par le propriétaire, permettant ensuite de réconcilier l’historique sans redonner de privilèges.

Action d’administration avant toute décision d’ouverture publique : faire examiner/exécuter ce SQL par le propriétaire autorisé ou l’administration Supabase, puis vérifier RLS/droits et RPC sur DEV, réconcilier l’historique de migration et relancer les parcours réels. Ne pas accorder un rôle d’administration à l’application. Les accès PostGIS existants subsistent jusqu’à cette intervention ; le drapeau produit ne les supprime pas. Le warning « extension dans public » pourra rester documenté : aucun déplacement global requis ici.

Références Supabase : [RLS en schéma exposé](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public), [extension dans public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public). Mesures exactes des tables/RPC PRA dans [measurements.json](measurements.json). Aucun audit scientifique ou géographique Task19 rouvert.
