# Vérification Task 02

Base : `origin/main` actualisé, `5c2426f7510693143b4494107bb647b32a1b65e4`.
Worktree : `/workspace/agriclimax-task02`, branche `codex/02-scientific-engine`.

Avant modification : cible `make check`, `pnpm-lock.yaml` et déclaration Hatch
`packages = ["src/agriclimax"]` présents. Premier `make check` : contrats OK,
arrêt pour pytest absent de l'environnement ; aucune réparation du dépôt Task 01.

Installation locale : `python -m venv .venv` puis
`.venv/bin/python -m pip install -r engine/requirements-dev.lock -e 'engine[dev]'`.
Installation web gelée avec pnpm 10.0.0 via npx, caches sous `/tmp` : réussie.
Le pnpm global 11 est incompatible avec le manifest ; aucun lockfile modifié.

Contrôles finaux :
- `make check PYTHON=.venv/bin/python` avec pnpm 10.0.0 dans PATH : validation
  des 3 schémas/exemples, GeoJSON et 4 YAML OK ; 28 tests Python OK ; lint web OK ;
  typecheck web OK ; 3 tests web OK ; build Next.js OK (compilation, vérification
  TypeScript, génération des pages et finalisation). Exit code 0. Voir `make-check.log`.
- `ruff check` sur les trois modules scientifiques affectés et le nouveau test : OK.
- `mypy --follow-imports=silent --ignore-missing-imports
  --disable-error-code=import-untyped` sur ces trois modules : OK. PyYAML n'a pas
  de stubs dans le lock existant ; vérification de cet import explicitement limitée.
- `git diff --check` : OK.
- Diagnostic du dernier échec : la commande directe `tsc --showConfig` produit
  du JSON valide, mais `runTypeScriptCli` de Next renvoie exitCode 0 avec stdout
  et stderr vides dans cet environnement. Un spawn Node minimal reproduit cette
  sortie vide ; la cause interne à l’environnement n’est pas établie.
- Correctif autorisé après validation de Task 02 : `apps/web/next.config.ts`
  définit `experimental.useTypeScriptCli: false`, option documentée par Next 16.4.0.
  Le build utilise ainsi l’API JavaScript de TypeScript 5.9.3 verrouillé au dépôt,
  sans dépendre du parsing CLI. La vérification de types reste active ;
  `ignoreBuildErrors` n’est pas utilisé. Le typecheck CLI séparé reste inchangé.
  Aucun changement de dépendance, lockfile ou tsconfig.
- Limite de maintenance : cette option Next est expérimentale ; une migration
  vers un TypeScript dépourvu d’API JavaScript devra réévaluer ce choix.

Les tests synthétiques vérifient fenêtres, interruption de séquences par les trous,
égalité au seuil, paramètres hors bornes, monotonicité GDD, percentiles bornés,
reproduction après rechargement de version et ordre inversé des observations.
Aucune validation agronomique revendiquée. Configuration/seuils et contrats inchangés.
Pas de changement UI, donc pas de capture responsive requise.

Fichiers : `apps/web/next.config.ts` (correctif de build autorisé), `engine/src/agriclimax/{science,evaluator,indicators}.py`,
`engine/tests/test_science.py`, `engine/README.md`, ce dossier de vérification.
Résumé PR : `PR_SUMMARY.md`. Aucun merge ni push.
