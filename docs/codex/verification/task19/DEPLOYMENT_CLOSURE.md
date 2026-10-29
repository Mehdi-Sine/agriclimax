# Task19 — plan d'activation manuel, sans exécution de production

> Plan historique du 19 octobre. La [réconciliation du 29 octobre](SUPABASE_RECONCILIATION_20261029.md)
> remplace l'hypothèse de prérequis daily non appliqués : les objets existent et
> sont conformes, seules les entrées d'historique manquent. Ne pas rejouer leur DDL.
> Suivre désormais le [cadrage Task19B](TASK19B_START.md).

Ce document prépare une migration. Il n'autorise pas son exécution en production.
Ni migration distante, ni backfill national, ni service payant pendant cet audit.

## Préparation et arrêt sur écart

1. Faire approuver le commit exact de PR #40 et fermer les blocages de
   [TECHNICAL_CLOSURE.md](TECHNICAL_CLOSURE.md). Garder les fonctions territoriales
   non activées tant que les données/qualifications ne sont pas validées.
2. Identifier explicitement l'environnement cible et l'opérateur. Aucun staging
   distant AgriclimaX isolé n'a été trouvé ; ne pas créer une branche Supabase
   facturable et ne pas modifier DEV par déduction de son nom.
3. Vérifier le plan/quotas, taille actuelle, extension PostGIS et son schéma,
   privilèges, historique des migrations, configuration Data API, sauvegarde et
   procédure de restauration. Tester la restauration dans une base isolée avant
   intervention distante. Le plan Free ne doit pas être supposé fournir PITR.
4. Réconcilier les noms et versions de l'historique Supabase avec les fichiers
   du dépôt. DEV a des versions différentes pour les migrations historiques et
   n'a pas les deux migrations daily de v0.2.0. **Ne pas lancer `db push` aveuglément.**
   Faire revoir les deux prérequis daily séparément avant Task19 ; ne pas les
   appliquer automatiquement en conséquence de ce rapport.
5. Conserver les inventaires pré/post et les sauvegardes hors de la base cible,
   sans données privées ni clés dans la PR. Les estimations `reltuples` ne prouvent
   pas l'identité de l'historique : comparer les comptes exacts/checksums métier
   v0.2.0 dans le staging avec le snapshot restauré.

Préflight en lecture seule, sur une URL explicitement choisie par l'opérateur :

```sh
# Variable injectée depuis le gestionnaire de secrets, jamais affichée.
psql "$STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -f supabase/scripts/task19-preflight.sql > work/task19-staging-before.log
```

Le script ne déploie rien et ne suppose pas que les tables Task19 existent.
Il rapporte droits effectifs (y compris héritage), RLS, fonctions, extensions,
taille et présence du planificateur. Si `cron.job` existe, inventorier ses jobs
en lecture seule avec l'opérateur ; ne pas conclure à leur absence sans lecture.
Sur DEV audité, la relation elle-même est absente. Vérifier aussi les schedules
Actions/Vercel : le workflow PRA est `workflow_dispatch` uniquement et ne possède
pas de credential Supabase ; aucun ordonnanceur national ni purge ajouté.

## Répétition locale autorisée et isolée

Prérequis : Python 3.12, lockfiles dev/climate/geo et requirements-pra-audit,
Docker local, image PostGIS verrouillée dans le script. Les commandes ci-dessous
ne consomment aucune URL de DB ni clé Supabase distante.

```sh
export PYTHONPATH=engine/src
python scripts/pra_reference_sql.py \
  --bundle config/coverage/ofb-masa-pra-2017-snapshot-20261017 \
  --output work/task19/reference-import.sql
bash supabase/tests/run-local.sh public
bash supabase/tests/run-local.sh extensions
bash tests/e2e/pra_local_setup.sh
```

Le setup officiel refuse de remplacer un conteneur du même nom. Les migrations
y sont appliquées dans leur ordre, sur une base neuve jetable. Import/rejeu local :

```sh
docker --host=unix:///var/run/docker.sock exec agriclimax-task19-official \
  psql -U postgres -d agriclimax_task19 -v ON_ERROR_STOP=1 \
  -f /repo/work/task19/reference-import.sql \
  -f /repo/work/task19/reference-import.sql \
  -f /repo/supabase/tests/pra_official_reference.sql \
  -f /repo/supabase/scripts/task19-preflight.sql
```

Si des variables Docker héritées redirigent le client, suivre la procédure du
runtime pour sélectionner le socket local. Le conteneur ne monte le dépôt qu'en
lecture seule. Cette répétition prouve migration/import/permissions, pas la
disponibilité météo nationale ni l'accès Data API d'un staging distant.

## Migration distante : seulement après autorisation de la cible

