# Rejeu local sans publication

Dépendances : celles verrouillées du dépôt (Python 3.12, dépendances dev/geo/climat/agriculture/opérationnelles, pnpm 10). Les commandes ci-dessous n'acquièrent aucune donnée météo, ne publient aucun objet et n'appellent pas OpenAI.

## Géométries encore inconnues

```bash
PYTHONPATH=engine/src:scripts python scripts/couv05c_unknowns.py \
  --evidence docs/codex/COUV-05/evidence --output work/couv05c-spatial
```

La matrice et les captures d'origine sont vérifiées par SHA. Le script réutilise les poids ARPEGE/IFS, reconstruit les dépendances variables/dates et limite les contrôles géométriques aux PRA précédemment inconnues. Les lignes non ciblées du producteur restent `geometry_verified=false` et ne doivent pas être certifiées par cette exécution ciblée.

## Valeurs et contrats sur l'archive exacte

Réutiliser le bucket privé existant en lecture seule ou un checkpoint déjà conservé. L'archive attendue et les chemins des 260 objets sont référencés dans le README. Ne pas reconstruire toutes les géométries déjà conservées, déplacer les pointeurs ou relancer un workflow climatique. Ne pas mettre les clés de stockage dans les fichiers de recette.

```bash
cd apps/web
COUV05_REAL_ARCHIVE=/chemin/archive-verifiee.json.gz \
COUV05_REAL_SIDECARS=/chemin/objets-prives-deja-conserves \
COUV05C_MATRIX_OUTPUT=/chemin/work/couv05c-numeric \
  pnpm exec vitest run lib/server/forecast-matrix.real.test.ts

COUV05_REAL_ARCHIVE=/chemin/archive-verifiee.json.gz \
COUV05_REAL_SIDECARS=/chemin/objets-prives-deja-conserves \
COUV05C_REPORT=/chemin/work/daily-numeric.json \
COUV05C_VISUAL_DIR=/chemin/du-depot/work/couv05c-visual \
  pnpm exec vitest run lib/server/forecast-composites.real.test.ts \
    lib/server/edition-forecast.real.test.ts features/cartography/forecast-fallback-real.test.ts
```

Les objets locaux doivent garder leurs chemins `forecast-masks/indexes`, `blobs` et `geometries`. Le test de miniature COUV-05B utilise aussi un `summary.json` local portant `spatial_index.sha256`. Les tests posent les flags uniquement dans leur processus et les retirent ensuite. Le rejeu exhaustif parcourt 38 fenêtres et attend exactement 758 632 résultats. Il écrit progressivement une matrice gzip ; les `support_id` dérivés se reconstruisent avec la recette exacte, son seuil, les entrées et `qualifyForecastRecipe`.

## Responsive des composants partagés

Après génération des trois fichiers `rain.json`, `temperature_mean.json` et `thi.json` ci-dessus dans `work/couv05c-visual`, installer les dépendances navigateur de `tests/e2e/package.json` et fournir Chromium (par défaut `/usr/bin/chromium`).

```bash
node tests/e2e/couv05c.mjs
```

Le script crée une route Next temporaire, lance un serveur local et supprime sa route à la fin. Les fichiers et captures restent sous `work/couv05c-browser`. Importer la feuille CSS du Journal dans la recette est nécessaire pour reproduire les conditions réelles de mise en page. Les contrôles portent sur le moteur partagé, `EditionMaps`, sa variante principale et le clavier du carrousel ; ils ne certifient pas les parcours complets du produit.
