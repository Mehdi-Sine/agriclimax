# OPTI-01 · Sauvegarde et restauration

## Patrimoine et état

L’inventaire des 1 414 objets est disponible sous forme NDJSON dans l’espace de travail privé. Il représente 823 463 484 octets de contenu à exporter. L’inventaire, le dépôt et les procédures ne constituent ensemble qu’une partie de la sauvegarde. Un export PostgreSQL chiffré et l’ensemble des octets Storage vérifiés doivent rejoindre le stockage indépendant du propriétaire. Le dump complet nécessite une connexion PostgreSQL directe ou le pooler de session et un espace chiffré de destination. Le connecteur SQL fournit des requêtes d’audit et la clé API Storage donne accès au contenu de projection, tandis que l’accès PostgreSQL de sauvegarde et la destination chiffrée du propriétaire restent à fournir. Programmer le transfert intégral avec la marge d’egress mesurée après traitement de l’alerte.

Utiliser un hôte de sauvegarde séparé, un volume chiffré pour les fichiers de travail et une destination hors compte Supabase accessible au propriétaire. Construire deux copies indépendantes et tester leur déchiffrement. Conserver les secrets (DB, Vault, GitHub, OpenAI, clés météo, Vercel, R2 et SMTP) dans leur gestionnaire. Les opérations ci-dessous supposent un système avec PostgreSQL 17, Python ≥ 3.11, rclone récent et age. Configurer `climacta_backup` en service libpq, avec le secret dans `PGPASSFILE` en mode 0600, SSL et vérification du serveur. Le profil S3 Supabase utilise des identifiants S3 en lecture du bucket privé. Voir [Supabase S3 Authentication](https://supabase.com/docs/guides/storage/s3/authentication) et [Backups](https://supabase.com/docs/guides/platform/backups).

## Commandes de sauvegarde

En dehors des étapes sensibles de la nuit, relever l’instant et les états des pointeurs `current.json` et `catalogue.json`. En cas de changement concurrent, reprendre la photographie des pointeurs et les objets concernés. Exporter la liste définitive en lecture seule sur la même période que le dump. Utiliser exclusivement des fichiers et chemins privés pour les sorties. Récupérer aussi les sources Git au commit livré, les migrations, fonctions SQL et Edge éventuelles, les workflows et les horaires déclarés. Le contenu des paramètres privés se restaure depuis le gestionnaire de secrets.

```bash
set -euo pipefail
umask 077
export CLIMACTA_BACKUP=/mnt/chiffre/climacta-2026-11-27
mkdir -p "$CLIMACTA_BACKUP/objects"
git bundle create "$CLIMACTA_BACKUP/source.bundle" --all
pg_dump --dbname='service=climacta_backup' --format=custom \
  --exclude-schema=vault --exclude-table-data=cron.job \
  --exclude-table-data=cron.job_run_details --exclude-schema=net \
  --file="$CLIMACTA_BACKUP/postgres.dump"
pg_restore --list "$CLIMACTA_BACKUP/postgres.dump" > "$CLIMACTA_BACKUP/postgres-toc.txt"
psql 'service=climacta_backup' -X -qAt -v ON_ERROR_STOP=1 > "$CLIMACTA_BACKUP/storage-inventory.ndjson" <<'SQL'
BEGIN READ ONLY;
SELECT json_build_object('key',name,'bytes',(metadata->>'size')::bigint,
       'etag',metadata->>'eTag','content_type',metadata->>'mimetype',
       'created_at',created_at,'updated_at',updated_at)
FROM storage.objects WHERE bucket_id='pra-climate-archives' ORDER BY name;
COMMIT;
SQL
psql 'service=climacta_backup' -X -v ON_ERROR_STOP=1 --csv -c \
  'SELECT jobname,schedule,active FROM cron.job ORDER BY jobid' > "$CLIMACTA_BACKUP/cron-schedules.csv"
python scripts/opti01_objects.py keys "$CLIMACTA_BACKUP/storage-inventory.ndjson" > "$CLIMACTA_BACKUP/keys.txt"
rclone copy supabase-private:pra-climate-archives "$CLIMACTA_BACKUP/objects" \
  --files-from-raw "$CLIMACTA_BACKUP/keys.txt" --immutable --transfers 2 --checkers 2
python scripts/opti01_objects.py seal "$CLIMACTA_BACKUP/storage-inventory.ndjson" "$CLIMACTA_BACKUP/objects" \
  > "$CLIMACTA_BACKUP/objects.sha256.ndjson"
python scripts/opti01_objects.py verify "$CLIMACTA_BACKUP/objects.sha256.ndjson" "$CLIMACTA_BACKUP/objects"
(cd "$CLIMACTA_BACKUP" && sha256sum source.bundle postgres.dump postgres-toc.txt storage-inventory.ndjson \
  keys.txt cron-schedules.csv objects.sha256.ndjson > SHA256SUMS)
tar -C "$CLIMACTA_BACKUP" -cf - . | age -r "$CLIMACTA_BACKUP_AGE_RECIPIENT" \
  -o /mnt/copie-independante/climacta-2026-11-27.tar.age
```

Avant clôture, vérifier que le manifest contient les clés attendues, comparer à un nouvel inventaire et vérifier les octets des pointeurs courants. Les archives de déploiement et les durées de vie configurées dans les consoles restent à exporter séparément. Les contenus SQL, les chaînes d’authentification et les diagnostics restent dans le périmètre chiffré. Vérifier le contenu du dump dans cet espace avant diffusion à un prestataire de sauvegarde.

## Restauration isolée

1. Préparer un PostgreSQL 17 isolé et un bucket privé vide. Répliquer les extensions et les rôles requis avec un environnement Supabase local de même génération. Garder l’accès réseau applicatif et les tâches planifiées coupés pendant le chargement. Vérifier que `climacta_restore_isolated` pointe sur cet hôte et que les variables de production sont absentes.
2. Contrôler le TOC avant restauration. Sur une pile Supabase initialisée, créer un TOC approuvé pour conserver les DDL gérés déjà installés et les données gérées utilisables. Dans les entrées `TABLE DATA storage.objects`, laisser l’API reconstruire les métadonnées lors de la copie. Reporter les RLS, grants, extensions, RPC, identités et propriétaires nécessaires aux fonctions SECURITY DEFINER. Comparer la liste de migrations au Git restauré. Recréer les secrets hors dump et les jobs via `supabase/ops` et migrations, avec URLs simulées et planification initialement désactivée. `net` et Vault sont réinstallés par la plateforme.
3. Extraire sur un volume chiffré et vérifier les empreintes. La liste d’objets du dump doit refléter le schéma restauré. Les erreurs d’extension, rôle ou politique interdisent de valider la restauration.

```bash
umask 077
mkdir -p /mnt/chiffre/restore-climacta
age -d -i "$CLIMACTA_RESTORE_AGE_IDENTITY" /mnt/copie-independante/climacta-2026-11-27.tar.age \
  | tar -C /mnt/chiffre/restore-climacta -xf -
export CLIMACTA_RESTORE=/mnt/chiffre/restore-climacta
(cd "$CLIMACTA_RESTORE" && sha256sum -c SHA256SUMS)
pg_restore --list "$CLIMACTA_RESTORE/postgres.dump"
pg_restore --dbname='service=climacta_restore_isolated' --exit-on-error --single-transaction \
  --use-list="$CLIMACTA_RESTORE/toc-reviewed.txt" "$CLIMACTA_RESTORE/postgres.dump"
rclone copy "$CLIMACTA_RESTORE/objects" isolated-private:pra-climate-archives \
  --files-from-raw "$CLIMACTA_RESTORE/keys.txt" --immutable
rclone copy isolated-private:pra-climate-archives "$CLIMACTA_RESTORE/readback" \
  --files-from-raw "$CLIMACTA_RESTORE/keys.txt"
python scripts/opti01_objects.py verify "$CLIMACTA_RESTORE/objects.sha256.ndjson" "$CLIMACTA_RESTORE/readback"
psql 'service=climacta_restore_isolated' -X -v ON_ERROR_STOP=1 -c \
  'SELECT count(*) FROM agriclimax_private.pra_territories'
```

Vérifier le nombre de PRA (713), les distributions de couverture, les dates et références archivées, le texte exact, plusieurs révisions historiques, les WebP, la résolution des bundles et des pointeurs, et le refus d’accès non autorisé. Effectuer un rapport sec et un rejeu sans acquisition ni appel OpenAI. Consigner durées, tailles, SHA-256, limitations, date du prochain essai, RPO et RTO constatés. Cible initiale proposée de RPO 24 h et RTO 4 h, à valider par exercice réel.

## Essais de restauration effectués

Les trois objets de la projection réelle du 27 ont été copiés dans un second répertoire isolé avec rclone. Deux copies successives en mode immuable ont donné les mêmes octets. Les trois SHA-256 et les tailles ont été contrôlés avec `opti01_objects.py`.

Un `pg_dump -Fc` et un `pg_restore --exit-on-error --single-transaction` ont été exécutés dans PostgreSQL 17 sans réseau, avec l’archive réelle du 27 et 713 identifiants PRA uniques en données de recette. Les contrôles après restauration donnent le même SHA-256 pour les 423 424 octets de l’archive et le même nombre d’identifiants. Ce jeu inclut des lignes de liaison de test. Le dump hébergé, les extensions PostGIS et gérées et les 1 414 objets de production restent à restaurer ensemble sur la cible complète.
