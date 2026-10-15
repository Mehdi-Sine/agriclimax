# Vérification Task 13 — Wheat MVP

Exécution du **15 octobre 2026**, depuis `main`
`4a99d45511c99491fee6147fc49300662b47b91c` (PR #29 post-validation Task12),
branche `codex/13-wheat-mvp`, identité Mehdi-Sine <mehdi.sine@acta.asso.fr>.
`main` a été refetché et son SHA reconfirmé avant livraison. Aucun merge.

Le périmètre Wheat MVP est celui de la demande utilisateur, retranscrit dans
`docs/codex/tasks/13_WHEAT_MVP.md`. Le fichier historique Production Hardening
reste inchangé. Aucune autre Task commencée.

## Prérequis vérifiés directement

- Code `engine/src/agriclimax/climate/era5_land.py` présent sur le dernier main.
- Migration `20261015073507_climatology_reference.sql` présente, tables distantes
  `climate_references` et `climate_indicators` effectivement inspectées en SQL.
- Workflow `.github/workflows/task12-era5-real-validation.yml`, nommé
  **Task12 ERA5 real validation**, présent et lu sur main via GitHub et git.
- Persistance `SupabaseClimateRepository` et RPC `agriclimax_persist_climate`
  présentes ; documentation Task12 actualisée post-validation lue. L'ancien
  blocage CDS du rapport historique n'est pas retenu comme état actuel.
- SQL distant initial : 240 révisions ERA5-Land, table indicateurs vide,
  185 lots archive Météo-France et 5 lots récents, cinq stations existantes.
  Contrôle final : 300 révisions climatologiques, toujours 190 lots station.
  L'évolution du compteur distant n'est pas attribuée à cette exécution : toutes
  nos opérations sur les données Tasks11/12 sont des lectures, aucune ingestion
  ERA5 ni écriture Task11/12 n'a été lancée ici.
- Trois dates ERA5 distinctes (1–3 septembre 1991) ont été exportées en lecture
  seule pour le contexte technique explicite Brest/grille distante. Ce ne sont
  pas 30 années de normale. Aucun seuil de complétude Task12 abaissé.

## Frontières et livraison

Calculs purs et modèles privés dans `engine/src/agriclimax/wheat/` ; paramètres
scientifiques descriptifs versionnés dans `config/wheat-mvp.json` ; CLI d'acquisition,
replay, export de schéma et bundle. Les interfaces passent par un repository
serveur et un schéma généré, sans réimplémenter les calculs scientifiques en web.
Les contrats de risque V1, les migrations appliquées et le code/documentation
Task12 restent inchangés.

Dix portefeuilles réels, cinq stations × deux fenêtres : **100 indicateurs**, dont
**80 valeurs disponibles** et **20 anomalies null avec motifs explicites**.
Les entrées réelles exactes, reçus source et checksums sont dans `inputs/` ; leur
replay local est testé exactement contre le bundle serveur.
[Valeurs par station](LIVE_RESULTS.md), [méthodes](METHODS.md),
[reproduction et exploitation](OPERATIONS.md).

Observation Map : points géographiques cliquables et tableau accessible.
Scientific Diagnostic : tous les indicateurs, paramètres, règles, provenance et
limites. Watch : suivi descriptif, sans faux signal agronomique. Les trois espaces
utilisent `mode=wheat`, avec états absent, insuffisant, ancien et erreur explicites.
Les calculs sont exploratoires et ne sont ni conseil, ni risque complet, ni stade
biologique inféré. Les instantanés et leur actualisation manuelle sont annoncés.

## Commandes et résultats

| Contrôle | Résultat |
| --- | --- |
| `corepack enable`, puis shims locaux en raison du runtime système en lecture seule | Activé dans work, contrainte projet conservée |
| `corepack prepare pnpm@10.0.0 --activate`, `pnpm --version` | **10.0.0** |
| Installation pnpm frozen et Python dev+climate verrouillée | Réussie |
| `make check` final | **PASS**, lint/typecheck/build compris |
| Tests Python complets | **90 passés**, dont **16 Wheat** |
| Tests web complets | **145 passés**, dont **18 Wheat** |
| ruff Wheat + CLI + tests | PASS |
| mypy strict Wheat + CLI | PASS, 8 fichiers sources |
| SQL local `public` et `extensions` | PASS, migration, RLS, RPC, collision et idempotence |
| pnpm audit high | Aucune nouvelle vulnérabilité bloquante ; exception existante GHSA-vfj7-8cjw-p6xm inchangée et vérifiée |
| pip-audit engine/dev, climate, quality-tools | Aucune vulnérabilité connue |
| npm audit navigateur isolé | 0 vulnérabilité |
| gitleaks historique et staged, redacted | Aucun secret trouvé ; seul ignore historique exact du dépôt conservé |
| actionlint workflows | PASS |
| Sécurité bundle client et clés | PASS, aucun secret ni référence interdite |
| Budget client JS/CSS gzip | Environ **566 Ko**, budget **2 Mio** respecté |
| Playwright production | **18 audits** = desktop/tablette/mobile × clair/sombre × carte/diagnostic/veille |
| WCAG AA, clavier, overflow, navigation et fenêtres/stades absents | **0 violation**, aucune exception JS, aucun appel externe navigateur |
| Forward-only migrations et `git diff --check` | PASS |

Les premières installations ont nécessité de déplacer les caches pnpm/Corepack,
pip-audit et npm dans work. L'audit de répertoire brut gitleaks incluait des caches
Next générés et un SHA Git historique connu : les vérifications livrées portent
sur l'historique Git et les nouveaux fichiers staged, toutes deux propres, sans
nouvelle suppression de règle. Le changelog Supabase a répondu 403 ; les références
actuelles sur RPC INVOKER/droits ont été consultées via `search_docs`.

Le navigateur a permis de corriger deux défauts avant livraison : titre SVG
multi-enfants provoquant une divergence d'hydratation et rôle image masquant des
liens interactifs. Le titre est désormais une seule chaîne et la carte un groupe
nommé avec alternative tabulaire. Les rapports finaux sont verts.

## Persistance distante non appliquée

La migration additive Wheat et ses tests sont livrés pour revue. L'approbation
automatique a **refusé son application distante**, car la création persistante de
tables/fonctions/politiques/droits n'avait pas d'autorisation explicite d'application
sur Supabase. Aucun contournement effectué. Une requête SQL finale confirme que
`agriclimax_private.wheat_portfolios` n'existe pas dans la base distante.

Le produit fonctionne avec les instantanés réels serveur, sans cette mutation.
`WHEAT_STORAGE=supabase` est un mode explicite optionnel à activer seulement après
autorisation, application de la migration et publication de calculs. Les preuves
SQL de replay/idempotence Wheat sont locales, pas une revendication de persistance
distante. Aucun déploiement manuel ni merge n'est effectué par cette livraison.

## Limites restantes

Cinq points station, pas de parcelles identifiées ni couverture continue de
France ; deux fenêtres publiées, mise à jour manuelle. Références locales et
années homologues suffisantes requises pour produire des anomalies. Comparaison
station/grille non harmonisée/corrigée, confiance faible et validation experte
du blé encore absente. Aucun modèle phénologique actif ou niveau de risque.
