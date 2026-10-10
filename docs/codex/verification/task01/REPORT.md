# Task 01 — Foundation / Contracts : bilan

Branche : `codex/01-foundation-contracts`.

## Résultat et périmètre

Le starter est installable, les contrôles locaux sont opérationnels et la page de
fondation consomme une fixture locale explicitement fictive. Aucun workstream de
Wave 1 n'est commencé. Pas de carte métier, calcul de risque, ingestion, narration
IA, authentification, configuration Supabase/Vercel ou déploiement production.

## Modifications

- Racine : `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.gitignore`,
  `Makefile`, `README.md` : workspace, versions bornées, commandes et documentation.
- Python : `engine/pyproject.toml`, `engine/requirements-dev.lock`,
  `engine/tests/test_contracts.py` : découverte explicite du package `src/agriclimax`,
  installation editable sans `PYTHONPATH`, dépendances figées et tests de validation.
- Web : `apps/web/package.json`, `apps/web/tsconfig.json`,
  `apps/web/eslint.config.mjs`, `apps/web/AGENTS.md` (généré par Next.js),
  `apps/web/app/page.tsx` : lint réel compatible Next.js 16, typage sur checkout neuf,
  page minimale de démonstration. `next-env.d.ts` reste généré/ignoré.
- Web core : `apps/web/lib/repositories.ts`, `demo-repository.ts`, `map-adapter.ts`,
  `url-state.ts`, `foundation.test.ts` : interfaces, adapters locaux, copie des
  fixtures, filtrage du contexte et état URL canonique partagé.
- Validation : `scripts/check_contracts.py`, `fixtures/contracts/*.json`,
  `fixtures/demo-risk.geojson.json` : exemples V1 fictifs, validation JSON Schema,
  formats calendaires, validation structurelle YAML, références et marqueurs démo.
- Ce bilan et les captures desktop/mobile.

## Contrats consommés et gel V1

Les trois schémas existants sont consommés sans modification :
`risk-result.schema.json`, `map-feature.schema.json`, `watch-signal.schema.json`.
Les exemples sont placés dans `fixtures/contracts/` pour respecter la procédure
qui interdit une modification de `contracts/` sur cette branche.
L'adapter cartographique consomme la projection `map-feature`.
Les autres exemples constituent des tests d'échange, pas des fonctionnalités.

Aucun seuil ni formule scientifique n'a changé. Hazard, exposure, sensitivity,
risk et confidence restent distincts dans l'exemple de résultat. La règle démo
conserve sa version exacte `0.1.0`, son statut `exploratory`, la provenance fictive
et les flags de qualité. Les données ne sont jamais déclarées validées.

## Vérifications exécutées le 10 octobre 2026

Environnement : Node.js 24.19.0, pnpm 10.0.0, Python 3.12.14,
Next.js 16.4.0, React 19.3.0, TypeScript 5.9.3 (résolutions du lockfile).

| Commande / contrôle | Résultat |
| --- | --- |
| `pnpm install` | Réussi ; lockfile produit, pas d'erreur de peer dependency |
| `pnpm install --frozen-lockfile --offline` | Réussi depuis le store local |
| `python -m pip install -e 'engine[dev]'` | Réussi |
| Installation editable avec `engine/requirements-dev.lock`, puis `pip check` | Réussi, aucune dépendance cassée |
| Import editable depuis `/tmp`, `PYTHONPATH` supprimé | Réussi |
| `python -m pytest engine/tests` | 10 tests réussis |
| `python scripts/check_contracts.py` | 3 schémas/exemples, GeoJSON démo, 4 YAML validés |
| `pnpm lint` | Réussi, aucun warning accepté |
| `pnpm typecheck` | Réussi (`next typegen` puis `tsc --noEmit`) |
| `pnpm test` | 3 tests web réussis |
| `pnpm build` | Réussi, compilation et typage production |
| `make check`, sans `PYTHONPATH` | Réussi pour l'ensemble des contrôles |
| `pnpm dev --hostname 127.0.0.1` | Démarrage réussi sans credentials |
| Chromium 1440 × 900 et 390 × 844 | HTTP 200, label visible, aucun overflow, aucune requête externe |
| Filtre URL `production=dairy_cattle` | État vide explicite : 0 territoire fictif |
| `git diff --check` | Réussi |

Les tests négatifs rejettent dates impossibles, version de schéma incorrecte,
confusion confidence/risque, provenance vide, version de règle absente,
référence de configuration inconnue et statut scientifique invalide.
Les tests web couvrent la sérialisation canonique du contexte, le filtrage démo,
le label, l'adapter et l'isolation des mutations.

Captures inspectées : `task01-desktop.png`, `task01-mobile.png`.

## Particularités de cet environnement

Le pnpm préinstallé est 11.25.0 : les commandes ont été exécutées avec pnpm 10.0.0
via Corepack et un wrapper temporaire sous `work/`, car les scripts imbriqués
résolvaient initialement le pnpm global. Caches/store placés sous `/tmp`.
Les téléchargements ont utilisé l'accès réseau autorisé. Après installation,
les validators et la démo n'ont aucun besoin de connexion externe.
Le sandbox empêchait l'écoute locale et vidait stdout des processus Node enfants :
le build et les contrôles navigateur ont été exécutés hors du sandbox avec
l'autorisation de l'environnement. Aucun contournement ajouté au code du projet.
La télémétrie Next.js a été désactivée pour la vérification finale.

## Sécurité, migrations et limites

- Aucun secret ni service-role key ; aucune nouvelle dépendance Supabase navigateur.
- Aucune migration modifiée ou ajoutée, aucune connexion production configurée.
- Les trois schémas ont des objets volontairement peu contraints ; ce contrôle
  valide les contrats actuels, pas leur complétude scientifique.
- La validation YAML est structurelle et vérifie les références ; elle n'approuve
  pas les paramètres, ne calcule pas les classes et n'infère aucun statut.
- La copie JSON du GeoJSON est contrôlée par égalité stricte pour éviter la dérive.
- `compare` est transporté par l'URL ; aucun calcul comparatif n'est implémenté.
- UI volontairement minimale ; les compositions produit relèvent de Task 05.
- Dépendances pnpm verrouillées ; dépendances Python dev verrouillées, backend de
  build borné par major. Pas encore de matrice OS/versions Python ni de CI distante.
- pnpm signale ESLint 9 déprécié et ignore les scripts de build esbuild/unrs-resolver ;
  les binaires distribués permettent les tests et le build vérifiés. Ne pas changer
  de major sans vérifier la compatibilité avec eslint-config-next.

## Résumé PR

Titre : Foundation / Contracts V1 et démonstration locale sans secrets.

Cette modification rend le starter installable et vérifiable : workspace pnpm,
packaging Python editable, lint Next.js 16, validation hors ligne des contrats et
configs, état URL partagé et accès aux fixtures via un repository/adapters locaux.
Les schémas partagés, migrations et paramètres scientifiques sont inchangés.
Validation : 10 tests Python, 3 tests web, lint, typecheck, build, validation des
schemas/configs et contrôles navigateur desktop/mobile réussis. Les limites ci-dessus
restent explicites. Aucun déploiement ni PR distante n'a été réalisé.
