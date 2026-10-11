# Task 06 — Observation Map

## Référence et périmètre

Worktree : `/workspace/agriclimax-task06` ; branche `codex/06-observation-map`.
Base : `origin/main` `be3711e`, récupérée avant les modifications.
Les merges Tasks 01–05 et 09 sont présents ; le design system Task 05 et les
routes `/api/risks/map`, `/api/risks/series`, `/api/risks/territory` sont vérifiés.
`baseline-make-check.txt` conserve le check vert avant modification.

Documents lus intégralement : AGENTS racine et web, START_HERE_CODEX,
ORCHESTRATION, Task 06, UX_ARCHITECTURE, DESIGN_SYSTEM, PRODUCT_CHARTER,
schémas map-feature et risk-result. Les guides Next.js installés sur frontières
client, chargement différé et History API ont été consultés.

Task 06 uniquement : Observation remplace le slot du shell. Veille et Diagnostic
restent les compositions Task 05 ; aucun moteur Task 07/08, migration, contrat,
paramètre ou seuil scientifique n'est modifié.

## Composition et frontières

- MapLibre **6.13.0**, version du lockfile existant ; chargement client différé.
- Fond France métropolitaine / Corse et pays voisins local Natural Earth,
  simplifié, attribution et provenance dans `public/maps/README.md`.
- Géométries et résultats par `DemoObservationAdapter` / `ApiObservationAdapter`,
  respectant `MapRiskLayerAdapter`. Le renderer GeoJSON actuel est distinct de
  l'adapter de transport ; un futur renderer vectoriel peut être ajouté sans
  ajouter de requête Supabase dans les composants.
- API `map` seule nécessaire à cette vue. `series` et `territory` restent présents
  pour les autres parcours ; aucune série ni agrégation frontend n'est créée.
- Démo locale explicite par défaut, fixture existante unique `demo-001`, sans
  création de valeur, cellule ou classe scientifique supplémentaire.
- Live sélectionnable, règle/version saisies explicitement ; bbox courante,
  zoom entier adapté au contrat Task 04, limite 1 000 cellules. Réponse validée
  côté API puis contrats map/risk vérifiés par l'adapter client.
- Aucun fallback implicite d'une erreur live vers les fixtures. Bouton démo
  volontaire et bandeau `Données fictives` ; source live vide reste missing.
- Filtrage production/indicateur/date du shell existant, couches et légende,
  selection cellule par clic ou tableau, risque / confiance / fraîcheur séparés,
  valeur et unité d'aléa, règle, statut, sources, horodatages et flags fournis.
- Desktop : carte dominante, panneau repliable, largeur réglable au clavier.
  Tablette : filtres compacts et split view repliable. Mobile : contexte et filtres
  en sheet, carte, légende accessible sur la carte, bottom sheet de résumé puis
  développement des preuves, navigation Carte/Veille conservée.
- Camera bbox/zoom enregistrée après moveend, debounce 250 ms ; History API
  intégrée à Next sans relecture serveur du shell pour chaque déplacement.
  La sélection ajoute une entrée partageable ; retour navigateur et reload.
- Requêtes annulées sur changement de contexte, données du contexte précédent
  retirées immédiatement, états loading / missing / stale / source-error,
  fraîcheur inconnue distincte ; avertissement explicite si collection tronquée.

## Dépendances et raccords

Aucune nouvelle dépendance produit ni modification du lockfile.
MapLibre était déjà déclaré. Playwright provient de l'outillage tests/e2e existant.
Le worker ES module v6 et son module partagé sont copiés depuis le package
verrouillé avant `dev` / `build`, avec licence BSD, et ignorés par Git et ESLint.
Aucun téléchargement externe runtime, CDN ou service de tuiles nécessaire.

Raccords minimaux hors feature : `product-shell.tsx`, tests du loader du shell,
scripts `dev`/`build` du package web et exclusion des assets vendor générés.
Aucune primitive, palette ou composant métier du design system modifié.

## Vérifications locales

Commandes reproductibles (environnement sans installation globale adaptée) :

