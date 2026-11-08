# Tests et preuves

Exécution locale finale du 8 novembre 2026, Python 3.12 et dépendances de test verrouillées du dépôt :

| Contrôle | Résultat | Preuve |
|---|---|---|
| Suite Python complète | 379 tests passés, 63 avertissements de dépréciation existants xarray/netCDF4 | `evidence/pytest.log` |
| Tests documentaires T34 inclus | 31 cas, protections et comportements positifs/négatifs | `engine/tests/news/test_news.py` |
| Ruff paquet, CLI, tests T34 | Succès | `evidence/ruff.log` |
| Mypy strict paquet et CLI | Succès, 8 fichiers | `evidence/mypy.log` |
| Contrats existants hors ligne | Succès | `evidence/contracts.log` |
| Garde de secrets source | Succès | `evidence/security.log` |
| Pilote réel multi-source | 7 flux disponibles, 130 publications, 17 contextes | `PILOT.md`, bundle et métriques |
| Rejeu local d’archive du pilote | 0 nouvel octet documentaire | `evidence/metrics.json` |

Commandes :

```sh
python -m pip install -r engine/requirements-dev.lock -r engine/requirements-climate.lock \
  -r engine/requirements-geo.lock -r engine/requirements-agriculture.lock \
  -r engine/requirements-operational.lock -e 'engine[dev]'
python -m pytest engine/tests -q
python -m ruff check engine/src/agriclimax/news engine/tests/news scripts/task34_news.py
python -m mypy --strict engine/src/agriclimax/news scripts/task34_news.py
python scripts/check_contracts.py
python scripts/quality/security.py
```

Les tests couvrent URL privées/non fiables, DNS privé, refus de redirection, taille et compression, DTD/entités et XML non UTF-8, HTML de challenge, RSS/RDF/Atom, quotas d’items, auteur/catégories, dates invalides/sans fuseau/futures, classification et homonymie mais/maïs, absence de géocodage de communes, cinq axes de rapprochement, séparation saisonnière, budgets événementiels, indépendance des sources, robots, expiration des droits, retries HTTP bornés, réponse HTTP tronquée, révisions, déduplication, archive immuable/rejeu et cohérence du schéma documentaire.

Les actualités synthétiques existent exclusivement dans les tests. Le pilote utilise les requêtes réseau réelles et l’archive réelle du Journal déjà présente dans Git ; aucune période d’événement n’a été déplacée. Aucune concordance contemporaine réelle n’a été trouvée ; cela figure explicitement dans la recette au lieu d’être présenté comme un succès artificiel.

Le premier lancement de la suite globale a révélé l’absence de dépendances de test géographiques/climatiques dans le nouvel environnement. Les dépendances verrouillées déjà requises par la CI ont été installées, puis la suite globale a été exécutée avec succès. Aucune dépendance runtime T34 n’a été ajoutée au projet.

Aucun changement UI, donc pas de recette responsive pour cette tâche. Aucun workflow modifié ni activé ; pas de déclenchement climatique ou de modification d’archive distante. Les logs sont des preuves locales, pas un résultat CI hébergé prétendu.
