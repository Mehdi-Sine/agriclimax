# Validation utilisateur et reproductibilité

## Recette réelle

Chromium système, Playwright verrouillé par le projet, Next en **build de production
local**, API réellement appelées, MapLibre réellement rendu. Aucune interception
réseau ni valeur synthétique dans les recettes COUV-06. Les origines sont locales,
les lectures de stockage/RPC sont réelles. Il ne s'agit pas d'un déploiement Vercel
ni d'une mesure de latence serverless à froid.

La recette on garde les flags prévisionnels désactivés. La recette off reconstruit
le même code avec le flag historique désactivé et les bundles d'origine. Les
candidats du Journal restent visiblement « RECETTE », sans publication. Le texte et
les choix éditoriaux d'origine sont conservés ; seuls les identifiants des mêmes
cartes sont remappés dans la copie locale consultable pour tester leurs nouveaux
bundles. Ce remappage n'est jamais appliqué à une archive distante.

## Comptages après activation locale

| Carte / période testée | Entièrement colorées | Surfaces partiellement colorées | Grisées | Contours réels |
| --- | ---: | ---: | ---: | ---: |
| Température moyenne, 01/11 | 681 | 31 | 1 | 713 |
| Précipitations, 01/11 | 681 | 31 | 1 | 713 |
| Tmin ERA, 01/11 | 681 | 31 | 1 | 713 |
| Tmax ERA, 01/11 | 681 | 31 | 1 | 713 |
| THI multivariable, 01/11 | 0 | 0 | 713 | 713 |
| Édition : minimum des Tmin, 02–08/11 | 681 | 31 | 1 | 713 |
| Édition : température moyenne, 02–08/11 | 681 | 31 | 1 | 713 |
| Édition : pluie cumulée, 02–08/11 | 681 | 31 | 1 | 713 |
| Édition : jours de gel, 02–08/11 | 681 | 31 | 1 | 713 |
| Édition : GDD, 02–08/11 | 681 | 31 | 1 | 713 |

`renderedContourCount` provient de `queryRenderedFeatures` sur la couche de contours,
pas du seul nombre d'entrées JSON. Les nouveaux compteurs utilisent la même fonction
que le rendu. Les six PRA corses sont présentes dans les réponses et les contours.
Les valeurs des portions restent descriptives : elles ne deviennent pas des
estimations territoriales ou des données éligibles aux chiffres clés du Journal.

Le THI est gris parce que l'humidité historique qualifiée manque ; zéro de THI
n'est pas inventé. Crozon reste gris en ERA natif. Les 31 surfaces sous 90 %
utilisent les géométries qualifiées exactes, jamais le contour PRA redimensionné.
Les 36 portions qualifiées au-dessus de 90 % sont visuellement remplies, sans
changer leur statut scientifique `observed_partial`.

Le catalogue actif complet est interrogé sur 1/7/30 jours : **42 réponses HTTP
valides à 713 PRA**. Pour la fenêtre de trente jours choisie (03/10–01/11), les
valeurs ne sont pas rendues admissibles en forçant une continuité de sources ou
en ignorant des jours. Pour Tmoy, 712 PRA ont `incomplete_period` (14/30 jours observés sur le premier
cas), une `variable_unavailable`. Le résultat gris est conservé et documenté, pas présenté
comme une amélioration des données historiques elles-mêmes.

## Lecture avant / après

Dans le mode désactivé de l'explorateur, les quatre cartes climatiques ont 712
valeurs affichées sur le contour entier (67 hachurées) et une PRA grise ; les
hachures ne matérialisent pas l'emprise réelle. Le mode activé remplace cette
extension implicite par 681 remplissages entiers, 31 emprises exactes et une PRA
grise. Il ne crée aucune valeur numérique supplémentaire dans l'API dynamique.

Les cartes d'édition d'origine ont 645 remplissages entiers, zéro surface partielle
numérique et 68 grises. Le nouveau candidat conserve ces 645 valeurs et passe à
681 entières / 31 partielles / une grise grâce aux preuves ERA figées. Le THI
reste 713 grises dans les deux modes. Voir les compteurs bruts dans les JSON
avant/après ; « entièrement colorée » n'est pas synonyme de « support intégral ».

## Captures comparatives

Les captures sont celles des vraies pages, pas des illustrations générées.

| Parcours | Avant | Après |
| --- | --- | --- |
| Température moyenne | [avant](evidence/browser/before-1440-temperature.png) | [après](evidence/browser/after-1440-temperature.png) |
| Précipitations | [avant](evidence/browser/before-1440-rain.png) | [après](evidence/browser/after-1440-rain.png) |
| Tmin | [avant](evidence/browser/before-1440-temperature_min.png) | [après](evidence/browser/after-1440-temperature_min.png) |
| Tmax | [avant](evidence/browser/before-1440-temperature_max.png) | [après](evidence/browser/after-1440-temperature_max.png) |
| THI multivariable | [avant](evidence/browser/before-1440-thi.png) | [après](evidence/browser/after-1440-thi.png) |
| Carte d'édition, Tmoy | [avant](evidence/browser/before-edition-1440-temperature_mean.png) | [après](evidence/browser/after-edition-1440-temperature_mean.png) |
| Miniature Tmoy | [avant](evidence/browser/before-thumbnail-temperature_mean.webp) | [après](evidence/browser/after-thumbnail-temperature_mean.webp) |
| Journal / carrousel | [avant](evidence/browser/before-journal-1440.png) | [après](evidence/browser/after-journal-1440.png) |
| Mobile, température | [avant](evidence/browser/before-390-temperature.png) | [après](evidence/browser/after-390-temperature.png) |
| Bretagne, Plougastel | [avant](evidence/browser/before-pra-29101.png) | [après](evidence/browser/after-pra-29101.png) |
| Atlantique, Rochefort/Marennes | [avant](evidence/browser/before-pra-17111.png) | [après](evidence/browser/after-pra-17111.png) |
| Méditerranée, littoral Provence | [avant](evidence/browser/before-pra-13469.png) | [après](evidence/browser/after-pra-13469.png) |
| Corse, littoral Haute-Corse | [avant](evidence/browser/before-pra-2B258.png) | [après](evidence/browser/after-pra-2B258.png) |

