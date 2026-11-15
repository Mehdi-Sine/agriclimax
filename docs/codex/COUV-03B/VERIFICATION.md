# Vérifications COUV-03B

Base contrôlée : `98a972f` (fusion #94), contenant #92. Les commandes sont
exécutées sous Python 3.12 dans un venv isolé avec les dépendances verrouillées
`requirements-dev.lock`, `requirements-geo.lock`, `requirements-safran.lock` et
`requirements-climate.lock`. Une première tentative de suite climatique a révélé
l'absence locale de xarray ; les dépendances verrouillées ont été installées puis
la suite complète ci-dessous a réussi. Aucune modification de dépendance du dépôt.

| Contrôle | Résultat et preuve |
| --- | --- |
| `pytest engine/tests/climate tests/task36/test_couv03b_checkpoint.py tests/task36/test_couv03_pipeline.py -q` | **90 passed**, 39 avertissements de dépendances, `evidence/tests.log` |
| `unittest discover -s tests/task36 -v` | **20 tests OK**, `evidence/task36-tests.log` |
| Ruff, deux scripts ajoutés | PASS, `evidence/ruff.log` |
| Mypy strict, deux scripts ajoutés | PASS, `evidence/mypy.log` |
| `verify_couv01_frozen.py` | PASS, `evidence/couv01-frozen.log` |
| `verify_couv02_frozen.py` | PASS, 41 354 valeurs et 101 empreintes d'entrée, `evidence/couv02-frozen.log` |
| Première collecte réseau réelle | PARTIAL pour la fenêtre demandée, 14 novembre absent ; `evidence/first-collect.json` |
| Reprise réseau sur source identique | Aucun nouveau blob, un seul appel catalogue ; `evidence/second-collect.json` |
| Matrice Tmoy/pluie réelle | 384/384 PRA-jours utilisables sur les six dates reçues ; `evidence/coverage.csv` |
| Transport privé réel | Sauvegarde 7 objets, restauration vérifiée ; `evidence/storage-*.json` |
| Pointeurs publiés avant/après | SHA-256 identiques pour `catalogue.json` et `current.json` |
| Garde des secrets source | PASS, `evidence/security.log` |
| Conservation des fichiers de production | PASS, `evidence/preservation.json` |
| Flag GitHub | GET collection et PATCH de la variable refusés HTTP 403 ; activation non réalisée |

Les nouveaux tests couvrent l'idempotence de sauvegarde, la restauration à
l'identique, l'interdiction de remplacer un répertoire existant, le rejet de
corruption/path traversal/bucket public et l'absence d'écritures hors préfixe
candidat. Les tests existants couvrent le retour indisponible sur lacune ou
corruption SIM, la priorité ERA, l'éligibilité Journal fausse et la continuation
de l'export ERA malgré une erreur SIM. Les flux éditoriaux existants ne sont
pas modifiés ni déclenchés.

Les fichiers candidats réellement restaurés sont conservés sous
`evidence/candidate/` avec leur index et rapport. Revue hors réseau :

```sh
PYTHONPATH=engine/src:scripts python scripts/couv03b_review.py --root docs/codex/COUV-03B/evidence/candidate --output work/couv03b/offline-review
```

Les mesures de durée/coût ne constituent pas un benchmark GitHub Actions. La
présence des données au créneau opérationnel et la rétention automatique après
interruption restent à vérifier sur plusieurs mises à jour réelles. Pas de test
responsive : aucune UI modifiée.

Skills utilisés : `cloud-environment-runtime` (environnement/réseau/dépendances)
et `supabase` (préfixe privé dans le bucket existant, aucune migration ou ACL).
Changelog Supabase et documentation Storage consultés ; le changement de suites
TLS CBC n'affecte pas le transport TLS vérifié existant ; la recette distante a
réussi sans désactiver la vérification TLS.
