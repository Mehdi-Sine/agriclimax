# Stabilisation de Quality / web-demo

## Diagnostic

Sur le commit `058b306`, le run [43033134181](https://github.com/Mehdi-Sine/agriclimax/actions/runs/43033134181), job [130580667715](https://github.com/Mehdi-Sine/agriclimax/actions/runs/43033134181/job/130580667715), échoue dans `playwright install --with-deps chromium`, avant les tests navigateur. Les logs montrent Ubuntu `resolute` derrière `ubuntu-latest` et des erreurs `Temporary failure resolving` sur `azure.archive.ubuntu.com`, `archive.ubuntu.com` et `security.ubuntu.com`. APT tente encore de récupérer neuf paquets, surtout des polices, puis sort avec le code 100. Ce n’est pas une assertion de test produit.

## Correction autorisée

La demande complémentaire autorise une modification du seul environnement de CI navigateur. Frontières : job `web-demo`, vérification du runtime, gardes de compatibilité et documentation. Aucun fichier UX, contrat scientifique, moteur, donnée, workflow de production ou dépendance produit modifié.

Le job utilise Ubuntu 24.04 comme hôte et le conteneur officiel :

```text
mcr.microsoft.com/playwright:v1.62.1-noble@sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e
```

Le digest du manifeste multiarchitecture a été vérifié auprès de MCR le 11 novembre 2026. L’image contient navigateurs, bibliothèques système et polices ; la bibliothèque JavaScript est toujours installée séparément par `npm ci --prefix tests/e2e --ignore-scripts` depuis le lockfile existant. `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` sélectionne les binaires de l’image. Aucun `apt`, `install-deps`, `--with-deps` ou téléchargement de navigateur au démarrage du job. Les téléchargements de l’image et des dépendances npm restent nécessaires et leurs erreurs restent bloquantes.

Le shell Bash est explicite pour conserver le comportement des étapes du runner. `--ipc=host` suit la recommandation Playwright pour éviter l’épuisement de mémoire partagée de Chromium ; les pages testées sont celles du serveur de recette local.

`scripts/quality/playwright-runtime.mjs` compare la version réellement installée à `/ms-playwright/.docker-info`, vérifie le chemin du binaire, lance Chromium et contrôle une page locale. Le binaire effectivement testé est ensuite transmis aux scripts existants par `CHROMIUM_EXECUTABLE` via `GITHUB_ENV`, sans chemin système imposé. Il écrit `browser-runtime.json` dans l’artefact `demo-browser-report`. Toute incompatibilité ou erreur de lancement fait échouer le job. Les huit scripts navigateur et le smoke existants sont conservés et bloquants, sans condition de saut ni `continue-on-error`.

Les tests `tests/quality/test_browser_runtime.py` vérifient la concordance image/package/lockfile et empêchent une mise à jour isolée de Playwright ou la réintroduction d’une installation système. Le lancement réel dans le conteneur et les suites complètes restent les preuves d’exécution, distinctes de ces gardes statiques.

## Maintenance et reproduction

Lors d’une mise à jour Playwright, modifier ensemble `tests/e2e/package.json`, son lockfile et le tag/digest officiel dans `quality.yml`. Vérifier le digest MCR, garder la même distribution prise en charge ou revoir explicitement le changement de distribution. Relancer les gardes, le lancement réel puis tous les tests navigateur. Une PR Dependabot isolée doit être complétée avant fusion ; ne pas contourner le garde de versions.

Pour reproduire avec Docker depuis la racine du dépôt, dans un checkout de test jetable :

```sh
docker run --rm --ipc=host \
  -v "$PWD:/repo" -w /repo \
  -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
  mcr.microsoft.com/playwright:v1.62.1-noble@sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e \
  bash -euc 'npm ci --prefix tests/e2e --ignore-scripts; node scripts/quality/playwright-runtime.mjs'
```

Cette commande vérifie seulement le runtime. Le job CI installe aussi le projet avec pnpm 10/Node 22, construit le site, démarre le serveur et exécute tous les parcours. Son artefact contient le reçu de runtime et les résultats/captures des scripts. Aucun secret de production ni appel OpenAI nécessaire.

## Vérification

Gardes de compatibilité et validation YAML exécutés localement. Le premier run corrigé [43040334243](https://github.com/Mehdi-Sine/agriclimax/actions/runs/43040334243) a validé l’image, le lancement de Chromium 151.0.7922.34 et les parcours task24, task35, démo/UX-01. Il a ensuite révélé que `territories.mjs` imposait encore `/usr/bin/chromium`. Le contrôle de runtime transmet désormais son chemin vérifié à tous les scripts qui utilisent déjà `CHROMIUM_EXECUTABLE`. Les assertions de test ne sont pas modifiées ; les captures territoriales rejoignent aussi l’artefact commun.

L’exécution suivante doit confirmer la totalité des parcours. Les preuves distantes sont liées dans le descriptif de la PR ; une image téléchargeable ou un seul lancement de navigateur ne suffisent pas.

Retour arrière : revert du commit CI sur une branche et PR de revue ; aucun rollback de données. Le revert réintroduirait la dépendance APT fautive, donc préférer corriger l’image/version et vérifier le job avant fusion. PR #80 conservée en draft et non fusionnée. Le statut scientifique global AGRO-UX-01 reste PARTIAL indépendamment de cette réparation technique.
