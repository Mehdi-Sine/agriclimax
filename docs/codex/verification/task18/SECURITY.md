# Sécurité

Aucun changement SQL, rôle, privilège, migration, RLS, secret ou règle scientifique.
La minimisation du diagnostic issue de main est conservée : DTO allowlist serveur,
seuil blé projeté en texte depuis des scalaires connus, aucun portfolio complet.
Le composant client de carte reçoit des marques rendues, aucun objet publication.
Les filtres reçoivent uniquement les identifiants et noms des stations.

Vérifications réellement exécutées :

- HTML initial et flux RSC diagnostic explicite : champs privés et canary absents.
- Bundle client : aucune RPC privée, référence de clé serveur ou canary.
- 24 réponses HTTP de pages renseignées : champs bruts et valeurs de secrets
  configurés absents ; aucun corps réel enregistré dans les artefacts.
- Logs du serveur : scan des valeurs de credentials configurés, sans fuite.
- Scans dépôt/bundle et `supabase/scripts/check_client_secrets.py` : PASS.
- DEV : 20 tables métier RLS activée ; aucun grant table de `agriclimax_private`
  à PUBLIC, anon ou authenticated. `agriclimax_read_daily` est SECURITY INVOKER,
  search_path pg_catalog, timeout 5 s, exécution refusée à anon/authenticated.
  Une RPC par chargement serveur, fenêtres bornées, aucune requête de météo brute.
- `agriclimax_api_reader` : NOLOGIN, NOBYPASSRLS. Les trois RPC historiques gardent
  leur owner et leurs limites. Aucune nouvelle fonction SECURITY DEFINER.

## Exceptions inchangées

L'advisor DEV ne renvoie pas zéro alerte : spatial_ref_sys sans RLS, PostGIS dans
public, trois surcharges st_estimatedextent et les trois anciennes RPC definer.
Ce sont les exceptions documentées dans [Task 04 CLOSURE](../task04/CLOSURE.md),
contrôlées inchangées ; aucun nouveau contournement ou acceptation ajouté.
Remédiations Supabase : [RLS](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public),
[extension](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public),
[definer anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
[definer authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Audit Node : uniquement GHSA-vfj7-8cjw-p6xm/braces 3.0.3, exception déjà approuvée
jusqu'au 10 novembre 2026, outillage ESLint dev, absente des chemins production
et traces serveur. `audit-exceptions.mjs --build` valide ces limites. Aucune nouvelle
exception ; l'audit brut signale toujours ce finding. Audit Python des trois
lockfiles : aucune vulnérabilité connue.

La tentative de lecture du changelog Supabase a reçu un refus réseau 403 ; la
documentation RLS/secure API a été consultée via MCP. Aucun changement Supabase
n'a été implémenté. Les contrôles SQL exécutés sont exclusivement des SELECT.
