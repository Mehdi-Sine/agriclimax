# Task 11 — Météo-France live ingestion

Le prompt du demandeur remplace pour cette branche l'ancienne Task 11 RPG ;
`11_RPG_EXPOSURE.md` reste une tâche future distincte. Base : `main 5df60e3`,
après merge Task 10 / PR #26. Worktree et branche `codex/11-meteofrance-live`.
Identité : Mehdi-Sine <mehdi.sine@acta.asso.fr>.

## Inspection avant écritures distantes

Projet DEV `yyfbpecxvxglzxopsmel` : migrations 0001–0004 enregistrées ; toutes
les tables métier vides. PostGIS dans `public`. Tables métier avec RLS forcée,
sans droits clients directs. Les variables Météo-France/Supabase sont `ready`,
observations courantes, réseau `enforced`. Les commandes réseau nécessitent les
permissions d'exécution appropriées ; le proxy et la vérification TLS sont conservés.
DPClim/v1 liste stations + commande/fichier : 200 / 202 / 201 réels.
DPObs/v1 liste stations et horaire : 200 réels. DPObs/v2 : 403 ; v1 choisi
explicitement, sans tentative de changement de clé ou de subscription.

## Migration proposée avant application

`20261014133958_meteofrance_station_ingestion.sql` est additive et forward-only :

- `agriclimax_private.weather_stations` : géométrie Point EPSG:4326, altitude,
  métadonnées publiques et date de récupération ;
- `agriclimax_private.station_weather_batches` : lot normalisé par station/source/date,
  source et manifest liés par FK ; clé primaire d'idempotence, index FK run ;
- trois RPC SECURITY INVOKER, EXECUTE exclusivement `service_role`, sans droits
  clients directs, RLS activée et forcée ;
- ingestion atomique, refus des lots invalides/demo, protection contre perte de
  valeurs connues lors d'une acquisition partielle et contre une récupération plus ancienne.

Aucune suppression, remplacement de migration, polygone, seed fictif, production,
règle scientifique, seuil, publication de risque, modification des RPC risques,
configuration de sécurité Vercel ou changement de contrat partagé.
Tests SQL jetables `public` et `extensions` avant application DEV. L'autorisation
du prompt couvre cette persistance réelle et les migrations non destructives.

## Frontières

Ingestion : provider/adapters Task 03, normalisation interne étendue sans changer
les fixtures. DB/API : persistance station séparée des cellules surfaciques Task 04,
endpoints station avec schéma de transport local. Engine Task 02 : consommable
ultérieurement, aucun calcul/classification live avec le YAML fictif existant.
Web UI et mode démo conservés. ERA5-Land reste une future source de baseline/fallback.

## Point de sécurité préexistant à traiter séparément

L'inspection SQL confirme que `public.spatial_ref_sys` n'a pas de RLS et que `anon`
possède SELECT/INSERT, `authenticated` UPDATE. C'est une table d'extension PostGIS,
pas une table métier nouvellement créée. Aucun correctif automatique appliqué.
Proposition à examiner séparément : révoquer d'abord les droits d'écriture clients
sur cette table d'extension, puis décider si son accès en lecture doit rester ouvert.
Une activation RLS sans politique risque de bloquer les usages PostGIS.
[Documentation RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Sources et documentation consultées

- [API climatologiques](https://www.data.gouv.fr/dataservices/api-donnees-climatologiques)
- [API observations](https://www.data.gouv.fr/dataservices/api-donnees-dobservation)
- [Documentation climatologique Météo-France](https://confluence-meteofrance.atlassian.net/wiki/spaces/OpenDataMeteoFrance/pages/621510657)
- [Évolution ETP / FAO-56 en 2026](https://confluence-meteofrance.atlassian.net/wiki/spaces/OpenDataMeteoFrance/pages/1587904530)
- [Fonctions Supabase](https://supabase.com/docs/guides/database/functions)
- [Changelog breaking changes](https://supabase.com/changelog?types=breaking-change)

L'index `changelog.md` est inaccessible dans cet environnement ; filtre officiel
breaking-change consulté via recherche. Les changements d'exposition Data API
justifient les grants explicites. Aucune fonctionnalité Auth, Realtime ou chiffrement
pgcrypto n'est utilisée ; TLS reste activé.
