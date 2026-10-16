# Vérification Task 15

## État de livraison

**Validation réelle du petit lot ERA5 réussie le 16 octobre 2026 : une tuile,
une journée UTC, trois mailles persistées en DEV. Le blocage CDS est levé.
Le plan national reste distinct des trois mailles acquises.** Aucun historique national massif lancé,
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
- ERA5 réel : téléchargement CDS terminé sur `[2,48,3,49]` pour le 1er octobre
  2026 (2 octobre inclus pour l'accumulation pluie). NetCDF de 49 431 octets,
  dimensions 48 heures × 11 latitudes × 11 longitudes, t2m en K et tp en m.
  SHA256 local vérifié : `ab681f44cf1a45fba13f5c81a1f2ebf50a1b9a26bf35ed6ee36ab8eb8ed06a5a`.
  Le SDK termine le téléchargement ; ouverture NetCDF et recalcul indépendant
  des quatre valeurs sur les trois mailles passent. Ce SHA256 est l'empreinte
  locale du fichier reçu, pas une somme publiée indépendamment par CDS.
- Trois mailles natives du masque France (48.8/2.3, 48.8/2.4, 48.9/2.3) seulement
  sont archivées et persistées sous `task15-france-real-20261001-v1`.
  Première écriture RPC : true ; rejeu exact : false. Reprise checkpoint : zéro
  acquisition et zéro ligne écrite. Base après rejeu : trois lignes, une
  acquisition, zéro doublon. Voir `era5-real-validation.json`,
  `supabase-before-real.json` et `supabase-after-real.json`.
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
Validation finale HTTP sur page ERA5 **remplie** (`live-http-filled.json`) :
Next.js en build production local vers Supabase DEV réel, proxy inclus,
`NODE_USE_ENV_PROXY=1`, cinq GET sans cache. HTTP 200, état `available`, trois
lignes ; médiane **363.29 ms**, plage 154.25–380.6 ms.
Valeurs relues conformes au NetCDF à 0,0001 près (stockage SQL real), unités °C/mm,
clé d'acquisition conservée, `interpolation=none`. Pagination réelle 2 + 1 lignes,
sans doublon ; limite 1001 refusée avec HTTP 400. Il s'agit d'une page de trois
lignes, pas d'un benchmark HTTP de 1 000 mailles ni d'un SLA de production.

Base DEV avant/après cette validation : 22 189 747 / 22 238 899 octets.
Aucune donnée synthétique ni référence 1991–2020 ajoutée. Les NetCDF et archives
restent sous `work/task15-real/`, hors Git et hors Postgres ; seuls les reçus,
empreintes et résultats compacts sont versionnés. Le cache de cette session
n'est pas une archive durable garantie.

## Tests et audits

- Relance finale `final-make-check.log` : 116 tests Python, 176 tests web, gardes qualité/sécurité,
  contrats, lint, typecheck, build et contrôle des exceptions d'audit passent.
- Ruff et mypy strict sur climate et les quatre scripts passent à nouveau
  (`final-ruff.log`, `final-mypy.log`).
- Tests SQL dans les deux emplacements de PostGIS passent ; migrations
  existantes immuables, deux migrations forward-only générées par CLI.
- Actionlint : passe. Audit Python engine/climate et outils : aucune
  vulnérabilité connue dans les lockfiles examinés.
- Audit JS : exception existante `GHSA-vfj7-8cjw-p6xm` sur braces dans la chaîne
  ESLint seulement ; le garde vérifie zéro chemin de production et les traces du
  build. Aucune nouvelle exception de dépendance ni dépendance produit introduite.
- Gitleaks final : sept faux positifs `generic-api-key` sur le SHA256 public
  d’acquisition, tous vérifiés en recalculant `content_key(metadata)` depuis
  l’archive et les reçus. Exclusions par empreinte historique exacte dans
  `.gitleaksignore`, sans exclusion globale de chemin ou de règle. Scan complet
  relancé sans fuite (`final-gitleaks.log`, `final-gitleaks.json`). Les caches
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

Le petit lot réel et la page HTTP remplie sont validés. Configurer une
racine durable ou un miroir objet privé vérifié et une routine de rétention
avant de planifier des acquisitions régulières. Les références 1991–2020 sont
préparables mais **non constituées nationalement** ; acquisition progressive sous
budget après validation du petit lot, jamais une boucle historique automatique.
