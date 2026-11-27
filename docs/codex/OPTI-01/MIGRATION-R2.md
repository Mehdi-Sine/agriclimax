# OPTI-01 · Migration progressive vers R2

**GO pour la recette avec une destination privée et des copies vérifiées. NO-GO pour tout basculement de production.** L’endpoint, les identifiants R2, le test R2 réel, la restauration complète et l’autorisation de bascule restent à obtenir. R2 Standard propose 10 Go-mois, 1 million d’opérations A et 10 millions B par mois en franchise, avec egress propre à R2 sans frais. Les franchises s’appliquent au compte et les dépassements sont facturables. L’accès nécessite une configuration Cloudflare existante et autorisée. [Tarifs R2](https://developers.cloudflare.com/r2/pricing/) · [Compatibilité S3](https://developers.cloudflare.com/r2/api/s3/api/)

## Ce qui peut basculer indépendamment

| Phase | Chemins | Consommateurs et conditions |
|---|---|---|
| 1 · Publication légère | `journal/v1/<edition>/index.json`, WebP par carte et SHA | Lecteur et producteur OPTI-01. Adaptateurs serveur Supabase et S3 (R2) et mode fichiers local. |
| 2 · Cartes historiques et supports lus | `edition-maps/`, `era5/`, `support/` | Gain principal via la suppression des lectures scientifiques lors de la consultation du Journal. Déplacer ensuite les lectures Cartes. Conserver la résolution des manifestes, des checksums et des routes existantes. |
| 3 · Prévisions natives et masques de cycles | `forecast-native/`, `forecast-masks/`, `weather/` | Index et liens liés au cycle et à la couverture. Valider identité, lock, rétention, métadonnées et vues historiques. |
| 4 · Autres gros objets | `editorial-inputs/`, candidats et catalogues | Les champs de référence existants sont des clés relatives. Les pointeurs mutables nécessitent une stratégie de version et de mise à jour à part. |

La phase 1 est câblée. Les stockages scientifiques phases 2 à 4 nécessitent des adaptations et des essais additionnels. Les scripts de copie s’appliquent à des listes finies de clés et gardent les octets et noms actuels. Supabase PostgreSQL, l’API RPC et le watchdog continuent à servir le registre.

### Dépendances d’adresses

| Couche | Points d’intégration |
|---|---|
| TypeScript | `immutable-map-storage.ts` et `edition-maps.ts` pour blobs et manifestes. `weather-archives.ts` pour catalogue, courant, AROME/ARPEGE, ERA5 et masques, consommé par composites, qualification et restitution. `immutable-inputs.ts` et `scripts/edit04_frozen.ts` pour les dossiers d’entrée. `journal-object-storage.ts` pour la projection indépendante. |
| Python | `scripts/pra_weather_store.py` et `scripts/couv05d_storage.py` pour le transport, le catalogue et les opérations S3/REST. `forecast_native_publication.py`, `era5_archive_daily.py`, `national_weather.py` et outils SIM dépendent de ces transports et des reçus. |
| SQL | `editorial_snapshots`, `editorial_acquisitions`, RPC de production et diagnostics conservent des chemins et SHA. Les migrations OPS08 et OPS08C consultent les tables Storage pour les rapports. Auditer ces lectures avant de déplacer leurs ressources. `pg_cron`, `pg_net` et les épingles Vault restent des dépendances du watchdog et des rapports. |

## Confidentialité et redistribution

Bucket privé, `r2.dev` et accès public désactivés, endpoint S3 HTTPS, compte et emplacement audités. Le lecteur reçoit uniquement le rendu éditorial autorisé et les vignettes contrôlées. Les archives et clés S3 restent côté serveur. Pour un accès scientifique futur, autoriser la lecture au niveau de l’application et signer une clé précise avec une durée courte si un transfert direct est nécessaire. Séparer les accès du lecteur et du producteur. Utiliser une juridiction UE si la politique de données l’exige et vérifier l’emplacement de PostgreSQL, Vercel et des sauvegardes. [Localisation R2](https://developers.cloudflare.com/r2/reference/data-location/)

Documenter pour chaque acquisition le produit, le fournisseur, la version des conditions acceptées, l’attribution, les dérivés autorisés et le traitement par hébergeur tiers. Pour ERA5-Land, reprendre la licence et la citation de la fiche CDS. Météo-France publie les jeux de prévision numérique et les séries climatologiques quotidiennes sous Licence Ouverte 2.0. Rattacher chaque fichier aux conditions de l’API et du produit effectivement acquis, en particulier AROME et ARPEGE WCS, SIM et stations. Appliquer les mentions de source et de date avant toute redistribution. Vérifier séparément RPG, géométries et publications documentaires. Conserver les reçus et l’attribution dans les bundles et les cartes. Une licence absente ou non établie maintient l’accès privé et suspend toute extension de diffusion. [ERA5-Land](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land) · [Prévisions numériques Météo-France](https://www.data.gouv.fr/datasets/modele-numerique-de-previsions-meteorologiques) · [Stations quotidiennes](https://www.data.gouv.fr/datasets/donnees-climatologiques-de-base-quotidiennes)

## Configuration et copie contrôlée

Préparer un bucket R2 de recette existant ou explicitement autorisé. Entrer ses clés dans un gestionnaire dédié. Variables serveur `AGRICLIMAX_JOURNAL_STORE=s3`, `AGRICLIMAX_JOURNAL_S3_ENDPOINT` (racine HTTPS), `AGRICLIMAX_JOURNAL_S3_BUCKET`, `AGRICLIMAX_JOURNAL_S3_REGION=auto`, `AGRICLIMAX_JOURNAL_S3_ACCESS_KEY_ID`, `AGRICLIMAX_JOURNAL_S3_SECRET_ACCESS_KEY`, et `AGRICLIMAX_JOURNAL_PROJECTION_ENABLED=true`. Le workflow quotidien expose le drapeau de production de la représentation et utilise Supabase par défaut. Ajouter les secrets S3 au workflow uniquement lors d’une bascule d’écriture autorisée. L’adaptateur utilise PUT conditionnel et vérifie chaque octet au readback. [Opérations conditionnelles R2](https://developers.cloudflare.com/r2/api/s3/conditional-operations/)

Les remotes rclone `supabase-private` et `r2-isolated` sont à configurer en mode S3 avec le profil adéquat, l’endpoint et des identifiants en coffre. Utiliser une liste filtrée à partir du manifest SHA de la sauvegarde, avec contrôle des références et des compteurs. Pour la phase 1, copier d’abord les WebP puis les index, sur destination de recette sans producteurs concurrents. Exemple avec `CLIMACTA_BACKUP` défini comme dans [Sauvegarde](SAUVEGARDE.md).

```bash
set -euo pipefail
umask 077
jq -c 'select(.key | startswith("journal/v1/"))' "$CLIMACTA_BACKUP/objects.sha256.ndjson" \
  > "$CLIMACTA_BACKUP/journal.sha256.ndjson"
python scripts/opti01_objects.py keys "$CLIMACTA_BACKUP/journal.sha256.ndjson" > "$CLIMACTA_BACKUP/journal.keys"
awk '/\.webp$/' "$CLIMACTA_BACKUP/journal.keys" > "$CLIMACTA_BACKUP/journal.images"
awk '/\/index\.json$/' "$CLIMACTA_BACKUP/journal.keys" > "$CLIMACTA_BACKUP/journal.indexes"
for keyset in journal.images journal.indexes; do
  if [ -s "$CLIMACTA_BACKUP/$keyset" ]; then
    rclone copy "$CLIMACTA_BACKUP/objects" r2-isolated:climacta-journal-recette \
      --files-from-raw "$CLIMACTA_BACKUP/$keyset" --immutable --dry-run
  fi
done
```

Après validation de la simulation, relancer les mêmes copies en retirant `--dry-run`, puis relire dans un répertoire neuf sur le volume chiffré et comparer les SHA-256. Garder les écritures concurrentes désactivées sur la destination pendant la copie. Maintenir l’origine tant que l’autorisation de retrait et l’essai de restauration restent en attente.

```bash
mkdir -p "$CLIMACTA_BACKUP/r2-readback"
rclone copy r2-isolated:climacta-journal-recette "$CLIMACTA_BACKUP/r2-readback" \
  --files-from-raw "$CLIMACTA_BACKUP/journal.keys" --immutable
python scripts/opti01_objects.py verify "$CLIMACTA_BACKUP/journal.sha256.ndjson" "$CLIMACTA_BACKUP/r2-readback"
```

## Bascule et retour

En recette, vérifier toutes les révisions choisies, le parcours Journal → carte, la qualification, les statuts indisponibles, les refus de lecture brute anonyme, l’idempotence, l’ETag et les octets. Tester le retour de `s3` vers `supabase` avec les mêmes clés et SHA avant de solliciter l’autorisation. Après feu vert, démarrer par les lectures d’une preview et conserver les écritures sur l’origine, synchronisées selon inventaire. Puis basculer une seule autorité d’écriture avec une fenêtre courte et un journal des nouveaux objets. Limiter la double résidence au délai de vérification et à la fenêtre d’observation approuvée.

En cas d’incident, arrêter les nouvelles écritures sur la destination, remettre `AGRICLIMAX_JOURNAL_STORE=supabase` et redéployer la configuration précédente. Si des publications ont été faites uniquement sur R2, copier et vérifier d’abord leurs objets sur Supabase ou désactiver la projection pour réactiver les routes historiques. Contrôler l’identifiant courant et plusieurs éditions, les liens interactifs, les vignettes et le rapport. Les bundles et anciennes archives restent disponibles sur le backend précédent. La migration scientifique suit un plan séparé incluant les références actives et les uploads append-only.
