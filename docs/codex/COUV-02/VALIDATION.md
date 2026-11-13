# Validation COUV-02

La [vérification finale après EDIT-03](FINAL_VERIFICATION.md) complète ces
contrôles initiaux sur `main` **8db047d**, en conservant les preuves ci-dessous.

Contrôles locaux du 13 novembre 2026, base `main` 80aa4aa. Verdict **PARTIAL**,
pilote historique désactivé en production. Aucun contrôle local ne se substitue
aux checks distants du commit de PR.

| Contrôle | Résultat |
|---|---|
| Suite Python complète `pytest engine/tests -q` | **514 réussis**, 42,94 s |
| Tests du nouvel adaptateur | **15 réussis**, seuil exact 90 %, absence/non-fini, défaut désactivé, doublons/lacunes, source/support stable, extrema/pluie/humidité distincts, schéma existant |
| Vérification gelée COUV-01 sans calculateur de production | 60 archives, 213 900 PRA/date/variable, 105 références numériques, 84 paires stationnelles, 30 archives legacy : réussie |
| Vérification indépendante COUV-02 sans adaptateur ni décodeur de production | **41 354 valeurs exactement identiques** aux entrées, **1 426 séries homogènes**, 101 empreintes d'entrée : réussie |
| Audit géométrique | 68 supports ERA, 38 résidus SIM ; aucun franchissement de 90 % par affinement ERA ; unions et poids SIM cohérents |
| Ruff | domaine climat, tests climat, cinq scripts repris/nouveaux : réussi |
| Mypy strict | 14 fichiers, domaine climat et programme de qualification : réussi |
| `pip check` | aucune incompatibilité de dépendances déclarées |
| Garde secrets source | réussie après staging de tous les fichiers |
| Garde migrations forward-only, base `origin/main` | réussie, aucune migration ajoutée |
| Contrats JSON / exemples / YAML | réussis, aucun schéma existant modifié |
| Structure et permissions des automatisations | réussies, aucun workflow ajouté/modifié |
| Reproduction | deux rejeux de l'audit identiques octet pour octet hors durée/RSS ; pas de nouvelle acquisition |
| Carte | SVG rendu dans Chromium, **1 426 polygones**, inspection visuelle des deux cartes et de la légende |
| Préservation | **189 fichiers COUV-01 repris à l'identique** ; **1 015 fichiers protégés** de main sans diff |

Les 63 avertissements de la suite concernent les dépendances NumPy/netCDF4/xarray
(taille ndarray et dépréciation de reshape). Les tests de lecture/conversion
numérique réussissent ; la vérification indépendante des sorties réelles est
exacte. Ces avertissements ne sont pas présentés comme une validation scientifique.

Le frontend n'est pas modifié, donc pas de nouvelle recette responsive ou de
nouveau build local de l'application. Le navigateur n'a servi qu'à inspecter le
SVG de diagnostic. Journal, OPS-06/OPS-07, prompts, prévisions, composants UX,
légendes, config et migrations restent intacts. Aucun client de production
n'importe les nouveaux modules. Le seul fichier de `main` modifié est le README
du domaine climat ; tous les autres changements sont des ajouts.

Les rapports lisibles par machine sont dans `validation/` ; `preservation.json`
précise les commits et le périmètre vérifié. Les commandes utiles :

```sh
work/couv02/venv/bin/pytest engine/tests -q
work/couv02/venv/bin/ruff check engine/src/agriclimax/climate engine/tests/climate scripts/couv02_qualification.py scripts/verify_couv02_frozen.py scripts/safran_pilot.py scripts/couv01_station_comparison.py scripts/verify_couv01_frozen.py
work/couv02/venv/bin/mypy --strict engine/src/agriclimax/climate scripts/couv02_qualification.py
python scripts/verify_couv01_frozen.py
python scripts/verify_couv02_frozen.py
python scripts/quality/security.py
python scripts/quality/migrations.py --base origin/main
work/couv02/venv/bin/python scripts/check_contracts.py
work/couv02/venv/bin/python scripts/quality/check_automation.py
```

## Limites conservées pour la décision

Le résultat porte sur les périodes effectivement archivées et sur des valeurs
descriptives de la surface représentée. Les supports partiels ne deviennent pas
des estimations de la PRA entière. Les journées ERA/SIM ne sont pas toutes
équivalentes, les extrema restent distincts, les normales et indicateurs
agronomiques ne sont pas activés. Le coût d'une alimentation quotidienne n'est
pas remesuré sur une nouvelle collecte et aucun endpoint ciblé n'est démontré.
La qualification du datum et la validation littorale hors assimilation restent
ouvertes. Ces limites imposent PARTIAL plutôt que GO.