Les rapports navigateur détaillent 1440/768/390 px, PRA contrôlées, nombres,
absence de débordement et erreurs JavaScript. Les liens du vrai carrousel sont
suivis vers l'interactif ; les cinq miniatures sont lues depuis la vraie route
HTTP et conservées avec leurs empreintes. Les archives existantes sont testées
séparément pour l'identité octet à octet des rasters, flag on/off. Les nouvelles
archives gardent aussi leur rendu quand le flag est retiré.

## Vérifications techniques

- Suite web finale : **792 tests réussis, 16 conditionnels ignorés**, 103 fichiers
  réussis. L'échec temporaire d'un mock incomplet du renderer a été corrigé ; suite
  générale finale verte. Le premier essai sandboxé bloquait les sous-processus
  Python/IPC ; l'exécution finale utilise le venv et l'accès réseau/socket autorisé.
- Python : **7 tests ciblés** collecteur/persistance réussis ; Ruff et Mypy strict
  des deux nouveaux scripts d'audit (dépendances historiques en suivi silencieux).
- TypeScript web et scripts COUV-06, ESLint, contrats, migrations forward-only,
  sécurité source/bundle et budget client passent. Aucun calculateur modifié.
- Builds production on/off réussis. Next a d'abord interrompu chaque nouvelle
  configuration pour signaler sa vulnérabilité existante ; les reprises réussies
  ne lèvent pas cette réserve de dépendance pour le déploiement.
- Nouveau bundle : mêmes résultats antérieurs, 335 valeurs descriptives ajoutées
  (67 × cinq cartes), relecture des mêmes entrées compactes = empreinte identique.
- Reprise distante SIM réelle, bucket privé, contrôles d'empreintes, pointeurs
  publics/candidats inchangés ; **zéro écriture distante et zéro appel OpenAI**.

## Commandes

Depuis la racine, avec Node/pnpm et le venv du projet :

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @agriclimax/web exec tsc --project ../../scripts/tsconfig.couv06.json
pnpm test
pnpm lint
PYTHONPATH=engine/src:scripts python -m pytest tests/task36/test_couv03_pipeline.py tests/task36/test_couv03b_checkpoint.py tests/task36/test_couv04_checkpoint.py -q
```

Audits sans acquisition météo ni écriture distante :

```sh
PYTHONPATH=engine/src:scripts python scripts/couv06_sim_audit.py --root work/couv06/era17/sim-candidate --output work/couv06/sim-audit.json
PYTHONPATH=engine/src:scripts python scripts/couv06_storage_audit.py --root work/couv06/recovery-new --output work/couv06/storage-audit.json
```

Le premier répertoire provient de l'artefact Actions 14291421424, sous-répertoire
`sim-candidate/` seulement. Le second doit être neuf. Ne pas publier ces payloads
privés dans Git. Les identifiants/empreintes de l'artefact sont dans AUDIT.md.

Recette d'édition locale depuis les entrées existantes, sans IA :

```sh
NODE_OPTIONS=--conditions=react-server pnpm --filter @agriclimax/web exec tsx ../../scripts/int01_maps.ts prepare 6e625f034fc43ff35021c71722766a768af71566be3edd7db58af6715ed0a2b0 --out ../../work/couv06/edition
NODE_OPTIONS=--conditions=react-server apps/web/node_modules/.bin/tsx scripts/couv06_edition_recipe.ts work/couv06/edition
```

Construire le web avec le flag historique true, puis lancer `next start` sur 3016
avec `PRA_NATIONAL_ENABLED=1`, les secrets serveur existants,
`AGRICLIMAX_MAP_PREVIEW_ENABLED=true` et
`AGRICLIMAX_MAP_PREVIEW_DIR=<racine absolue>/work/couv06/edition-after`.
Garder les flags COUV-04/05 false. Dans cet environnement Node 24, le transport
réseau a nécessité `NODE_USE_ENV_PROXY=1` ; conserver les variables proxy/CA fournies.

```sh
node tests/e2e/couv06.mjs
node tests/e2e/couv06-editions.mjs
node scripts/couv06_catalogue_audit.mjs
```

Arrêter le serveur, reconstruire avec le flag false, lancer `next start` avec
le répertoire `edition-before`, puis exécuter les deux scripts navigateur avec
`COUV06_LABEL=before`. Les scripts n'injectent pas de données dans les réponses.

Le répertoire `work/couv06/edition-after` est une recette **non publiable comme
remplacement de l'édition d'origine**. L'activation normale fige le support dans
un nouveau snapshot avant sa propre sélection éditoriale. Ne lancer aucune commande
`publish`, `publish-experimental`, génération IA ou workflow distant pour reproduire
ces contrôles de lecture/rendu.
