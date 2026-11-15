# Validation et coût mesuré

## Vérifications exécutées

| Vérification | Résultat |
| --- | --- |
| Suite web complète, deux workers | 95 fichiers passent, 8 ignorés ; 762 tests passent, 9 ignorés |
| Ciblage cartographie/miniatures/Journal/qualité avec génération visuelle | 54 tests passent, 2 ignorés |
| Régression normales/anomalies et seuil/masque | 9 tests passent |
| Python climat et couverture commune | 86 tests passent |
| Acquisition/Journal/stockage, `tests/task36` | 22 tests passent |
| Garde-fous qualité du dépôt | 28 tests passent |
| ESLint complet, TypeScript application et script de matrice | Réussite |
| Build Next de production | Réussite ; aucun déploiement |
| Ruff et mypy du transport roulant | Réussite |
| Contrats, structure YAML/JSON, secrets source | Réussite |
| MapLibre Chromium | 5 cas avant/après à 1440/768/390 px, sans erreur JS ni débordement |
| Stockage distant réel | Save/readback/restore ; pointeurs publiés inchangés |

Les logs de validation finaux sont copiés dans `evidence/checks/`. Les tests
ignorés du dépôt nécessitent des conditions externes explicites ; ils ne sont
pas présentés comme réussis. Le banc navigateur utilise les vraies valeurs et
les géométries gelées, sans appeler de pipeline éditorial. Le compteur navigateur
contrôle les contours interrogés dans la couche MapLibre rendue ; la matrice
contrôle aussi les identités complètes, dont six corses.

Les calculateurs et règles scientifiques sont conservés. Une correction de
métadonnée dans l'adaptateur `unified` transmet désormais la compatibilité des
normales déjà validées par l'agrégateur : sans elle, le nouveau rendu aurait grisé
à tort des références valides. Le test vérifie le maintien des valeurs, normale,
anomalie et leurs cibles de rendu, sans qualifier une référence nouvelle.

## Mesures et limites des coûts

- Dernier rejeu national complet : **282 348 lignes**, 556 140 comparaisons des
  résultats existants, environ **58,7 s** ici, matrice gzip **2 919 111 octets**.
  La mémoire maximale exacte figure dans `matrix-summary.json` ; ce coût inclut
  le rejeu hors ligne et les comparaisons répétées, pas une page utilisateur.
- Storage réel : un slot compressé **27 914 octets**, deux écritures (slot puis
  pointeur), 13 requêtes incluant les contrôles des archives publiées, **5,96 s**.
  Aucun appel fournisseur climatique ni OpenAI pour cette recette de reprise.
- Plafond distant du nouvel espace roulant : **16 781 312 octets** au total,
  indépendant du nombre d'exécutions. Les objets immuables COUV-03B préexistants
  ne sont ni purgés ni inclus dans ce nouveau plafond. La quota globale partagée
  du bucket doit être surveillée avec les autres usages ; ce plafond n'est pas
  une réservation fournisseur.
- La collecte COUV-03B antérieure avait mesuré ~12,2 Mo pour le transport source
  renouvelé. Ce chiffre est **réutilisé comme référence**, pas mesuré à nouveau
  dans COUV-04. Le canari courant n'a pas été réacquis pour gonfler les preuves.
- Aucun job Actions distant exécuté : durée facturable de l'installation et
  fiabilité des sept cycles quotidiens non mesurées. Le job proposé est borné à
  cinq minutes. Aucune facture ou tarif du compte n'est accessible ici : aucun
  montant monétaire exact ni coût nul de stockage/transfert n'est affirmé.

## Reproduction locale

Depuis la racine, avec les dépendances verrouillées Python dev/geo/climate/safran,
Node et le workspace pnpm installés :

```sh
node --import ./apps/web/node_modules/tsx/dist/loader.mjs scripts/couv04_matrix.ts
PYTHONPATH=engine/src:scripts python scripts/couv04_sim_matrix.py
PYTHONPATH=engine/src:scripts python -m unittest discover -s tests/task36 -v
PYTHONPATH=engine/src:scripts python -m pytest engine/tests/climate engine/tests/test_shared_coverage.py -q
cd apps/web
COUV04_EVIDENCE=1 node_modules/.bin/vitest run features/cartography/coverage-thumbnail.test.ts
node_modules/.bin/vitest run --maxWorkers=2
node_modules/.bin/eslint . --max-warnings 0
node_modules/.bin/next build
```

Navigateur, depuis la racine : `node tests/e2e/couv04.mjs` après installation
verrouillée de `tests/e2e`. Chromium local par défaut `/usr/bin/chromium`, autre
binaire via `CHROMIUM_EXECUTABLE`. Le script crée une route de test temporaire,
refuse d'écraser une route existante, démarre son serveur local et nettoie la
route et le serveur en sortie. Les PNG et SVG compressés des miniatures sont
reproduits par le test opt-in ; aucun serveur de test n'est livré en production.

Les commandes Storage de `ACTIVATION.md` écrivent seulement le namespace privé
candidat ; elles nécessitent les secrets serveur et un écrivain unique. Toutes
les autres commandes ci-dessus sont locales, sans publication ni activation.
