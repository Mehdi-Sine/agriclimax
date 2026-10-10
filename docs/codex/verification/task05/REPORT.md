# Task 05 — Design system et shell AgriclimaX : validation finale

Branche : `codex/05-design-system`. Base actuelle :
`e3c14d64a421208833d8c18893e0053b31d9d078`, `main` distant contenant Tasks 01–04.
Task 05 uniquement ; aucune modification scientifique, ingestion ou migration.

## Mise à jour du worktree

État initial propre : commit UX/UI `da805b5`, parent `5c2426f` (Task 01).
Les 55 fichiers de Task 05 concernaient shell, primitives, styles, assets,
documentation, captures et types React DOM. Inventaire final : `task05-files.txt`.
Sauvegarde locale : `backup/task05-before-main-update`, conservant `da805b5`.

`git fetch origin main` a récupéré `e3c14d6` : merge Task 04, après Tasks 02 et 03.
Deux fichiers modifiés des deux côtés : `apps/web/package.json`, `pnpm-lock.yaml`.
Un seul conflit réel pendant le rebase : package.json. Résolution : conserver
ajv, ajv-formats et server-only de main, plus @types/react-dom de Task 05, sans
clé dupliquée. Le lockfile a fusionné automatiquement ; l'installation gelée
réussit. Aucun conflit dans les composants, tokens, styles ou assets.

Le commit Task 05 a été rebasé sur main. Les primitives, catalogue, styles et
assets validés restent identiques à la sauvegarde (voir `rebase-scope.json`).
La page et le shell ont reçu uniquement l'adaptation demo/live décrite ci-dessous.
L'identité locale a été configurée avant tout commit :
`Mehdi-Sine <medsine@acta.asso.fr>` ; le commit final utilise également cette identité
d'auteur. Ni la branche de sauvegarde ni main ne sont poussés/modifiés.

## Livrables UX/UI conservés

- Identité AgriclimaX, signature et descripteur centralisés dans BRAND.
- Tokens couleur source et alias clair/sombre ; aucune couleur littérale dans
  composants, app ou lib. Chiffres tabulaires et Manrope/Inter locales sous OFL.
- Primitives boutons, sélection/recherche, groupes d'onglets, infobulles,
  panneaux, sheets/drawers/dialogues avec focus contenu et retour au déclencheur.
- Risque, confiance et fraîcheur distincts, métriques avec unités, cartes
  scientifiques, sources/preuves et tous les états de données.
- Shell desktop/tablette/mobile ; mobile Carte/Veille, filtres en sheet,
  diagnostic plein écran ; veille repliable tablette.
- Catalogue `/design-system`, SVG originaux wordmark/symbole/icône/favicon,
  variantes monochromes et sombre, manifest descriptif et guides design.

La carte, le moteur de veille et le diagnostic métier des Tasks 06–08 ne sont pas
implémentés. Les illustrations, courbes et fiches existantes restent fictives.

## Frontière UI demo/live

Task 04 avait volontairement conservé le repository démo de Task 01 : son type
ne doit pas représenter des données réelles comme fictives. La nouvelle union
UI `ShellData` conserve cette séparation, sans modifier ce repository, le web core
existant, les contrats JSON ou le serveur Task 04.

Sans `mode=live`, `loadShellData` lit seulement la fixture locale. Avec
`mode=live`, il utilise côté serveur `SupabaseRiskRepository` et `parseMap`, déjà
livrés dans main. Production, indicateur, règle, version, date et bbox sont explicites :
aucune valeur scientifique par défaut. Les paramètres UI sont retirés avant la
validation API ; les paramètres scientifiques dupliqués restent rejetés.

Une collection live vide affiche missing (« Données absentes »), jamais no-risk.
Une erreur reste source-error avec message sûr, sans fallback vers la démo.
Une collection non vide indique uniquement son nombre de résultats et l'intégration
cartographique à venir dans Task 06 ; aucun risque, signal ou indicateur fictif n'est
substitué. Le contexte `mode/rule/version/bbox/zoom/limit` est conservé avec le contexte
canonique dans les filtres et la navigation. Series et territory sont vérifiés en
HTTP, sans créer leurs vues métier.

Exemple de lecture live vide, sans écriture :

```text
/?mode=live&production=wheat_soft&indicator=tmax_days_above&rule=demo-rule&version=1.0&date=2026-07-01&bbox=-5,43,1,49
```

`demo-rule/1.0` est seulement le filtre de vérification de la base DEV vide, pas
une règle scientifiquement approuvée ni une valeur implicite de l'application.

## Vérifications finales — 10 octobre 2026

Node 24.19.0, pnpm 10.0.0 via Corepack, Next 16.4.0, Python 3.12.14.
Wrapper pnpm temporaire sous work/bin pour les délégations de scripts racine ;
venv Python temporaire installé depuis le lockfile Task 01. Aucun outillage partagé
modifié. Log intégral : `make-check.log`.

