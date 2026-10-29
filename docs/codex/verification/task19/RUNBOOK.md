# Exploitation progressive — aucun lancement national automatique

Préconditions : Python 3.12, dépendances des lockfiles dev/climate/geo,
`PYTHONPATH=engine/src`. Licence CDS acceptée et CDSAPI_KEY configurée hors chat.
Aucun secret dans une commande, URL, capture ou fichier versionné.

## A. Référence officielle — paquet fourni, contrôles administratifs en attente

Le paquet `config/coverage/ofb-masa-pra-2017-snapshot-20261017/` est désormais
préparé et importé localement. Voir [le bilan courant](OFFICIAL_PRA_INTEGRATION.md).
Pour une nouvelle source : télécharger un export GeoJSON complet depuis la diffusion officielle citée dans
SOURCES.md. Inspecter champs, CRS, compte et versions, puis créer un mapping JSON
`code,name,department,department_name,region,region_name` → noms source réels.
Les codes doivent être des chaînes avec leurs zéros ; si la source n’a qu’un code
RA, adapter explicitement le code composite département/PRA après contrôle du
référentiel, jamais par supposition. Fournir une limite administrative officielle
indépendante pour le contrôle des trous et de la hiérarchie.

```sh
python scripts/pra_reference.py --input work/official-pra.geojson --fields work/official-field-map.json --source-url 'URL_OFFICIELLE_VERIFIEE' --source-name 'PRODUCTEUR_ET_DIFFUSEUR_VERIFIES' --source-version ofb-pra-2017 --source-crs EPSG:3857 --administrative-reference work/official-departments-wgs84.geojson --output work/pra-reference --sql-output work/pra-reference/import.sql
```

CRS 3857 ci-dessus est un **exemple**, à remplacer par le CRS réellement déclaré
par l’export. Ne pas changer un CRS pour simplement faire passer les tests.
Examiner manifest.json : compte réellement importé (attendu 713), Corse 2A/2B,
chevauchements, trous mesurés, surfaces, correspondances et checksums. Ne déclarer
la couverture géographique nationale qu’après résolution des écarts.
Le SQL généré est insert-only, à relire et appliquer uniquement dans une base de
test/staging autorisée après migration. Il n’est jamais exécuté par l’importeur.
Ne pas pointer vers production par défaut. Tester le rejeu sans duplication.

## B. Plan sans téléchargement ni écriture

```sh
python scripts/pra_climate.py --reference work/pra-reference/reference.json --weights work/pra-reference/weights.json --reference-version ofb-pra-2017 --dataset-version cds-snapshot-EXPLICITE --from 2026-09-01 --to 2026-09-30 --existing-db-bytes 24598195
```

Le nombre d’octets existants est une mesure d’audit datée, à réactualiser avant
lancement. Le plan calcule PRA, cellules, variables, lots, volumes source minimum,
lignes et croissance estimée. Pas de temps CDS ou de coût mensuel inventé.

## C. Pilote puis reprise bornée

Reproduire le pilote ERA5 de cette PR, explicitement sur boîtes non PRA :

```sh
python scripts/pra_real_pilot.py --date 2026-10-01 --dataset-version task19-cds-2026-10-17
python scripts/pra_real_pilot.py --date 2026-10-01 --dataset-version task19-cds-2026-10-17 --execute
```

La première commande est un plan, la seconde acquiert au plus quatre petites
requêtes, un jour source. Ni écriture distante ni couverture PRA déclarée.


Choisir les vrais IDs de quatre PRA contrastées dans la référence importée.
Exemple d’un ID à remplacer par un code réellement vérifié :

```sh
python scripts/pra_climate.py --reference work/pra-reference/reference.json --weights work/pra-reference/weights.json --reference-version ofb-pra-2017 --dataset-version cds-snapshot-EXPLICITE --from 2026-10-01 --to 2026-10-01 --pra pra:CODE_VERIFIE --execute --max-batches 1 --max-downloads 1 --root work/pra
```

Sans `--persist-supabase`, sorties locales uniquement. L’écriture distante nécessite
une migration/référence préalablement autorisées et l’option explicite
`--persist-supabase` ; ne pas l’activer sur production automatiquement.
Les paramètres blé ne sont pris en compte qu’avec `--parameters config/wheat-mvp.json`.
Chaque lot : une PRA × au plus sept jours ; 1–4 téléchargements max par appel,
1–4 lots actifs max en pilote ; jusqu’à 713 lots examinés sous autorisation nationale explicite, avec le même budget global de 1–4 nouveaux téléchargements par invocation. Les autres lots achevés sont rejoués sans acquisition.
Une interruption reprend le même root, les mêmes dates, référence et révision.
Conserver output/checkpoints et archives compactes ; checksums contrôlés avant
rejeu. Après write incertain, rejouer la même enveloppe : clé DB idempotente.
Pour source incomplète/révisée, utiliser une **nouvelle révision dataset** ; ne pas
modifier les fichiers sous le même checksum ou écraser une période publiée.

## D. Mécanisme national, à autoriser séparément

Planifier 30 jours d’abord, 90 optionnels. L’exécution sans --pra exige
`--national-authorized`, réservé à une autorisation distincte. Cet agent n’a pas
lancé cette option. Répéter les appels bornés jusqu’à fin de la liste déterministe ;
aucun fan-out non contrôlé. Un cache source local est partagé entre lots par tile/
requête, évitant les téléchargements identiques. Quota work 512 MiB (réserve 64 MiB) ;
arrêt explicite plutôt qu’effacement de données. Mesurer mémoire, files CDS,
runtime, egress et taille DB avant changement de budget.

