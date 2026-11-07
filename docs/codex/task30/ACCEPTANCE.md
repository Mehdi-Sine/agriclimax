# Recette Task 30 — 7 novembre 2026

PR draft : https://github.com/Mehdi-Sine/agriclimax/pull/58

Preview : https://agriclimax-git-codex-30-national-ag-e0481e-mehdi-sines-projects.vercel.app/veille

## Données réellement restituées

Cycle du **7 novembre 2026 à 00:00 UTC**, acquisition 09:32:46 UTC, échéances **8–14 novembre**. La date de publication n’est pas exposée ; aucune date n’est inventée.

| Phénomène | PRA au critère / évaluables | Autres états |
|---|---:|---|
| Chaleur, Tmax >25 °C | 0 / 713 | aucun événement réel de chaleur fabriqué |
| Gel météorologique, Tmin <0 °C | 296 / 713 | extrêmes échantillonnés, sans dommage inféré |
| Pluie quotidienne >20 mm | 117 / 713 | maximum quotidien, pas cumul de sept jours |
| Séquence homogène ≥3 jours <1 mm/j | 63 / 713 | ruptures source/run non jointes |
| THI synthétique >72 | 0 / 77 | 634 insuffisantes, 2 indisponibles |

Dernière réanalyse publiée accessible : **31 octobre 2026**, explicitement retardée. Sur les deux variables température moyenne et précipitation, **1 290 anomalies natives calculables sur 1 426 lignes**, avec 30/30 années et couverture complète ; les 136 autres ne reçoivent aucune anomalie. Crozon reste NULL dans cette lecture ; sa reconstruction est accessible séparément dans Analyse.

Les résultats complets, versions et empreintes sont dans `evidence/local/api-report.json` et `evidence/preview/api-report.json`. Ces preuves sont des résultats de lecture, pas des nouvelles acquisitions.

## Vérifications scientifiques et temporelles

`tests/e2e/task30-verify-api.mjs` vérifie indépendamment maximum thermique, minimum thermique, pluie quotidienne maximale et séquence sèche sur Beauce, une PRA littorale méditerranéenne, Crozon et une PRA corse. Il compare les anomalies disponibles à la soustraction des valeurs et références homologues. **1 308 contrôles** avec vérification HTTP 304 sur la version finale du lecteur.

Comparaison réelle de cycles : le 6 novembre à 06:00 UTC et le 7 novembre à 00:00 UTC changent d’identité, de période, de couverture et d’événements. Le premier comporte 273 PRA au critère gel, 92 au critère pluie sur 519 évaluables, et 15 au critère de séquence sèche sur 519 évaluables. Les 194 PRA non évaluables pour ces pluies ne deviennent jamais des absences de phénomène.

Le cycle archivé **6 novembre à 00:00 UTC** est aussi ouvert dans l’interface et effectivement marqué ancien (>36 h). Le 5 novembre n’est pas présent dans le catalogue ; le test utilise un cycle réellement conservé. Les synthèses archivées sont relues à la demande, sans altérer le cycle courant.

Les cas unitaires de chaleur, références absentes, NULL, doublons et ruptures de provenance sont explicitement synthétiques dans les tests. Ils n’alimentent aucune Preview.

## Recette UX réelle

- `task30-real.mjs` : 21 contrôles desktop 1440 px, tablette 768 px et mobile 390 px ; 713 contours, pluie bleue, événement réel, sélection PRA, conservation du contexte dans l’URL, retour depuis Analyse, aide ciblée, clavier et absence de débordement horizontal.
- `task30-history.mjs` : huit contrôles de lecture thermique centrée sur zéro, écart de pluie sec/neutre/bleu, référence absente, ancien cycle réel, Crozon reconstitué et absence d’erreur applicative.
- `task30-loading.mjs` : sept contrôles isolés de latence/échec simulés, conservation du titre précédent, commit groupé titre/légende/valeurs, réponse concurrente ignorée, arrêt du chargement sur erreur, reprise possible et réduction de mouvement. Ces simulations sont marquées `simulated: true` et séparées des preuves réelles.
- `task24.mjs` : non-régression des trois espaces, même canvas MapLibre, clic/survol réels, fiche et infobulle cohérentes, retour navigateur, contrôles de période, NULL de Crozon, support partiel et tailles d’écran. La lecture absolue est maintenant demandée explicitement dans ce test, puisque l’historique thermique s’ouvre par défaut en anomalie.

