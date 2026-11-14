# Validation COUV-03

## Résultats

| Contrôle | Résultat / preuve |
|---|---|
| Tests climat Python | **85 passed**, `validation/climate-tests.log` |
| Planification/retry/checkpoint Python | **17 tests OK**, `validation/task36-tests.log` |
| Journal, OPS-07, EDIT-04, éditorial IA, indicateurs, secours manuel | **344 passed, 2 skipped**, 35 fichiers exécutés ; `validation/web-tests.log` |
| Ruff domaine climat, nouveaux scripts/tests, export | OK, `validation/ruff.log` |
| Mypy strict du domaine climat | 14 fichiers OK, `validation/mypy.log` |
| Archives gelées COUV-01 | OK, `validation/couv01-frozen.log` |
| Archives gelées COUV-02 | OK, 41 354 valeurs historiques exactement vérifiées ; `validation/couv02-frozen.log` |
| Rejeu récent déterministe | Six fichiers identiques octet par octet, `evidence/reproducibility.json` |
| Préservation du code et des données publiées | `validation/preservation.json` |

Les deux tests web ignorés sont ceux déjà conditionnés/ignorés par la suite du
dépôt. Les avertissements Python viennent des réductions/écritures NetCDF dans
les tests existants, sans échec. Aucun appel IA réel ni nouvelle publication du
Journal n'est effectué pour tester ce changement.

## Scénarios exercés

- Source absente : le lecteur conserve une fenêtre ERA exploitable ; sans ERA,
  sortie indisponible, pas de valeur créée.
- Source retardée : demande contenant le 14 novembre alors que la source s'arrête
  au 13. Une seule lecture du catalogue (source inchangée), aucune nouvelle
  acquisition de Parquet, date absente enregistrée, aucune valeur reportée.
- Blob candidat corrompu : checksum/taille refusés ; ERA reste sélectionné s'il
  est utilisable ; sinon aucune sortie SIM. Pas de réécriture du blob corrompu.
- Incrément 1–7 puis 7–13 : sept puis six journées écrites. Rejeu : zéro.
- Changement de métadonnées du fichier roulant : pas de duplication des données
  identiques. Vraie révision : version distincte dans les trois derniers jours,
  deux versions au maximum ; ancienne révision refusée sans changer l'index.
- Échec d'export SIM : le checkpoint ERA original est quand même exporté.
  Pas de nouveau jour ERA : un checkpoint candidat existant peut être conservé.
- Homogénéité des séries, 90 %, extrema distincts, refus sous seuil et journées
  pluie différentes : tests COUV-02 inchangés et lecteur incrémental exercés.

## Indépendance du Journal et limites de la preuve

Comparaison au commit `60ff41a` : tous les fichiers de l'application, migrations,
contrats, archives COUV-01/02 et scripts préexistants (sauf l'export de checkpoint
explicitement étendu) sont identiques. Le job éditorial est identique, ainsi que
les horaires et la matrice de sources. Le seul raccordement workflow est une
étape de canari dans le job ERA, flag exact `true`, non bloquante, limitée à deux
minutes ; son plafond de job réserve ces deux minutes en plus des 26 existantes uniquement
quand le canari est activé. Sinon le plafond reste à 26 minutes.

Les valeurs candidates ne sont pas consommées par le Journal. Les tests existants
OPS-07 et du secours factuel s'exécutent sans changement. Cela démontre l'absence
d'effet du code livré sur le circuit de publication ; cela ne prétend pas observer
une future nuit de production avec une source activée. La recette du canari sur
plusieurs nuits reste un critère explicite avant activation publique.

## Commandes

```sh
PYTHONPATH=engine/src:scripts work/couv03/venv/bin/pytest engine/tests/climate -q
PYTHONPATH=engine/src:scripts work/couv03/venv/bin/python -m unittest discover -s tests/task36 -p 'test_*.py' -v
work/couv03/venv/bin/ruff check engine/src/agriclimax/climate engine/tests/climate scripts/couv03*.py scripts/era5_export_checkpoint.py tests/task36/test_couv03_pipeline.py
work/couv03/venv/bin/mypy --strict engine/src/agriclimax/climate
python scripts/verify_couv01_frozen.py
python scripts/verify_couv02_frozen.py
PYTHONPATH=engine/src:scripts work/couv03/venv/bin/python scripts/couv03_qualification.py --output work/couv03/replay
pnpm --filter @agriclimax/web test features/nightly features/editorial-map-selection features/editorial-ai features/journal features/agroclimatic lib/server/manual-journal.test.ts
```

Mypy/tous les tests climat demandent aussi `engine/requirements-climate.lock` ;
les tests web utilisent pnpm 10 et le lockfile existant, non modifié.
