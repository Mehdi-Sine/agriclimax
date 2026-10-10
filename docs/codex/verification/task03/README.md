# Task 03 — vérification et résumé PR

Base : `origin/main` à `5c2426f`, contenant Task 01. Branche :
`codex/03-data-ingestion`. Aucun autre workstream commencé.

## Résumé PR

Le pipeline météo sépare acquisition via `WeatherProvider`, normalisation technique,
persistance via `ObservationRepository` et statistiques descriptives. Il permet
le rejeu d'une plage UTC inclusive, la mise à jour quotidienne et un dry-run sans
écriture. Le provider démo consomme des fixtures fictives ; le squelette France
exige une URL et un décodeur explicitement confirmés et ne simule pas une source.

Sources conservées hors Postgres par SHA-256, transactions SQLite par partition,
quarantaine des lots invalides et manifests progressifs permettent de diagnostiquer
et rejouer une panne. Les logs omettent messages d'exception, URLs et valeurs source.

- Contrats : trois schémas V1 existants lus et contrôlés, aucun modifié. Le modèle
  météo `internal-1` est interne à ingestion, pas un nouveau contrat inter-domaines.
- Migrations : aucune ; ni Supabase ni ses données modifiés.
- Science : règles et seuils inchangés. Percentiles descriptifs exploratoires,
  indépendants du moteur de risque ; méthode et période explicitement transportées.
- Sécurité : aucune variable Supabase consommée, aucun secret affiché/committé ;
  futurs headers France fournis par callback lisant l'environnement.
- Dépendance Task 04 : voir `docs/codex/cross-workstream/03-request.md`.

## Commandes et résultats

Python 3.12 ; installation editable avec `engine/requirements-dev.lock` : succès.

```sh
.venv/bin/python -m pytest engine/tests -q
# 26 passed (dont 16 cas ingestion)
.venv/bin/ruff check engine/src/agriclimax/ingestion engine/tests/ingestion scripts/ingest_weather.py
# All checks passed
.venv/bin/mypy --strict engine/src/agriclimax/ingestion scripts/ingest_weather.py
# Success: no issues found in 8 source files
.venv/bin/python scripts/check_contracts.py
# 3 schemas/examples, demo GeoJSON and 4 YAML files validated offline
.venv/bin/python scripts/ingest_weather.py --from 2025-01-01 --to 2025-01-02 --root work/task03-smoke --climatology
.venv/bin/python scripts/ingest_weather.py --from 2025-01-01 --to 2025-01-02 --root work/task03-smoke
# Second run: changed=false pour les deux dates ; complete + missing, stale
.venv/bin/python scripts/ingest_weather.py --daily --dry-run --root work/task03-dry
# missing explicite ; aucune écriture
```

Tests : UTC/unités/provenance, absence/partiel/invalidité/fraîcheur, doublons,
idempotence et correction de revision, quarantaine, panne et rejeu, dry-run,
corruption checksum, désactivation France, retry borné/404, téléchargement réussi/limite de taille,
échec de persistance isolé par date, enveloppe invalide, percentiles et exclusion
sans imputation. Pas de tests UI : aucun changement web. Workflow GitHub non exécuté
sur GitHub dans cette vérification ; ses commandes CLI sont exercées localement.

## Limites

- Une seule fixture datée ; les autres dates donnent `missing`. Le cron est
  explicitement fictif, pas une alimentation météo réelle.
- France : URL, format, licence, grille, couverture et credentials non confirmés.
  Configuration et parser doivent être revus avant activation. Pas de CLI France.
- SQLite est une référence locale transactionnelle, pas la persistance production.
  Cache GitHub Actions opportuniste : restauration non garantie, pas de garantie
  de durabilité. Task 04/intégration devra fournir DB et stockage objet durable.
- Reprise par rejeu explicite de la plage, pas d'ordonnanceur ni queue. Pas de
  retry des données invalides. France : 3 tentatives par défaut, délai 1 puis 2 s,
  maximum configurable 5, timeout 30 s et limite 10 Mo. Pas de streaming NetCDF.
- Percentiles sur les observations complètes de la période, par source/cellule/
  variable/unité. Pas de normale climatique saisonnière validée, pondération,
  grille spatiale ou minimum d'années inventé. Petite taille d'échantillon visible.
- Un lot invalidé conserve sa source brute, mais ne devient pas donnée canonique.
  Les enveloppes illisibles sont signalées `invalid` dans le manifest ; aucun lot
  canonique n'est créé. Un échec d'acquisition/persistance donne `error`.