Le workflow `pra-climate.yml` est **manuel uniquement**, concurrency 1,
30 min max, exécution 24 min, un lot pilote/un téléchargement par job par défaut. Sous autorisation nationale explicite, il examine les PRA en série, réutilise les tuiles compactes et garde un seul nouveau téléchargement global par job. Par défaut plan seul.
Il ne reçoit aucune clé Supabase et ne déploie aucun schéma. Le checkpoint d’un run
précédent peut être repris via artifact 7 jours ; fichiers horaires exclus.
Le répertoire de référence revu doit être placé sous config/coverage, puis renseigné
explicitement ; il n’est pas livré comme faux référentiel dans cette PR.
Après validation, un opérateur peut lancer ce même chemin pour chaque mise à jour
journalière incrémentale, date au moins cinq jours dans le passé. Pas de cron
national activé sans budget et autorisation. Le cron Météo-France existant est distinct.

## E. Rapport et rétention

Ajouter `--report` à la même commande pour JSON + Markdown : géographie, climat,
diagnostics, manquants, fraîcheur, échecs et stockage restent séparés. Les rapports
source/CI synthétiques ne sont jamais convertis en couverture nationale réelle.

`--retention-dry-run --retention-days 90` liste les candidats quotidiens Task19.
Aucune suppression n’est disponible/activée : revoir l’historique, les fenêtres de
calcul et l’archive/recalcul avant une future migration de rétention. Les anciens
snapshots/stations/climatologies v0.2 ne sont jamais candidats. Les statistiques
scientifiquement utiles à long terme et références restent indépendantes.
Les nouveaux logs opérationnels sont bornés à 100 runs, sans payload/secret.

Les .download temporaires sont retirés par le provider, y compris timeout ; ne
supprimer un cache vérifié qu’après export/recalcul vérifié et revue des reçus.
Une archive externe compressée est facultative : aucun service payant activé.
Les artifacts Actions sont temporaires, pas une archive climatique pérenne.

## F. Frontend / APIs

`/territories` : recherche département/PRA, sélection et statistiques descriptives
réanalyse ; absence de référentiel/données explicite, retour vers les parcours station.
Variables serveur optionnelles PRA_REFERENCE_VERSION / PRA_DATASET_VERSION uniquement
après staging validé ; pas de bulk dans les requêtes web.

- `/api/territories?action=lookup&reference=VERSION&department=2A`
- `/api/territories?action=read&reference=VERSION&dataset=REVISION&date=2026-10-01&scope=france`
- `/api/territories/diagnostics?reference=VERSION&dataset=REVISION&pra=pra:CODE&start=2026-10-01&end=2026-10-07&parameters=FINGERPRINT_SHA256`

PRA/département/région/France sont des scopes de lecture paginée, pas des moyennes
administratives préfabriquées. Aucun résultat zéro n’est déduit d’une absence.

## G. Rejouer le staging réel Task19, uniquement local

Depuis la racine, après installation des lockfiles et avec `PYTHONPATH=engine/src` :

```sh
python scripts/pra_reference_sql.py --bundle config/coverage/ofb-masa-pra-2017-snapshot-20261017 --output work/task19/official/reference/import.sql
bash tests/e2e/pra_local_setup.sh
```

Le setup refuse de remplacer un conteneur existant du même nom. Appliquer le SQL
uniquement via `docker --host=unix:///var/run/docker.sock exec` dans
`agriclimax-task19-official`, base `agriclimax_task19`, jamais une URL distante.
Le montage du dépôt est en lecture seule dans le conteneur. Les fonctions utilisent
le rôle `service_role` local, sans credential Supabase réel.

Le pilote utilise `scripts/pra_climate.py` avec les quatre options `--pra`
`pra:05236`, `pra:28341`, `pra:29102`, `pra:2B260`, les dates 2026-10-01/07,
`--parameters config/wheat-mvp.json`, `--max-batches 4 --max-downloads 4`,
`--root work/task19/official/pilot`, `--execute` et **sans** `--persist-supabase`
ni `--national-authorized`. Les caches et enveloppes sont conservés sous ce root.
`tests/e2e/pra_stage_local.py` importe ces enveloppes dans le seul conteneur local.

Pour vérifier des caches existants sans acquisition :

```sh
python scripts/pra_validate_pilot.py --root work/task19/official/pilot --weights work/task19/official/pilot-weights.json --reference work/task19/official/pilot-reference.json --parameters config/wheat-mvp.json --output work/task19/official/pilot-evidence.json
```

Les deux fichiers pilotes se construisent par sélection des quatre IDs et de
leurs poids depuis le paquet complet ; les 89 intersections doivent être identiques.
Les NetCDF restent privés dans work ; aucun fichier horaire n’est importé en DB.

Pour l’UI réelle locale : générer un certificat local avec SAN `IP:127.0.0.1`,
démarrer `tests/e2e/pra_postgis_bridge.py --certificate CHEMIN_CERT --key CHEMIN_CLE`
(port fixe 9443, trois RPC en lecture seule), puis Next sur 3019 avec
`NEXT_PUBLIC_SUPABASE_URL=https://127.0.0.1:9443`, clé de test locale
`SUPABASE_SECRET_KEY=task19-local-only` et `NODE_EXTRA_CA_CERTS=CHEMIN_CERT`.
Cette chaîne est une identité de test publique, pas un secret de service réel.
`node tests/e2e/territories-real.mjs` vérifie les valeurs et produit ses captures.
Aucune protection TLS, privilège ou configuration Vercel n’est désactivé.
