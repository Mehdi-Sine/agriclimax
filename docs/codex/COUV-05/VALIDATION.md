# Validation COUV-05B et reproduction

## Résultats exécutés

| Contrôle | Résultat |
| --- | --- |
| Base initiale #97, tests d'origine rejoués isolément | 6 réussis |
| Suite Python complète | **535 réussis** ; 63 avertissements de dépendances, aucun échec |
| Tests natifs COUV-05 ciblés | **18 réussis** |
| Suite web complète | **775 réussis, 11 ignorés** ; les deux tests sur preuves réelles sont exécutés séparément avec chemins explicites |
| Archive réelle + lecteur serveur + miniatures | **2 réussis**, dont liaison des 713 supports ARPEGE réels ; valeurs inchangées |
| TypeScript | `tsc --noEmit` réussi |
| Ruff / mypy | Modules de masque/stockage typés ; contrôle strict du périmètre CI de 23 fichiers réussi |
| Qualité Python / Node | 28 + 9 tests réussis |
| Contrats | Validation hors ligne réussie |
| Secrets | Garde source et bundle exécutés ; aucune clé copiée dans les preuves |
| Build Next | Build local réussi ; aucun déploiement |
| Chromium | Miniature réelle et défaut de preuve à 1440, 768, 390 px : 713 contours avant/après, aucun débordement ni erreur navigateur |

La conservation privée des 260 objets est vérifiée par relecture exacte et par inventaire SQL, avec RLS active et aucune politique d’accès client. Les pointeurs publiés sont inchangés. La configuration anti-déploiement Vercel de cette branche est validée contre son schéma officiel.

Les logs conservés dans `evidence/tests/` précisent commandes et périmètre. Les dépendances manquantes de l'environnement préparé ont été installées localement selon les lockfiles du dépôt. Le test visuel réel, plus long que le délai unitaire de 5 s, dispose d'un délai explicite de 30 s ; les deux cas passent en environ 9,7 s au total.

## Campagne native réelle

Le checkpoint `t36-forecast-checkpoints`, artefact **14142890041**, run **43665661543**, contient les réponses WCS originales et le cache natif IFS. Téléchargement contrôlé à 100 Mio, extraction à 448 Mio. Aucune acquisition Météo-France/ECMWF ni workflow distant n'a été lancé.

`couv05_replay.py` emploie les capabilities **originales vérifiées**, un budget WCS de zéro requête/zéro octet, les reçus et SHA des champs, et `--offline-native` IFS. Les réductions originales ne servent qu'à la comparaison, jamais à inventer des cellules. Les sept journées WCS et sept journées IFS ont reproduit **49 910 lignes identiques**. Les empreintes des captures, poids, référence et archive sont conservées dans `provenance.json`.

La qualification vérifie les 713 géométries officielles, les intersections des cellules réellement qualifiées, leur aire EPSG:3035 et le rendu WGS84 issu de ces mêmes cellules. Une première tentative a montré des défauts topologiques de reprojection et le dépassement de la limite monolithique de 8 Mio. Les corrections sont explicites : intersection native directe en WGS84 contrôlée en aire contre EPSG:3035, puis fragments immuables dédupliqués. Aucune réparation des contours, aucun relèvement des limites. La campagne finale ne compte **aucun rejet géométrique**.

Le seuil d'affichage de 90 % reste exclusivement celui de `coverage.ts`. Les statuts de matrice qualifient la preuve spatiale ; ils ne modifient pas l'admissibilité scientifique des valeurs.

## Reproduction

Depuis la racine du dépôt, avec Python 3.12 et les dépendances verrouillées :

```bash
python -m pip install -r engine/requirements-dev.lock -r engine/requirements-geo.lock \
  -r engine/requirements-climate.lock -r engine/requirements-agriculture.lock \
  -r engine/requirements-operational.lock -e 'engine[dev]'
PYTHONPATH=engine/src:scripts python -m pytest engine/tests -q
PYTHONPATH=engine/src:scripts python -m mypy --strict --follow-imports=silent \
  engine/src/agriclimax/territories/forecast_masks.py \
  engine/src/agriclimax/territories/forecast_mask_store.py

# Uniquement si le checkpoint est déjà disponible localement :
PYTHONPATH=engine/src:scripts python scripts/couv05_replay.py \
  --checkpoint work/couv05-checkpoint.zip --output work/couv05-replay
PYTHONPATH=engine/src:scripts python scripts/couv05_masks.py \
  --root work/couv05-replay/replayed --run-date 2026-11-14 --geometry \
  --archive-sha256 ed93ab41472f81cec83a6039d8634133fa1feb42fe71d6513090d74d6985a398 \
  --output work/couv05-qualified
PYTHONPATH=engine/src:scripts python scripts/couv05_recipes.py \
  --captures work/couv05-replay/replayed --sidecars work/couv05-qualified \
  --output work/couv05-recipes
```

Les preuves utiles sont conservées dans la PR ; la reconstruction des géométries ne dépend donc pas de la rétention temporaire des GRIB/WCS GitHub :

```bash
# archive = lecture d'un objet immuable déjà publié ; aucun nouvel achat fournisseur.
PYTHONPATH=engine/src:scripts python scripts/couv05_rebuild.py \
  --evidence docs/codex/COUV-05/evidence --archive work/couv05-real-weather.json.gz \
  --output work/couv05-rebuilt
# Vérification bornée réellement exécutée : ajouter --limit 1.
# Le premier objet national AROME reconstruit est bit à bit identique.
# Le rebuild intégral depuis ce paquet compact reste à rejouer ; le cycle complet,
# lui, a été généré et contrôlé à partir du checkpoint natif original.
```

`native-index.json.gz` contient les identités et SHA attendus des 70 documents. Les captures ne contiennent que cellules attendues/qualifiées, métadonnées et empreintes ; les poids sont des preuves surfaciques nécessaires, pas des valeurs météo de grille.

Pour les preuves de miniatures :

```bash
cd apps/web
COUV05_REAL_ARCHIVE=/chemin/absolu/archive.json.gz \
COUV05_REAL_SIDECARS=/chemin/absolu/couv05-qualified \
COUV05_VISUAL_OUTPUT=/chemin/absolu/work/visual \
pnpm exec vitest run features/cartography/forecast-fallback-real.test.ts
```

Les PNG et rapports Chromium de `evidence/visual/` montrent le rendu réel ARPEGE et le cas de défaut de preuve volontairement injecté. Les SVG gzip proviennent du moteur de miniature de production. **Ils ne constituent pas une recette des cartes interactives, du Journal, du carrousel, d'un indicateur multivariable ou multijours.** Ces volets restent bloquants et ne sont pas remplacés par des fixtures synthétiques.