```sh
PATH=/workspace/work/bin:$PATH PYTHONPATH=engine/src make check \
  PYTHON=/workspace/work/task06-venv/bin/python
node tests/e2e/observation.mjs
python scripts/quality/security.py --bundle apps/web/.next/static
python supabase/scripts/check_client_secrets.py
python scripts/quality/budget.py
git diff --check
```

`/workspace/work/bin/pnpm` pointe vers pnpm 10.0.0 ; Python utilise les dépendances
`engine/requirements-dev.lock`. Installation `pnpm --frozen-lockfile` réussie.
Les premières tentatives avant installation ont échoué sur pytest absent et
pnpm global 11 ; aucun fichier produit n'avait encore été modifié.

- `make check` final : **PASS**, dont 44 tests Python, 45 tests web, gardes qualité,
  contrats, lint, typecheck et build Next.js. Log dans `make-check.txt`.
- Tests Observation : URL/camera, bbox invalides, contexte scientifique requis,
  paramètres API sans clés UI, démo/bbox dont zoom à l'intérieur d'une cellule,
  conservation indépendante risque/confiance/fraîcheur, absence de fallback,
  collections invalides et missing.
- E2E : carte réellement rendue, clic sur cellule et alternative tabulaire,
  retour navigateur, reload/deep link, caméra au clavier, couches, repli desktop,
  filtre modal mobile/focus/Échap, bottom sheet développable, requête live en
  loading puis stale, missing et error, bascule démo explicite.
- 1440×900, 1024×768 et 390×844 : captures PNG aux dimensions demandées,
  aucune dépendance réseau externe en démo, pas d'erreur JS ni débordement page.
- Axe : **0 violation** WCAG A/AA dans la feature Observation, aux trois tailles
  et en thèmes clair/sombre. `interaction-report.json` contient les six audits.
  Ce périmètre ne constitue pas une certification du shell entier.
- Bundle/client secrets : PASS ; budget gzip JS/CSS Next ~552 ko < 2 Mio.
  Ce budget existant exclut les assets publics ; worker/shared ~140 ko gzip
  additionnels, sans clé ni SDK Supabase dans la carte.

## Live réel et limites

Le contexte read-only de vérification hérité Task 05
(`production=wheat_soft`, `indicator=tmax_days_above`, `rule=demo-rule`,
`version=1.0`, `date=2026-07-01`, `bbox=-5,43,1,49`) renvoie actuellement
**HTTP 502 / UPSTREAM_UNAVAILABLE** via l'API locale, sans détails upstream
ni secret exposé. Aucun résultat live réel non vide ne peut donc être attesté.
Les interactions live automatisées utilisent des réponses API simulées,
identifiées comme telles dans le script, pas une validation scientifique.

La démo ne comporte qu'une cellule. Le fond est une géométrie de repérage,
sans parcelles, données administratives précises ou DROM. La recherche de
territoire métier, les séries, la comparaison et les autres couches relèvent
des workstreams suivants. L'identifiant de cellule est affiché tel que fourni.

L'audit complet du shell révèle le défaut hérité `label-content-name-mismatch`
du lien de marque Task 05. Le smoke navigateur Task 09 conserve des interactions
sur l'ancien emplacement ; adaptations demandées dans
`docs/codex/cross-workstream/06-request.md`, sans modifier leurs dossiers primaires.

Les mesures de fluidité dans `performance.json` proviennent de Chromium headless
avec WebGL logiciel SwiftShader, sur la fixture existante et 29 objets du fond.
Mesure isolée : **38,1 fps**, moyenne 26,25 ms, p95 50,1 ms sur 120 frames.
La cible reste 60 fps et n’est pas atteinte dans cet environnement ; ce résultat local n'est pas une garantie de performance
sur GPU ni une mesure sur 1 000 cellules. Ne pas présenter la cible comme atteinte
sans mesure sur le matériel cible.

## Vérification distante

Voir `REMOTE.md` pour le résultat GitHub/Vercel après push et création de PR draft.
Aucun merge, push sur main ni modification de configuration Vercel.
