# Recette T32B — correction de la PR #61

## Périmètre et livraison

Même branche `codex/32-journal-editorial-ux`, base T32 `29469f5`. PR #61 maintenue en draft : https://github.com/Mehdi-Sine/agriclimax/pull/61

Preview : https://agriclimax-git-codex-32-journal-edi-b8193c-mehdi-sines-projects.vercel.app/journal

Aucun changement aux moteurs, règles, registres, contrats, schémas ou workflows scientifiques ; aucun changement de `main`, aucun merge ni production. L’endpoint de carte est un adaptateur de lecture du résultat vérifié existant. Les fichiers de preuve réécrits automatiquement par le test T31 sont exclus du diff.

## Tests et preuves

La suite complète avec `TASK31_REAL=1 TASK32B_REAL=1` comprend les tests unitaires synthétiques et les vérifications réelles en lecture seule, sans acquisition ni fixture servie au navigateur. Rapports : `evidence/task32b/`.

- Thèmes : gel/minimum, chaleur/maximum, pluie/maximum quotidien, séquence sèche/longueur homogène, THI exploratoire ; palettes exactes du registre, refus d’anomalie sans référence.
- Carte : les 713 identités officielles et la Corse, valeurs égales aux métriques nationales, zéro disponible distinct du null, couverture spatiale et temporelle incomplète, contrôle strict du cycle/période/empreinte, liens conservant le contexte.
- Dates : six tests de conventions françaises, périodes mensuelles/intermensuelles/interannuelles, UTC, texte factuel hérité et préservation des formats structurés.
- Chiffres : ratios documentés et diversité sans score, extrême plausible conservé dans les faits mais non promu comme moyenne, incohérences et valeurs impossibles, supports partiels et fenêtres insuffisantes, remplacement qualifié ou absence explicite.
- Journée calme : absence de sujet/aucune carte fictive dans un test de page réservé aux fixtures unitaires.
- API : rejet des requêtes non épinglées/invalides/ambiguës, erreur `503 no-store` sans détail privé ni appel de substitution ; ETag vérifié sur les cinq thèmes réels.

Les trois cycles réellement archivés relus sont le 7 novembre 2026 00 h UTC et le 6 novembre 00 h / 06 h UTC. Pour chacun, les cinq cartes sont comparées cellule par cellule à la veille ; les supports et sept journées portant les extrêmes sont relus dans le document météo vérifié. Rapport : `real-audit.json`. Aucune tendance observée n’en est déduite.

## Recette navigateur

Script : `apps/web/features/journal/ui/browser-task32b.mjs`, utilisant Chromium système et WebGL logiciel ANGLE/SwiftShader pour la reproductibilité du runtime cloud. Trois tailles : 1440×1000, 768×1024, 390×844.

Contrôles : carte WebGL prête avec 713 PRA, sujet correct, trois chiffres qualifiés, aucune date ISO dans la prose éditoriale visible, pas de débordement, sélection officielle et lien de détail épinglé au bon cycle/PRA, activation tactile explicite, aucune requête des 23 Mo bruts, une seule requête de géométrie et de données par montage, archive réellement différente et sélection précédente effacée, clavier, API conditionnelles et cycle absent explicite.

Une panne de transport de la carte est simulée par interruption réseau, sans substitution de valeurs météo : l’article réel et les faits restent visibles. Capture `map-unavailable.png`.

Captures dans `evidence/task32b/local/` et `preview/` : pour les trois formats, `*-hero.png`, `*-full.png`, `*-front-page.png`, `*-pra-selected.png`, `*-archived.png`. Le territoire sélectionné est celui du minimum réel lorsque le sujet est le gel, pas une donnée de démonstration.

## Vérifications visuelles

La carte montre les limites et les contrastes des PRA à l’intérieur des régions, avec des couleurs froides graduées pour le gel. La légende exprime des °C, tandis que le graphique régional reste un dénombrement avec dénominateurs. Le nom officiel et la région figurent dans la sélection. Le titre et le chapeau restent dominants, les chiffres ont des intitulés territoriaux explicites, les preuves et leurs réserves sont à la demande. La carte reste indépendante du reste de l’article en cas d’échec.

## Performances et limites

Avant T32B : SVG régional sans données PRA, environ 190 408 octets JS reçus ; budget global JS/CSS 632 286 octets gzip. Après : MapLibre différé et vrais contours PRA ; la géométrie source passe de 23 818 871 octets bruts / 9 710 368 gzip à 2 549 501 / 705 590 gzip. Les valeurs ne sont pas simplifiées. Le navigateur local reçoit environ 698 Ko compressés de géométrie ; aucune nouvelle requête lors des sélections. Le payload de carte contient un seul phénomène et son dictionnaire de preuves.

