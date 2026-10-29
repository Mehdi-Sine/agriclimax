# Réconciliation Supabase — 29 octobre 2026, lecture seule

**Les deux migrations daily ne doivent pas être rejouées.** Leurs objets sont
présents et conformes à Git ; c'est leur enregistrement dans l'historique qui
manque. L'audit du 19 octobre avait constaté l'absence des lignes d'historique,
sans démontrer l'absence des objets. Cette distinction corrige le plan précédent.

Projet audité : `agriclimax-dev`, `yyfbpecxvxglzxopsmel`, PostgreSQL 17.11,
PostGIS 3.3.7 dans public, pgcrypto 1.3 dans extensions. Plan Free confirmé,
aucune branche de staging. Aucun DDL, changement de privilège, réparation
d'historique ou écriture métier exécuté par cet audit.

## Historique et fichiers Git

Les neuf couples version/nom sont inchangés depuis le relevé du 19 octobre. Le contenu SQL
de chacune correspond au fichier Git après **uniquement** CRLF → LF et retrait
des blancs extérieurs. Aucun commentaire ni élément SQL n'est supprimé pour
obtenir la concordance. Les différences de numérotation sont donc réconciliées
par contenu, pas supposées équivalentes à partir du nom.

| Version distante | Fichier/version Git |
|---|---|
| 20261010173457 | 0001_extensions_and_core |
| 20261010173509 | 0002_watch_and_ai_provenance |
| 20261010173523 | 0003_persistence_and_rls |
| 20261010173532 | 0004_bounded_read_api |
| 20261014135644 | 20261014133958_meteofrance_station_ingestion |
| 20261015113754 | 20261015073507_climatology_reference |
| 20261015160905 | 20261015140022_wheat_portfolios |
| 20261015173916 | 20261015173703_france_coverage |
| 20261015174831 | 20261015174308_france_station_catalogue_capacity |

[Résultat et empreintes](evidence/acceptance-20261029/migration-reconciliation.json),
[historique SQL capturé](evidence/acceptance-20261029/migration-history.json).

Les fichiers suivants n'ont pas de ligne correspondante :

| Fichier Git | État réel | Action proposée |
|---|---|---|
| 20261016095414_daily_pipeline.sql | table/index/politiques/RPC présents, conformes | régularisation de métadonnées seulement, sur autorisation |
| 20261016135913_daily_live_read.sql | lecteur présent, conforme | régularisation de métadonnées seulement, sur autorisation |
| 20261017190818_pra_territorial_aggregation.sql | dix tables et quatre RPC absentes | véritable migration à préparer en Task19B, pas à exécuter ici |

## Preuve des objets daily

Le catalogue distant a été comparé à celui d'une base PostGIS jetable dans
laquelle les fichiers Git immuables ont été rejoués. Égalité structurée de :

- Quatre colonnes, types, NOT NULL, défauts et contraintes de daily_snapshots.
- Index primaire et index de lecture de la dernière publication.
- RLS activée/forcée et deux politiques SELECT/INSERT pour service_role.
- Privilèges effectifs SELECT/INSERT/UPDATE/DELETE/TRUNCATE de chaque rôle.
- Deux signatures, arguments/défauts, résultats, langage, volatilité,
  SECURITY INVOKER, search_path, timeouts et corps des fonctions.
- Refus d'EXECUTE à anon/authenticated, autorisation service_role ; dépendance
  `agriclimax_persist_wheat(text,jsonb)` présente.

[Catalogue local attendu](evidence/acceptance-20261029/local-daily-catalog.json),
[catalogue distant observé](evidence/acceptance-20261029/remote-daily-catalog.json).
Une égalité entre deux catalogues vides est refusée par l'outil de comparaison.

La [Task18 LIVE_DATA](../task18/LIVE_DATA.md) documente déjà le RPC en service
le 16 octobre, et [Task18 SECURITY](../task18/SECURITY.md) ses droits. Les dix
publications actuelles commencent par le calcul du 16 octobre ; la dernière
est calculée le 25 octobre et porte sur le 18–24 octobre. Il ne s'agit donc pas
d'une preuve que le DDL a été ajouté après l'audit du 19 octobre.
Le mécanisme exact et l'instant d'application initiale restent inconnus :
**objets conformes présents hors historique**, pas « migrations jamais appliquées »,
ni « migrations daily sous une autre version » (aucune des neuf lignes ne les contient).