Captures et rapports : `evidence/local/`, `evidence/preview/`, `evidence/history/`, `evidence/preview-history/`, `evidence/loading/`. Les rapports finaux portent le commit testé lorsqu’il est fourni à la commande. Les premiers essais ont révélé une course de rendu MapLibre et une attente de navigation trop précoce ; les rapports conservés correspondent aux reprises corrigées.

## Accessibilité ciblée

`python scripts/quality/task30_cartography.py` vérifie les contrastes de texte clair/sombre (≥4,5:1), les bordures de contrôle (≥3:1) et la distinction des classes adjacentes sous simulations sévères de protanopie, deutéranopie et tritanopie. Résultats : `evidence/accessibility.json`. Les légendes sont numériques ; les sélecteurs PRA permettent une exploration au clavier. Ce contrôle ciblé ne constitue pas une certification WCAG complète.

## Performance mesurée

Réponse nationale finale ≈668 ko, contre 4,24 Mo avant déduplication des preuves. Calcul local du cycle du 7 novembre : environ 0,95 s ; API froide locale 4,60 s, chaude 85 ms dans la mesure consignée. Revalidation identique : HTTP 304 sans corps.

Première recette Preview : API froide 4,0 s, chaude 0,50 s ; carte prête en 13,3 s desktop, 6,5 s tablette, 6,1 s mobile. Ces mesures intègrent le navigateur logiciel de test et les caches de cette exécution ; elles ne constituent pas des objectifs garantis. Les mesures finales sont conservées dans les rapports JSON. La synthèse textuelle apparaît avant la fin du rendu cartographique.

Bundle client complet : environ **630 ko gzip**, sous le budget existant de 2 Mio. Aucun stockage de grille supplémentaire, aucune acquisition relancée, aucune dépendance produit ajoutée.

## Reproduction

Utiliser pnpm 10 comme dans le dépôt, puis :

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
python scripts/task30_watch_geography.py
python scripts/quality/task30_cartography.py
python scripts/quality/budget.py
python scripts/quality/security.py --bundle apps/web/.next/static
python supabase/scripts/check_client_secrets.py
```

Avec un serveur local activant les lecteurs réels, ou la Preview autorisée :

```sh
TASK30_ORIGIN=http://localhost:3010 node tests/e2e/task30-verify-api.mjs
TASK30_ORIGIN=http://localhost:3010 node tests/e2e/task30-real.mjs
TASK30_ORIGIN=http://localhost:3010 node tests/e2e/task30-history.mjs
TASK30_ORIGIN=http://localhost:3010 node tests/e2e/task30-loading.mjs
```

Dans l’environnement cloud géré, Node 24 utilise `NODE_USE_ENV_PROXY=1` pour les lectures HTTPS ; les scripts de Preview limitent la clé de contournement à l’origine Vercel sélectionnée et ne suivent pas les redirections avec cette clé. Les valeurs secrètes ne sont jamais inscrites dans les livrables.

## Clôture de recette Preview

Sur le code applicatif `314dbbb`, les rapports `preview/report.json`, `preview/api-report.json` et `preview-loading/report.json` passent respectivement **21**, **1 308** et **7** contrôles. Le dernier scénario de chargement est aussi exécuté dans la Preview, avec lenteur et échec explicitement simulés, distincts des résultats nationaux réels. La synthèse et ses événements restent issus des archives vérifiées. `evidence/verification.json` récapitule les contrôles locaux ; le résultat de CI complète reste consultable directement dans la PR #58, sur son dernier commit.
