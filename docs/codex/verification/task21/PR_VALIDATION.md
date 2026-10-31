# Préparation de la PR Task 21

Branche : `codex/21-pra-climatology`, depuis
`ea47e1828c1efeb2f6e523066a971cbb8ce64a36` (main, Task 20 incluse).

Les mesures de calcul et preuves DEV de RESULTS.md restent celles du run réel.
La préparation de PR n'a relancé ni acquisition CDS ni calcul annuel ni migration.

Vérification locale sur cette base :

- `make check` : 245 tests Python et 237 tests web, lint, typecheck, build,
  contrats, contrôles de sources/secrets et inventaire des migrations passent.
- Ruff et mypy **strict** : les cinq runners Task 21 sont couverts ; la CI Quality
  les contrôle désormais explicitement.
- `git diff --check` : sans erreur.
- Sources et caches sous `work/` ignorés par Git ; seuls code, migrations,
  documentation et preuves textuelles sont proposés.

Deux migrations additives sont déjà appliquées sur agriclimax-dev :
`20261031125617_pra_climatology_1991_2020` et
`20261031131609_pra_climatology_fk_indexes`. Les fichiers correspondent aux
versions renvoyées par l'historique distant. Ne pas les réappliquer manuellement
sur DEV. Le schéma reste privé, RLS forcée, RPC SECURITY INVOKER et serveur seul.

Les vérifications responsive ne s'appliquent pas : cette PR n'ajoute ni ne
modifie l'UI. Le calcul annuel complet reste préparé et non exécuté. Les
avertissements de sécurité préexistants, leur périmètre et leurs liens de
remédiation figurent dans les snapshots avant/après ; aucun nouveau constat
sur le périmètre Task 21.
