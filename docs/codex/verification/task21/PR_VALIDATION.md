# Préparation de la PR Task 21

Branche : `codex/21-pra-climatology`, depuis
`ea47e1828c1efeb2f6e523066a971cbb8ce64a36` (main, Task 20 incluse).

Les mesures de calcul et preuves DEV de RESULTS.md restent celles du run réel.
La préparation de PR n'a relancé ni acquisition CDS ni calcul annuel ni migration sur DEV. Les migrations sont rejouées uniquement dans les bases jetables des tests SQL.

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

## Couverture SQL de la PR

Le premier passage CI a confirmé l'application des migrations puis révélé une
assertion historique attendant 30 tables sous RLS. Les trois nouvelles tables
portent ce total à 33. Le contrôle est actualisé avec des assertions explicites
sur leurs droits et sur les deux RPC serveur SECURITY INVOKER.

Le test SQL synthétique Task 21 couvre import/rejeu, actuel/normale/anomalie,
référence absente ou insuffisante, actuel absent, rang non inventé, collision
immuable, borne temporelle et refus d'accès anonyme. Il est intégré aux deux
profils PostGIS de la CI et annulé par ROLLBACK. Le daemon Docker local a été
vérifié ; le pull de l'image épinglée dépasse l'espace disponible dans cette
instance, donc ces deux validations sont exécutées sur les runners GitHub.