L'opérateur prépare le script exact à partir de la migration existante
`20261017190818_pra_territorial_aggregation.sql`, SHA256
`c4c07c92290901b3ad0e72feb9aca9bf64f2a03e7f9137518c706b4a661aa4a6`.
Elle contient sa propre transaction BEGIN/COMMIT : ne pas lui superposer un
`--single-transaction` qui serait prématurément terminé par son COMMIT interne.
Utiliser `psql -X -v ON_ERROR_STOP=1`, lock_timeout court (par exemple 5 s) et
statement_timeout borné (par exemple 60 s) dans la session d'intervention.
En cas d'échec de verrou ou de précondition : arrêter, analyser, aucun retry en
boucle ni modification destructive pour « faire passer » la migration.
Enregistrer la migration dans l'historique avec l'outil de déploiement retenu et
revu ; éviter un second passage du même DDL non idempotent.

Après migration sur le staging autorisé :

- Comparer pré/post, conserver v0.2.0 et ses rôles/contrats ; vérifier les dix
  tables nouvelles, leurs RLS forcées et l'absence d'UPDATE/DELETE/TRUNCATE.
- Vérifier EXECUTE des quatre fonctions pour service_role et son refus pour
  anon/authenticated/PUBLIC. Tester des requêtes réelles sous les rôles attendus,
  pas seulement les ACL affichées. Aucun rôle public n'obtient de nouvelles écritures.
- Vérifier l'exposition Data API de `public` et le maintien du schéma privé hors
  exposition. Conserver `SECURITY INVOKER` et les search_path bornés. Ne pas
  « réparer » une erreur 42501 avec SECURITY DEFINER ou des droits globaux.
- Appliquer **le SQL de référence revu uniquement**, puis le rejouer. Attendre
  713 territoires, 14 541 poids, codes corses et checksums identiques, poids
  complets. Ne pas falsifier `reference_verified_national` pour activer la page.
- Utiliser des lots pilotes réels revus/reçus conservés ; valider rejeu sans
  duplication, conflit de révision refusé, NULL/partiel/absent/stale et états blé/THI.
  Les tests SQL synthétiques ne sont pas des preuves météo réelles.
- Contrôler API et preview protégée avec le bypass dans un en-tête uniquement,
  pagination des 713 PRA et quatre cas contrastés. Tester les parcours v0.2.0.
  Relever durée des requêtes, tailles de payload et budget DB réel.

Les scripts de tests écrivant des fixtures sont réservés au staging jetable ;
ne pas les exécuter dans une base de production, même s'ils terminent par ROLLBACK.

## Opérations manuelles après merge et avant données visibles

1. Autoriser séparément la migration de production et la référence validée, avec
   sauvegarde/restauration testées et fenêtre d'intervention. Le merge n'est pas
   une autorisation de migration.
2. Déployer uniquement les prérequis manquants revus et Task19 ; exécuter le
   préflight, vérifier les droits, puis importer la référence. Aucune donnée météo
   nationale n'est acquise par la migration ou l'import géographique.
3. Autoriser un pilote distant borné, avec révision dataset immuable explicite,
   reçus/checksums, quatre PRA au maximum et suivi DB/temps/egress. Valider les
   indisponibilités avant activation de l'interface.
4. Renseigner les variables **serveur** `PRA_REFERENCE_VERSION` et
   `PRA_DATASET_VERSION` avec les versions effectivement importées, puis faire
   approuver le déploiement frontend correspondant. Ne jamais utiliser une clé
   privilégiée sous préfixe NEXT_PUBLIC. Retester la preview et les routes réelles.
5. Obtenir une décision séparée de mise en service nationale : politique des
   littoraux, support CDS, complétude temporelle, exclusions, budget d'acquisition
   et de publication. Programmer des appels incrémentaux bornés seulement après
   cette autorisation ; aucun cron national n'est activé par cette PR.
6. Relever quotidiennement DB et consommation des quotas pendant le pilote.
   Les seuils internes sont 300/375/450 Mo ; l'écriture Task19 se bloque à 375 Mo.
   Ne pas activer de plan payant en réaction à une limite. Le scénario 90 jours
   n'autorise aucune suppression de l'historique.

## Arrêt et récupération

Avant COMMIT, l'échec de la migration laisse la transaction annulée. Après
COMMIT, conserver le schéma additif et désactiver l'affichage territorial en
retirant les deux variables serveur puis en redéployant la version approuvée.
Suspendre les appels opérateur PRA ; le parcours station v0.2.0 reste séparé.
Ne pas DROP les tables pour revenir à l'ancienne UI. Toute correction de schéma
est forward-only ; toute restauration de sauvegarde exige sa propre autorisation
et l'analyse des écritures intervenues depuis le snapshot.
