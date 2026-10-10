# Correction de permissions — autorisée, application bloquée

> État de clôture : révocation PostGIS abandonnée, migration non applicable retirée.
> Tous les contrôles Task 04 relancés passent. Les anciens blocages ci-dessous
> sont historiques. Voir [CLOSURE.md](CLOSURE.md) pour la conclusion actuelle.

10 octobre 2026. Projet DEV agriclimax-dev, yyfbpecxvxglzxopsmel.
L'utilisateur a autorisé explicitement le correctif proposé. Aucun nouvel accord
sur le périmètre n'est requis ; il manque les droits administratifs d'exécution.

## Migration reproductible

`supabase/migrations/20261010175220_postgis_client_permissions.sql` créée avec
Supabase CLI 2.81.2, `supabase migration new postgis_client_permissions`.
Elle retire uniquement INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER de
public.spatial_ref_sys à PUBLIC/anon/authenticated, et EXECUTE client sur les trois
surcharges st_estimatedextent identifiées. SELECT conservé. Aucune donnée,
propriétaire, extension, autre permission ou RPC applicative modifiée.
Un bloc d'assertions vérifie les droits effectifs et la conservation de SELECT
avant commit : une révocation sans effet ne peut être enregistrée comme réussite.

## Tentative via le plugin et résultat réel

`apply_migration(name=postgis_client_permissions)` a échoué avec :
`PostGIS client write privileges remain for anon`.
La transaction entière a été annulée. L'historique distant contient toujours
uniquement les quatre migrations 0001–0004. Aucun REVOKE partiel n'a été conservé.

Le plugin exécute comme postgres. Les objets sont possédés par supabase_admin.
postgres n'est ni membre de supabase_admin, ni autorisé à SET ROLE supabase_admin,
et n'a pas UPDATE WITH GRANT OPTION sur spatial_ref_sys. REVOKE peut produire un
avertissement sans retirer les grants du propriétaire ; l'assertion détecte ce cas.
Il ne faut pas retirer l'assertion, changer le propriétaire, élargir un rôle ou
contourner les droits pour obtenir un faux succès.

Contrôle après rollback : SELECT client conservé ; INSERT/UPDATE/DELETE/TRUNCATE
client toujours vrais ; EXECUTE client toujours vrai sur les trois fonctions.
Le risque identifié reste donc ouvert, correction **non appliquée**.

Il faut exécuter cette même migration avec une voie administrative Supabase
habilitée à révoquer les grants supabase_admin, avec enregistrement migratoire,
puis relancer les assertions, HTTP et audit. L'accès plugin actuel ne suffit pas.
Le fichier local porte sa version CLI ; apply_migration attribue son horodatage
réel lors d'une application réussie. Ne pas marquer cette version appliquée avant
succès et vérification des ACL.

## Vérifications relancées

- PostGIS 3.3.7 toujours actif ; centroid POINT(0.5 0.5).
- Build Next.js production réussi, 25 tests web réussis (22 Task 04, 3 foundation).
- Scan de dix artefacts client : aucune valeur courante ni SUPABASE_SECRET_KEY.
- Nouveau serveur production sur loopback 3045, projet DEV réel : map, series,
  territory HTTP 200, sorties vides correctes, no-store, aucun 5xx ni secret.
  Requête invalide HTTP 400. Trace POST vers chacune des trois RPC, réponses 200.
- Les onze tables métier ont exactement zéro ligne. Aucun seed ou insertion.

Preuves : `evidence/permission-attempt.json`, `evidence/permission-http.json`,
`evidence/permission-rpc-trace.jsonl`, logs permission-build/tests/secret-scan.
Ces succès ne certifient pas un durcissement qui a été rollbacké.

## Conclusion

Migration SQL et documentation livrées sur codex/04-postgis-api. Aucun changement
de code applicatif ni des migrations déjà appliquées. Correction distante bloquée
par les droits du propriétaire ; PR #2 **maintenue draft**, aucun merge dans main.
