# Vérification Task 15

## État de livraison

**Implémentation prête pour revue ; acquisition ERA5 France encore bloquée par
le domaine de téléchargement CDS non autorisé. Ne pas assimiler le plan de
couverture aux données acquises.** Aucun historique national massif lancé,
aucun merge. Les migrations additives sont appliquées sur agriclimax-dev.

`STRATEGY.md` contient l'inspection préalable, les estimations corrigées par les
mesures, les coûts, la rétention et les limites ; `OPERATIONS.md` décrit les
petites commandes de reprise. `estimate.json` est reproductible sans réseau.

## Acquisition réelle et idempotence

- Catalogue DPObs officiel récupéré : 1 818 candidats ; 96 stations sélectionnées,
  avec métadonnées/checksum et lots de dix (`stations.json`, `catalogue.log`).
- DPClim réel : dix nouvelles stations, une date (2026-09-01), 60 valeurs
  attendues dont 49 présentes ; les autres restent nulles et marquées manquantes.
  Le produit n'est pas étiqueté complet (`station-backfill.log`).
- Deuxième acquisition du même lot dans une autre racine : même checksum,
  `changed=false` (`station-replay.log`). La base reste à 15 stations et 200 lots,
  zéro doublon de clé station/source/date (`supabase-final.json`).
- ERA5 : petite tentative tuile/date ; catalogue CDS HTTP 200, requête traitée et
  URL de téléchargement obtenue. Téléchargement bloqué par ProxyError sur
  `object-store.os-api.cci2.ecmwf.int`, absent des hôtes autorisés. Demande d'ajout
  envoyée à l'utilisateur. Aucun contournement de proxy ; aucun NetCDF nouveau
  acquis, aucune ligne nationale ERA5 persistée. Voir `era5-diagnostic.json`.
- Reprise/idempotence ERA5 testées avec adaptateur simulé et données de forme
  réelle : budget avant réseau, support incomplet/dupliqué refusé, checkpoint
  seulement après persistance, distinction cache/SQL, vérification SHA256 à la
  reprise, corruption refusée. Cela ne remplace pas une acquisition CDS réelle.

## SQL et performances

Deux exécutions dans PostgreSQL/PostGIS jetable (extension en `public` puis en
`extensions`) : toutes migrations, RLS, contrats, tests Task11/12/13 et nouveaux
cas France passent. Aucun jeu synthétique n'a été écrit dans Supabase distant.

Les tests France vérifient : rejeu, clé naturelle, modification sous la même
version refusée, doublons d'entrée refusés, pagination/cursor, limites, droits
anon/authenticated refusés et lecture service_role. RLS activée/forcée sur les
nouvelles tables ; RPC `SECURITY INVOKER` uniquement.

Benchmark local synthétique : 6 429 supports × 7 dates, plus une ligne de test
(45 004 lignes), 19 570 688 octets, environ 434 octets/ligne index compris.
Le plan utilise `france_daily_map_idx`. Avec extension en public : lecture
indexée des 1 000 lignes ~0,4 ms ; agrégation JSON RPC ~10 ms. Seuil du test
500 ms pour une page de 1 000 lignes. Résultats exacts et buffers dans
`sql/france-public.log` et `sql/france-extensions.log`. Pas d'extrapolation de ce
benchmark à trente années chargées, ni au réseau de production.

HTTP production Next local vers Supabase réel (`live-http.json`) :
API grille HTTP 200, support grille explicite et état absent pour un jeu non
acquis ; catalogue HTTP 200, 15 stations/support points ; limite 1001 HTTP 400.
Médianes réseau observées : environ 702 ms grille vide et 613 ms catalogue
stations, proxy inclus (trois requêtes chacune, pas un SLA). Un Node 24 local
nécessite `NODE_USE_ENV_PROXY=1` dans cet environnement pour son fetch natif.
La performance HTTP d'une page ERA5 **remplie** n'a pas été mesurée faute
d'acquisition ; seule sa requête SQL est mesurée avec les supports synthétiques.

Base distante après essais : environ 22,1 Mo, contre 21,9 Mo initialement.
Aucun doublon station, aucune donnée grille synthétique. Le compte nul de
`france_daily` ne constitue évidemment pas une validation de son ingestion réelle.

## Tests et audits

- `make check` : 116 tests Python, 176 tests web, gardes qualité/sécurité,
  contrats, lint, typecheck, build et contrôle des exceptions d'audit passent.
- Ruff et mypy strict sur climate et les quatre nouveaux scripts passent.
- Tests SQL dans les deux emplacements de PostGIS passent ; migrations
  existantes immuables, deux migrations forward-only générées par CLI.
- Actionlint : passe. Audit Python engine/climate et outils : aucune
  vulnérabilité connue dans les lockfiles examinés.
- Audit JS : exception existante `GHSA-vfj7-8cjw-p6xm` sur braces dans la chaîne
  ESLint seulement ; le garde vérifie zéro chemin de production et les traces du
  build. Aucune nouvelle exception ni dépendance produit introduite.
- Gitleaks : historique et diff livré sans fuite ; résultats expurgés. Les caches
  de build et outils temporaires ne sont pas des livrables.
- Advisors Supabase conservés : alertes **préexistantes** sur PostGIS dans public,
  spatial_ref_sys sans RLS et anciennes fonctions SECURITY DEFINER exposées.
  Aucun nouveau SECURITY DEFINER ou accès public sur les tables France.
  Remédiations : [RLS public](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public),
  [extension public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public),
  [fonctions exposées](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

Pas de changement de présentation visuelle, de règle scientifique Wheat/THI,
de contrat de risque partagé ou d'interpolation. Le nouveau endpoint de grille
est testé séparément de celui des stations.

## Restant avant exploitation nationale

Autoriser le domaine de livraison CDS, rejouer une tuile réelle, vérifier ses
valeurs/empreintes, puis tester une page carte remplie via HTTP. Configurer une
racine durable ou un miroir objet privé vérifié et une routine de rétention
avant de planifier des acquisitions régulières. Les références 1991–2020 sont
préparables mais **non constituées nationalement** ; acquisition progressive sous
budget après validation du petit lot, jamais une boucle historique automatique.
