# Exécution bornée

Depuis le dépôt, avec l'environnement Python installé selon les lockfiles et les
secrets serveur habituels, sans écrire leurs valeurs dans un fichier ou un log.

Plan sans accès réseau ni écriture de données :

```sh
python scripts/backfill_france.py
```

Premier backfill historique : une tuile, une date, cache seulement :

```sh
python scripts/backfill_france.py --execute --from 1991-09-01 --to 1991-09-01 \
  --dataset-version task15-france-1991-v1 --max-tiles 1 --max-rows 200 \
  --root work/france
```

Répéter la même commande pour avancer d'une tuile. Les checkpoints sont séparés
par jeu/version/période/masque/destination. Ils ne sont écrits qu'après l'archive
et la persistance réussies ; le SHA256 de l'archive est revérifié à la reprise.
Un crash avant checkpoint rejoue les mêmes sources vérifiées. Les clés SQL
absorbent le rejeu. Une source partielle laisse la tuile non terminée et arrête le
lot : utiliser `--refresh-source` pour le cache source concerné, sans supprimer
un reçu sans conserver sa provenance. Ne pas déclarer terminée une maille sans
données. Le statut `processing` signifie qu'il reste des tuiles ou de la donnée
partielle ; il n'est pas une couverture nationale acquise.

Pour les trente derniers jours seulement, ajouter `--persist-supabase`. Ne pas
changer les budgets pour dépasser les plafonds ; examiner les métriques puis
relancer explicitement un petit lot. Le cache local doit être durable ou mirrorré
avant un usage planifié. Aucun miroir public n'est créé par ces commandes.

Références compactes, par petites partitions (32 Mio décodés, 100 000 lignes max) :

```sh
python scripts/prepare_france_references.py --input work/tile.json.gz \
  --output work/tile-references.json
```

L'entrée est une archive gzip du runner ou une liste de lignes compactes.
Cela prépare les références présentes, sans remplir les années ni cellules
absentes. Pas d'INSERT SQL national ni de normale inventée.

Catalogue officiel puis petit lot station, avec la même sélection en reprise :

```sh
python scripts/select_france_stations.py --limit 96 --output work/france-stations.json
python scripts/backfill_france_stations.py --catalogue work/france-stations.json \
  --from 2026-09-01 --to 2026-09-01 --max-chunks 1
```

La même commande avance au lot suivant. Les lots partiels Task11 sont conservés
avec leurs nulls et flags ; un checkpoint atteste un lot traité, pas toutes les
variables présentes. Pour vérifier une correction tardive, utiliser le pipeline
Task11 explicitement sur les stations/dates concernées dans une nouvelle racine.

Lecture carte, côté serveur :

```text
GET /api/climate/france?version=task15-example&date=2026-10-01&limit=1000
GET /api/climate/france?version=task15-example&date=2026-10-01&limit=1000&after=CURSOR
```

Suivre `next_cursor` jusqu'à null. Support `era5_land_grid`, source `era5-land`,
unités explicites, `interpolation=none`, absence distincte d'une valeur zéro.
Chaque ligne référence son acquisition SHA256 ; la version de jeu est explicite.
Le endpoint stations reste `/api/weather/stations?mode=live_meteofrance` avec
`spatial_support=station_points`. Les secrets restent au serveur.
