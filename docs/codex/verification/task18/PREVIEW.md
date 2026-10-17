# Preview Vercel — validation réelle

PR draft : https://github.com/Mehdi-Sine/agriclimax/pull/39
Branche : `codex/18-v02-integration`, base main 6e876b2.
Preview : https://agriclimax-git-codex-18-v02-integration-mehdi-sines-projects.vercel.app
Commit produit vérifié : be9e018594c9e3a5469649e3b9b264167063107f.
Reprise le 17 octobre 2026 ; aucune modification produit pendant cette reprise.

Le blocage HTTP 302 vers SSO observé le 16 octobre est levé : la variable
`VERCEL_AUTOMATION_BYPASS_SECRET` est présente et le GET avec l’en-tête
`x-vercel-protection-bypass` répond HTTP 200. Valeur jamais affichée ni archivée.
Aucune protection Vercel modifiée. Le helper de test limite l’en-tête à l’origine
HTTPS exacte ci-dessus et désactive le suivi automatique des redirections ;
les erreurs de requêtes privées masquent les détails susceptibles de contenir
les en-têtes. Tests de restriction de domaine et de redirection réussis.

## Résultats preview

- `live-risk.mjs` : 24 vues réelles, blé et bovins, carte → diagnostic → historique
  → veille, 1440/768/390 px. Contexte URL et retour arrière/avant conservés.
- Zoom/pan clavier, souris et tactile Chromium émulé ; aucun débordement horizontal.
  Axe : aucune violation des tags WCAG A/AA contrôlés sur main.
- Diagnostic : HTML initial, RSC explicite et scripts applicatifs déployés
  contrôlés ; champs privés et objets source bruts absents.
- `live-performance.mjs` : 24 réponses HTTP 200, quatre vues × deux productions
  × trois échantillons, station réellement publiée 29075001 ; source réelle,
  absence de champs privés et de credentials vérifiées.
- Live et démo séparés : source Météo-France réelle / fixture explicitement fictive.
- Dates et fraîcheur comparées au RPC DEV en lecture seule : fenêtre 10–16 octobre,
  calcul du 17 octobre 11:44:38 UTC, fraîcheur récente. Aucun run réussi inféré.

Preuves : `evidence/preview/`, `logs/preview/`, `screenshots/preview/`.
Ces observations du déploiement sont séparées des preuves DEV locales et
synthétiques du 16 octobre. Aucun corps HTML/RSC brut, HAR, trace réseau ou cookie
archivé. Les logs et artefacts ont été scannés contre les valeurs des secrets.

Le premier essai réseau nécessitait l’autorisation réseau de l’exécuteur. Un
premier audit a aussi rencontré HTTP 403 sur un script externe d’outillage Vercel ;
le scan de bundles cible désormais les scripts applicatifs `/_next/`, sans
présenter cet outil externe comme une défaillance produit. Ces essais incomplets
ne sont pas comptés dans le rapport navigateur final.

## Reproduction

Avec le secret déjà configuré dans l’environnement, jamais dans la commande :

```sh
E2E_BASE_URL=https://agriclimax-git-codex-18-v02-integration-mehdi-sines-projects.vercel.app E2E_LIVE_ARTIFACTS=work/task18/preview/browser NODE_USE_ENV_PROXY=1 node tests/e2e/live-risk.mjs
E2E_BASE_URL=https://agriclimax-git-codex-18-v02-integration-mehdi-sines-projects.vercel.app E2E_STATION=29075001 E2E_PERFORMANCE_ARTIFACTS=work/task18/preview/performance NODE_USE_ENV_PROXY=1 node tests/e2e/live-performance.mjs
node --test tests/e2e/preview-access.test.mjs
```

Aucune acquisition, écriture DEV, règle, privilège ou protection modifiés.
Voir les limites de navigateur et de mesure dans [LIMITS.md](LIMITS.md).
Checks du commit final à relever après push ; PR maintenue en draft, aucun merge.

## Compatibilité CI locale

Le premier check web du commit e6fa6be a révélé une redirection RSC locale 307
sur le serveur synthétique Next. Le helper interdit désormais le suivi seulement
lorsqu’il transmet effectivement le credential Vercel ; les requêtes locales
sans bypass conservent leur comportement initial. Test de régression ajouté.
Aucun affaiblissement de la restriction d’origine ni changement produit.