| Contrôle | Résultat |
| --- | --- |
| `corepack pnpm install --frozen-lockfile` | Réussi après fusion du lockfile |
| `pnpm lint` via make check | Réussi, aucun warning |
| `pnpm typecheck` via make check | Réussi : typegen + TypeScript strict |
| `pnpm test` via make check | 33 tests web réussis |
| `pnpm build` via make check | Réussi ; shell et 3 routes API conservés |
| `make check PYTHON=/tmp/agriclimax-task05-venv/bin/python` | Réussi, toutes les étapes |
| Tests Python inclus dans make check | 44 réussis, science/ingestion compris |
| Validation des contrats incluse dans make check | 3 schémas/exemples, GeoJSON et 4 YAML valides |
| `python supabase/scripts/check_client_secrets.py` | 13 artefacts navigateur, aucune fuite |
| `python .../verify_browser.py` | Démo, 3 formats, clavier/focus, contexte URL, thèmes, reduced motion |
| `python .../verify_live.py` | 3 endpoints HTTP 200 et UI live vide aux 3 formats |
| `python .../verify_contrast.py` | 44 paires texte/focus/contrôles valides |
| `git diff --check` | Réussi |

Le `make check` contient les commandes racine demandées ; elles n'ont pas été
remplacées par un sous-ensemble. Tests web : 22 API, 3 URL/repository démo,
3 sémantiques UI, 5 nouveaux tests de frontière shell demo/live.

### Responsive et accessibilité

Build de production, Chromium : 1440×900, 1024×768 et 390×844. Démo locale et live
vide réel : aucun débordement horizontal ni erreur JavaScript. Les captures
`*-viewport.png` montrent le viewport exact, les captures sans suffixe la page
entière. Sont aussi conservés : dark, diagnostic, veille mobile, live vide aux
3 formats et symbole à 16/24/48 px. Captures inspectées visuellement.

Vérifiés : lien d'évitement, focus visible, Échap, boucle Tab, retour au déclencheur,
filtres et état absent, maintien des paramètres URL et retour navigateur, repli
tablette, navigation mobile, thème persisté et reduced motion. Navigation/filtres
live restent live, sans badge demo, signal fictif ou classe de risque sur base vide.

12 audits axe sur démo/catalogue clair/sombre + 3 audits sur UI live vide :
**zéro violation WCAG A/AA détectée**. Les points de contraste non évaluables
automatiquement (glyphes décoratifs/pseudo-élément) sont complétés par revue
visuelle et calcul des 44 paires de tokens. Texte critique noir : 4,78:1, couleur
source du risque inchangée. Résultats : `axe.json`, `contrast.json`, `live-http-ui.json`.
Ces contrôles ne constituent pas une certification WCAG ou un audit lecteur d'écran.

### Endpoints et Supabase DEV — lecture réelle

Serveur local démarré avec `NODE_USE_ENV_PROXY=1` conformément à la validation
Task 04, pour respecter le proxy hérité. Le démarrage initial sans cette option
renvoyait 502 ; aucune modification de repository/API n'a été nécessaire.
Pas de mock dans les vérifications HTTP/live ; aucun seed, SQL ou écriture distant.

| Endpoint | Réponse vérifiée |
| --- | --- |
| `/api/risks/map` | 200 ; FeatureCollection, features [], truncated false, limit 1000 |
| `/api/risks/series` | 200 ; [] |
| `/api/risks/territory` | 200 ; groups [], règle/version et bbox du contexte |

Toutes les réponses : no-store, aucune clé ou référence secrète. Requête invalide :
400/INVALID_QUERY, sans erreur serveur. Preuve : `live-http-ui.json`.

## Portée, sécurité et limites

Aucun diff par rapport à main dans `engine/`, `config/`, `scripts/`, `supabase/`,
`.github/`, `contracts/`, `apps/web/lib/server/` ou `apps/web/app/api/`.
Les migrations existantes ne sont ni modifiées ni rejouées. Les moteurs scientifique
et ingestion, leurs seuils, formules et fixtures restent ceux de main.
La lecture live utilise uniquement le repository server-only existant. Les clés
restent côté serveur ; aucun secret dans preuves, captures, commit ou bundles client.

Limites : données live non vides seulement comptées, restitution métier à venir ;
catalogue explicitement fictif ; pas de carte, analyse de veille, série métier,
service worker ou PWA hors ligne. Le format natif du champ date dépend du navigateur/OS.
Tests sous Chromium, sans appareils physiques ni matrice Safari/Firefox/lecteur
 d'écran. Une future CSP stricte devra autoriser le script statique de thème par
hash/nonce. Aucun merge ou déploiement.
