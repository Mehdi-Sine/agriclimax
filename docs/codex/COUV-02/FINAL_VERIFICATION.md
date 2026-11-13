# COUV-02 — vérification finale après EDIT-03

Vérification du 13 novembre 2026 pour la PR existante #89. La branche intègre
`main` **8db047dbe0e13a9e5d7cbf6a2fcb0720be53daae**, fusion de #88 (EDIT-03),
par le merge `cfad994bf61f3438d72ac032bc3cd143fb46e94b`. Aucun conflit rencontré.
OPS-07 (#87, `80aa4aa`) reste dans l'ascendance. Aucune nouvelle PR créée.

## Préservation vérifiée

Comparaison des modes et identifiants Git de tous les fichiers, après merge :

- **189 fichiers repris identiques** au commit COUV-01
  `ec7927d794d1f4986bc4ab1d6df39094834e6a1f` ; leurs blobs sont énumérés dans
  [final-preservation.json](validation/final-preservation.json).
- **28 fichiers EDIT-03 identiques** à ceux de `main`.
- **3 924 fichiers existants de main identiques** ; le seul fichier existant
  modifié reste `engine/src/agriclimax/climate/README.md` (documentation).
- Aucun diff sur `.github/`, `apps/`, `supabase/`, `config/`, `contracts/`,
  les preuves DATA-01 ou les fichiers EDIT-03. Les workflows nocturnes,
  mécanismes OPS-07, Journal, prompts IA, interface, prévisions, schémas et
  archives publiées restent ceux de main.

L'inspection des sources et la recherche des imports ne trouvent aucun appel
opérationnel aux nouveaux modules. `select_window(..., enabled=False)` reste
désactivé par défaut, sans configuration d'environnement pour l'activer.
Le pilote manuel COUV-01 exige toujours `--acquire` pour acquérir des données ;
aucun workflow ne l'appelle. Le rejeu COUV-02 lit uniquement les fichiers locaux.
Les sorties gardent `indicator_eligible=false` et `journal_eligible=false`.
Aucune nouvelle acquisition automatique, migration ou écriture en production.

## Résultats après synchronisation

| Contrôle | Résultat |
|---|---|
| Suite Python complète | **514 réussis**, 63 avertissements, 75,92 s |
| Régressions EDIT-03, OPS-07, cartes et IA | **237 réussis**, 23 fichiers |
| Régressions Python du cycle nocturne | **15 réussis** |
| Gardes qualité Python / Node | **28 / 9 réussis** |
| Ruff climat et scripts COUV | réussi |
| Mypy strict climat et qualification | réussi, 14 fichiers |
| TypeScript web et scripts EDIT-03 ; ESLint EDIT-03 | réussis |
| Secrets, migrations forward-only, contrats, automatisations, pip check, diff-check | réussis |
| Vérification COUV-01 indépendante | 60 archives, 213 900 PRA/date/variable, 105 références, 84 paires stationnelles |
| Vérification COUV-02 indépendante | **41 354 valeurs exactes**, **1 426 séries homogènes**, 101 empreintes d'entrée |
| Rejeu COUV-02 géospatial et adaptateur | **10 preuves et leur manifeste identiques octet pour octet** |
| Simulation EDIT-03 | **9 résultats identiques octet pour octet** |

Les 63 avertissements NumPy/netCDF4/xarray restent ceux déjà documentés.
Le rejeu dure 48,447 s, pic RSS 486 048 Kio ; ces mesures de durée/mémoire
dépendent de l'environnement et de la concurrence locale. Les résultats
scientifiques déterministes sont inchangés. Aucun build ou changement d'UI local.

| Fenêtre historique Tmoy et pluie | PRA à ≥ 90 % | Source par fenêtre entière |
|---|---:|---|
| 02–30 octobre 2026, 29 jours | **713, dont 6 corses** | 681 ERA + 32 SIM |
| 01–30 octobre 2026, 30 jours | **713** | 645 ERA + 68 SIM |
| 08 septembre–06 novembre 2026, 60 jours | **713** | SIM séparé |

Sur les 29 jours, 658 supports complets et 55 partiels ; aucune valeur n'est
attribuée aux surfaces manquantes. Les extrema, conventions de pluie, limites
du datum et qualification littorale indépendante restent inchangés.

## Reproduction et décision

Les commandes scientifiques et gardes sont celles de [VALIDATION.md](VALIDATION.md).
Le rejeu final utilise les dépendances verrouillées dev/geo/climat/agriculture/
opérationnelles existantes, Python 3.12.14 et pnpm 10.0.0, sans dépendance SAFRAN
optionnelle ni réacquisition. Les régressions web utilisent :

```sh
cd apps/web
node_modules/.bin/vitest run features/editorial-map-selection features/nightly features/edition-maps features/editorial-ai
node_modules/.bin/eslint features/editorial-map-selection/*.ts
```

Depuis la racine :

```sh
apps/web/node_modules/.bin/tsc --noEmit --project apps/web/tsconfig.json
apps/web/node_modules/.bin/tsc --project scripts/tsconfig.edit03.json
NODE_OPTIONS=--conditions=react-server apps/web/node_modules/.bin/tsx scripts/edit03_simulate.ts
python -m unittest discover -s tests/task36 -v
python -m unittest discover -s tests/quality -p 'test_*.py' -v
node --test tests/quality/*.test.mjs
```

[Contrôles finaux](validation/final-checks.json) ·
[Reproduction scientifique](validation/final-reproducibility.json).

La décision **GO pour fusion** dépend des contrôles GitHub sur le dernier commit
poussé et de la confirmation GitHub d'absence de conflit ; elle sera consignée
dans la PR. Le verdict scientifique du pilote reste **PARTIAL** et l'activation
quotidienne reste soumise aux conditions de [ACTIVATION.md](ACTIVATION.md).
La PR est conservée en brouillon ; aucune fusion, activation ou modification de
production n'est effectuée dans cette vérification.