La carte interactive coûte environ 300 Ko de JavaScript supplémentaires reçus par rapport au SVG. Le budget global du produit augmente d’environ 16 Ko gzip, car MapLibre existait déjà parmi les chunks du produit. Ce coût n’est pas masqué : la carte est différée, les contours sont statiques et mis en cache, les chiffres sont vérifiés dans une frontière Suspense séparée.

Les temps sont des mesures de laboratoire, sans bridage réseau, avec une latence variable d’accès aux archives et un rendu WebGL logiciel. Le premier rapport avant séparation du chargement des chiffres est conservé sous `local/report-pre-streaming.json` (apparition de carte 3,76–9,12 s selon cache/concurrence). Le rapport final mesure séparément l’arrivée du titre et celle de la carte ; ces nombres ne sont pas des percentiles terrain. Le rendu titre/chapeau peut précéder la scène interactive.

La recette Preview passe par `protectTask30Preview` existant : Node respecte le proxy et la chaîne TLS configurés, aucune désactivation de TLS. Les tailles distantes sont celles des corps décodés par ce relais, et les timings incluent son coût ; le poids compressé doit être lu dans la mesure locale native.

Réserves : indicateurs météorologiques exploratoires, extrêmes échantillonnés, représentativité terrestre de certaines sources non qualifiée, altitude non disponible, absence de référence d’anomalie et de série temporelle comparable, simplification des détails littoraux pour l’affichage national. Aucune archive réelle sans événement n’est identifiée dans les trois cycles disponibles ; ce cas est testé uniquement en unitaire. En cas de WebGL indisponible, la recherche clavier et les données textuelles restent disponibles.

## Reproduction

Avec pnpm 10 et les variables serveur déjà configurées :

```sh
TASK31_REAL=1 TASK32B_REAL=1 NODE_USE_ENV_PROXY=1 pnpm --filter @agriclimax/web test
pnpm --filter @agriclimax/web typecheck
pnpm --filter @agriclimax/web lint
pnpm --filter @agriclimax/web build
pnpm check-contracts
pnpm check-security
pnpm check-bundle
pnpm check-migrations
pnpm check-budget
pnpm test-quality
```

Installer les dépendances isolées de `tests/e2e` comme dans T32 ; serveur de build démarré, puis `TASK32B_ORIGIN=http://localhost:3000 NODE_USE_ENV_PROXY=1 node apps/web/features/journal/ui/browser-task32b.mjs`. `TASK32B_OUTPUT` et `TASK32B_COMMIT` contrôlent le dossier et la référence du rapport. L’ancien `browser.mjs` reste une entrée de compatibilité vers les nouveaux contrôles.

## Résultats locaux finaux

**377 tests réussis sur 47 fichiers**, avec les deux lectures réelles activées. Build, typecheck, lint, contrats, sécurité source/bundle, migrations et tests qualité réussis. Audit des dépendances de production : aucune vulnérabilité connue. Budget global JS/CSS : **648 920 octets gzip**, limite 2 097 152. **58 contrôles navigateur réussis**, aucune erreur JavaScript ni console.

| Format | Titre visible (sonde après DOMContentLoaded) | LCP | Carte prête | JS reçu |
| --- | ---: | ---: | ---: | ---: |
| desktop | 2554 ms | 2096 ms | 5130 ms | 490688 octets |
| tablet | 1596 ms | 1552 ms | 4540 ms | 490688 octets |
| mobile | 1413 ms | 1404 ms | 4385 ms | 490688 octets |

Le délai de carte comprend le chargement de ses données, le scroll de recette si nécessaire et le rendu logiciel MapLibre. Il est distinct du rendu éditorial. Le titre peut précéder la scène interactive ; les chiffres possèdent leur propre bloc de chargement. La silhouette de France de fond du composant existant est aussi chargée (~328 Ko bruts) ; aucune requête de la géométrie PRA brute de 23 Mo.

## Preview vérifiée

Commit produit **ba65e67** : **58 contrôles réussis**, aucune erreur JavaScript ni console dans les parcours normaux. Cinq thèmes API comparés aux valeurs réelles de la veille, 713 PRA sur chaque carte, trois formats, sélection du minimum réel, cycle archivé et panne réseau de la couche. Captures et rapport dans `evidence/task32b/preview/`.

| Format | Titre visible (sonde) | LCP avec relais cloud | Carte prête avec relais |
| --- | ---: | ---: | ---: |
| desktop | 5748 ms | 5740 ms | 9825 ms |
| tablet | 2114 ms | 2124 ms | 5134 ms |
| mobile | 2012 ms | 2012 ms | 5400 ms |

Ces mesures distantes incluent les fonctions Vercel à froid/chaud, le relais HTTP de recette et le rendu logiciel. Le premier affichage est sensiblement plus lent que les suivants ; ce coût reste une réserve de performance à suivre en conditions réelles. Les valeurs compressées natives restent celles du tableau local. Les commits de preuve ultérieurs ne modifient pas le code du produit.