## Sécurité et limites du constat

Les 15 tables privées et cinq tables métier publiques ont RLS activée/forcée.
Aucun SELECT/INSERT anon/authenticated sur les tables privées. Aucune table/RPC
Task19, aucun objet Storage, aucune relation cron.job. Les 16 fonctions
applicatives sont inventoriées avec empreintes. Les alertes advisor historiques
restent présentes : spatial_ref_sys sans RLS, PostGIS dans public, trois anciennes
RPC definer et trois surcharges PostGIS exécutables publiquement. Elles sont les
exceptions documentées en Task04/18 ; aucun nouveau definer introduit.
Un résultat CI « security success » ne signifie pas « aucun avis Supabase ».

L'historique inchangé et la présence ancienne documentée des objets daily ne
permettent **pas** de certifier l'absence de toute opération DDL intermédiaire :
aucun journal DDL continu ou instantané exhaustif du 19 octobre n'est disponible.
Les données daily ont évolué via le workflow v0.2.0 existant. Cet audit ne les
modifie pas et n'interprète pas cette croissance comme une nouvelle migration.

## Reproduction sans écriture

Capturer le catalogue avec un acteur autorisé en lecture seule :

```sh
psql "$AUDIT_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 \
  -f supabase/scripts/task19-daily-catalog.sql > work/remote-daily-catalog.json
```

Capturer l'historique dans une transaction READ ONLY :

```sql
begin read only;
select jsonb_agg(jsonb_build_object('version',version,'name',name,'statements',statements) order by version)
from supabase_migrations.schema_migrations;
commit;
```

Rejouer les fichiers dans un conteneur local isolé, puis extraire son catalogue
avec le même SQL. La preuve fournie permet aussi une reproduction totalement
hors ligne, sans connexion :

```sh
python scripts/pra_migration_reconcile.py \
  --expected-catalog docs/codex/verification/task19/evidence/acceptance-20261029/local-daily-catalog.json \
  --observed-catalog docs/codex/verification/task19/evidence/acceptance-20261029/remote-daily-catalog.json \
  --history docs/codex/verification/task19/evidence/acceptance-20261029/migration-history.json \
  --output work/reconciliation.json
```

## Plan opérateur, après autorisation séparée

1. Refaire les lectures ci-dessus, identifier la cible, sauvegarder son historique
   et ses données, et tester la restauration dans un environnement isolé.
2. Refuser toute différence de catalogue ou de contenu SQL. Vérifier que seules
   les deux lignes daily manquent encore, et que Task19 est toujours absente.
3. Choisir la convention de versions avec l'opérateur. Préserver les neuf versions
   distantes et leur SQL ; conserver la table d'alias ci-dessus. Pour un futur
   outil CLI, utiliser un répertoire de déploiement isolé dont les copies des neuf
   migrations portent leurs versions distantes et gardent leur contenu inchangé.
   Ne pas renommer les migrations historiques du dépôt, ni faire db push à partir
   des noms locaux non réconciliés.
4. Régulariser **seulement les deux entrées daily comme déjà appliquées**, via
   l'outil de réparation d'historique revu par l'opérateur, avec les versions Git
   20261016095414 et 20261016135913 et la preuve des empreintes. Aucun CREATE/ALTER
   de table ou de fonction daily n'est nécessaire. Si l'outil ne conserve pas le
   SQL dans l'historique, garder le manifeste d'empreintes signé/revu séparément.
   Cette réparation est une écriture distante et exige une autorisation explicite.
5. Relire l'historique et le catalogue après réparation. Le plan de migration ne
   doit alors annoncer que Task19. Arrêter s'il propose de rejouer v0.2.0.
6. Après autorisation distincte du DDL Task19, appliquer uniquement sa migration
   additive, sous transaction et délais bornés, puis refaire préflight/droits/API.
   Pas de branche Supabase payante, de montée de version PostGIS ou de purge
   nécessaire pour cette réconciliation.

Task19 ne modifie pas les objets daily : le défaut de métadonnées est un
prérequis de déploiement, **pas une raison de rejouer le DDL ni une régression
de code Task19**. Le schéma a été rejoué localement en configurations PostGIS
public et extensions ; ce n'est pas une validation de déploiement distant.
