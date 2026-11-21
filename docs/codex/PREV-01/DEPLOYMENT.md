# Activation, stockage et retour arrière

## Recette isolée

1. Compiler avec `NEXT_PUBLIC_COUV04_RENDER_ENABLED=true` pour la prévision. Conserver l’interrupteur historique à la valeur déjà utilisée dans l’environnement.
2. Démarrer Next avec les accès Storage serveur existants, `PRA_NATIONAL_ENABLED=1`, `COUV05_RENDER_ENABLED=true` et `COUV05_ARCHIVE_INDEX_PINS=<archive>=<index>,<archive>=<index>`. Les couples sont résolus par SHA-256. Les fichiers déjà conservés et leurs empreintes sont ceux du [runbook COUV-05D](../COUV-05D/ACTIVATION.md).
3. Reproduire le paquet composite avec les preuves conservées. Les scripts n’effectuent aucune acquisition fournisseur.

```sh
PYTHONPATH=engine/src:scripts python scripts/couv05d_storage.py --output work/couv05e-store
python scripts/couv05e_package.py --store work/couv05e-store --output work/couv05e-candidate
```

Le SHA de l’index reproduit est `40cc3aebeb338f5cb63898f77a12680104749a7d9f67c27afc97810e5ec193c9`. Pour la recette HTTP locale, créer un certificat de boucle locale et lancer l’origine HTTPS suivante avec les accès Storage existants. L’origine lit les octets réels du candidat et délègue les lectures restantes au stockage privé existant.

```sh
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj /CN=127.0.0.1 \
  -addext subjectAltName=IP:127.0.0.1 -keyout /tmp/prev01.key -out /tmp/prev01.crt
node tests/e2e/prev01-sidecar-origin.mjs work/couv05e-candidate /tmp/prev01.key /tmp/prev01.crt
```

Démarrer un second processus Next avec `NODE_EXTRA_CA_CERTS=/tmp/prev01.crt`, `NEXT_PUBLIC_SUPABASE_URL=https://127.0.0.1:3443` côté serveur, et remplacer le pin du 14 novembre par celui du candidat. Garder l’origine de stockage privée habituelle lors du build. La recette utilise les vraies routes Next et MapLibre.

## Promotion après qualification

La branche est exclue du déploiement Vercel automatique dans les deux configurations du dépôt. Pour un futur GO, faire vérifier les critères scientifiques, les parcours, les paramètres Vercel et les objectifs de performance sur un canari. Les deux index retenus ne suffisent pas à couvrir les nouveaux cycles. Le flux de qualification doit produire et vérifier l’index de chaque archive avant de l’ajouter aux cycles proposés. Pour un cycle absent, le rendu qualifié indique explicitement l’absence de preuve.

Avec autorisation d’écrire en privé, réunir le paquet local et les fichiers natifs conservés dans le même répertoire, puis préparer le plan existant `scripts/couv05_store.py --root … --index-sha256 … --budget-bytes …`. Inventorier les objets privés, appliquer les gardes du runbook et utiliser `--upload --retained-forecast-bytes …` uniquement lors de l’opération approuvée. Les blobs sont insérés avant l’index et relus par SHA. Les pointeurs d’archive restent immuables pendant l’opération.

Faire fusionner la PR manuellement après revue. Confirmer la cible et les variables côté serveur. Activer le rendu dans le canari, confirmer les contrôles du [bilan](FINAL_VERIFICATION.md), puis après autorisation appliquer ces mêmes variables à la cible publique et reconstruire pour le flag client. Vérifier l’origine et le commit actifs par HTTP et par navigateur. La présence d’un blob ou d’un build vert ne constitue pas une activation.

## Rollback indépendant

Redéployer la version antérieure ou remettre `COUV05_RENDER_ENABLED=false` côté serveur et `NEXT_PUBLIC_COUV04_RENDER_ENABLED` à sa valeur précédente, puis reconstruire Vercel. Conserver `NEXT_PUBLIC_COUV06_HISTORICAL_RENDER_ENABLED` à sa valeur active. Vérifier l’absence de transport natif dans la route prévisionnelle et le rendu ERA5 681/31/1 sur le cas de référence. Aucun objet privé ni bundle d’archive n’est à supprimer.
