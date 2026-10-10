# Task 04 — persistance PostGIS et API de lecture bornée

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

La base Task 01 fournit des tables sans RLS et un accès web limité aux fixtures.
Cette PR ajoute la persistance privée des observations/indicateurs et métadonnées
versionnées, protège les onze tables applicatives, puis expose uniquement les
risques explicitement publiés via trois RPC et endpoints serveur bornés.

- Carte : production/date/indicateur/règle/version/bbox, simplification selon zoom,
  limite 2000 et troncature explicite ; payload complet avec provenance et qualité.
- Série : cellule, dates bornées et version explicite ; contrat RiskResultV1.
- Territoire : comptages de cellules intersectées par classe/confiance/fraîcheur ;
  aucune formule ou classification scientifique territoriale dans SQL.
- Sécurité : schéma privé, RLS forcée, zéro grant table client, publication default
  false, reader NOLOGIN/NOBYPASSRLS, search path protégé, server-only, erreurs
  sanitifiées, aucun cache/réflexion des secrets, secret key dans apikey serveur.

Contrats consommés : `risk-result.schema.json`, `map-feature.schema.json`.
`watch-signal.schema.json` lu, inchangé. Aucun contrat partagé modifié.
Une note demande une future interface demo/live compatible ; aucun consommateur
UI ou adaptateur existant n'est modifié.

Migrations : 0003 (six tables privées, publication/run, RLS, neuf index) et 0004
(trois RPC et deux helpers). 0001/0002 inchangées. Aucune suppression de données.
Retour arrière opérationnel par nouvelle migration révoquant les RPC, sans retrait
de tables/extensions/RLS. Examen complet : `MIGRATION_REVIEW.md`.

Validation : lint/typecheck/build ; 25 tests web ; 10 Python ; contrats offline ;
suite SQL sur PostGIS dans public et extensions ; validation des outputs SQL réels ;
EXPLAIN sur 10 000 cellules/100 000 risques fictifs ; 10 artefacts navigateur sans
secret ; tests HTTP de production. Aucun impact responsive, UI inchangée.

**Draft : application DEV bloquée.** REST serveur connecté (OpenAPI 200), tables
historiques 404/PGRST205 et RPC non listées. Accès SQL absent : aucune migration
DEV appliquée ; tables physiques, PostGIS, index, RLS et historique DEV non certifiés.
L'API retourne actuellement 502 pour ces RPC DEV absentes/inaccessibles. Ne pas
présenter cette branche comme un socle DEV déployé. Preflight et procédure documentés.

Limites : bbox territoriales ; anti-méridien à scinder ; tolérance géographique
approximative ; benchmark local synthétique, pas de garantie de charge ; rétention
proposée sans purge ; run_id historique nullable. Aucun merge, aucune autre Task.

Contrôles distants : check Vercel `failure`, URL cible d'invitation d'équipe,
motif détaillé non accessible ; aucun workflow GitHub Actions. Les contrôles réussis
rapportés ici sont locaux. La configuration Vercel/CI reste inchangée.
