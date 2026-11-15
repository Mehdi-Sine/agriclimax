# COUV-05 — Validation reproductible et preuves manquantes

## Exécuté hors dépôt de production

- `python -m py_compile` du module de calcul et du script candidat : OK en environnement de travail isolé.
- `PYTHONPATH=engine/src python -m pytest engine/tests/test_forecast_masks.py -q` sur la copie locale du moteur : **6 tests synthétiques réussis** (PRA fictives dont une fragmentée, preuve absente/inconnue, géométrie partielle, provenance, intersection).
- Ces tests vérifient des invariants, **pas les 713 géométries officielles ni un cycle opérationnel réel**. Les modifications de scripts d'acquisition dans le dépôt n'ont pas été rejouées en conditions fournisseur.

## À exécuter dans l'environnement verrouillé du dépôt

```bash
PYTHONPATH=engine/src python -m pytest engine/tests/test_forecast_masks.py -q
PYTHONPATH=engine/src:scripts python -m ruff check engine/src/agriclimax/territories/forecast_masks.py scripts/couv05_masks.py
PYTHONPATH=engine/src:scripts python -m mypy engine/src/agriclimax/territories/forecast_masks.py
# Recette source explicite et non publiée : déclenche les acquisitions payantes,
# ne pas exécuter sans budget et approbation distincte.
# COUV05_CAPTURE_NATIVE_MASKS=true PYTHONPATH=engine/src:scripts python scripts/national_weather.py \
#   --mode national --run-date YYYY-MM-DD --execute --national-authorized --root work/couv05
# PYTHONPATH=engine/src:scripts python scripts/couv05_masks.py \
#   --root work/couv05/cycles/YYYYMMDDT00 --run-date YYYY-MM-DD \
#   --output work/couv05/evidence --geometry
```

Aucun de ces jobs distant / fournisseurs, ni des suites `pnpm`/navigateur MapLibre, n'a été exécuté dans cette PR.

## Matrice à produire après vraie capture

Matrice cible un cycle : AROME 3 jours, ARPEGE 4 jours, IFS 7 jours × 5 variables × **713 PRA**, soit **49 910 lignes** pour une fenêtre de cycles à 00 UTC. La matrice du script sera produite depuis les preuves capturées ; elle **n'existe pas encore** dans cette PR, et ces 49 910 lignes constituent une dimension théorique, **pas des supports validés**. Sur des cycles historiques sans capture, le statut de support est `unknown` et non `absent`.

La matrice doit ensuite s'étendre aux indicateurs actifs et à AGRO-03 (multi-variables et multi-jours) sans concaténer arbitrairement les cycles sélectionnés.

## Comparaisons avant/après encore requises

- Contrôler 713 contours MapLibre pour desktop (1440px), tablette (768px), mobile (390px) avec mêmes données/cycle/palette.
- Comparer côte Atlantique, Manche, Méditerranée, Bretagne, péninsules et six PRA corses ; tester vraie fraction voisine du seuil 90 %, 0 %, 0–90 %, inconnue, valeur agrégée nulle.
- Photographier et faire comparer cartes interactives, miniatures PNG/SVG, carte dynamique du Journal, future recette AGRO-03. Les **captures comparatives ne sont pas disponibles** dans cette livraison ; aucune image synthétique n'est substituée à une preuve réelle.
- Vérifier `support_id` unique, archive immuable, coûts et régression non-réédition des anciennes éditions.

Verdict provisoire : **NO-GO pour activation**, jusqu'à la totalité des contrôles ci-dessus et publication explicite de la preuve, sans réécriture d'archive ancienne.
