# Reprise de COUV-01 et compatibilité avec main

Mise à jour finale : la branche intègre désormais `main` **8db047d**, fusion
d'EDIT-03 (#88), sans conflit et sans altération d'EDIT-03 ou OPS-07.
Voir [la vérification finale](FINAL_VERIFICATION.md) pour l'audit après merge.
Le reste du document décrit la reprise initiale depuis `80aa4aa`.

Lecture de la [PR #63](https://github.com/Mehdi-Sine/agriclimax/pull/63), de son
unique commit `ec7927d794d1f4986bc4ab1d6df39094834e6a1f`, des diagnostics,
matrices, archives, échantillons, tests et budgets avant développement.
La PR reste draft, ouverte, non fusionnée. Sa base historique est `0e7bcba`.

La branche COUV-02 est créée depuis `origin/main` **80aa4aa**, merge d'OPS-07
(#87), et contient donc OPS-06 (#84), CORE-01, DATA-01 et l'UX Climacta actuelle.
La PR #63 est techniquement fusionnable selon GitHub ; son ancien état fonctionnel
justifie néanmoins le report sélectif demandé plutôt qu'une fusion directe.

## Report sélectif traçable

Les fichiers suivants sont repris **à l'identique** depuis le commit de #63 :

- `docs/codex/COUV-01/` : documentation historique et toutes les preuves gelées.
- `climate/safran.py`, `climate/safran_archive.py`, leurs deux fichiers de tests.
- `engine/requirements-safran.lock` : dépendance optionnelle du pilote original.
- `scripts/safran_pilot.py`, `scripts/couv01_station_comparison.py`,
  `scripts/verify_couv01_frozen.py`.

Les formulations de COUV-01 refusant un seuil de 90 % restent les conclusions
historiques de cette tâche. COUV-02 applique la **nouvelle règle produit explicite
du TASK**, tout en conservant la séparation entre valeur de portion et valeur de
PRA entière. Il ne réécrit pas les preuves ou verdicts historiques.

Non repris : workflow manuel SAFRAN, candidat de continuité prévisionnelle,
son code/tests et vérificateur Parquet dépendant de ce candidat, script d'export
legacy déjà repris puis amélioré par DATA-01. Les preuves historiques de ces
essais restent dans COUV-01. Aucune version ancienne n'écrase le code actuel.
La modification de `scripts/archive_legacy_pra_reads.py` dans `main` est conservée.

COUV-02 réutilise en plus `era5-restored-support.json` et les 30 archives
`DATA-01/evidence/legacy/`, présents dans `main`. Ces dernières ont les mêmes
empreintes que leurs originaux COUV-01. Les 30 dates de restitution ERA partielle
sont 02–31/10, celles des archives legacy 01–30/10 : l'intersection réelle vaut
29 jours. Cette différence est conservée dans la recette 30 jours.

## Frontières de responsabilité

| Frontière | Changement |
|---|---|
| Domaine climat expérimental Python | reprise SIM + nouvel adaptateur pur, opt-in |
| Géospatial | audit des 68/38 supports, sans changer les référentiels ni poids |
| Qualité / traçabilité | contrat existant réutilisé ; indicateurs/Journal refusés |
| Archives | lecture locale, contrôles d'intégrité, aucun remplacement |
| Journal, OPS-06/OPS-07, OpenAI | aucun fichier modifié |
| Prévisions AROME/ARPEGE/IFS | aucun fichier opérationnel ou candidat ajouté |
| Composants UX, légendes scientifiques | aucun fichier modifié |
| Supabase / migrations / Storage | aucun appel, aucune migration ou écriture |
| Acquisition quotidienne / workflows | aucun fichier modifié, aucun déclenchement |

`VALIDATION.md` conserve les contrôles de périmètre et les empreintes des fichiers
protégés. Les consommateurs existants n'importent aucun des nouveaux modules.
L'argument `enabled=False` ne dépend d'aucune variable d'environnement et ne peut
pas activer une acquisition. Seul le programme de recette passe `enabled=True`.
