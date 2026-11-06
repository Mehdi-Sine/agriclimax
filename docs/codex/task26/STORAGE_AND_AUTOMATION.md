# Stockage, restauration et automatisation DEV

## Mesures et budget

Postgres DEV existant :164271795 octets avant publication, garde375 Mo. Les tables historiques restent32136 lignes quotidiennes PRA,521916 normales quotidiennes et88412 lignes de normales historiques ; les publications météo/archives ne les modifient pas. Bucket privé existant après création explicite `pra-climate-archives` ; pas de grille brute, de nouveau schéma, rôle ou abonnement.

| Objet | Taille |
|---|---:|
|Cycle national713PRA, neuf journées/cinq variables/trois sources|562843 octets|
|ERA5 journée19octobre, archive exacte de716 enveloppes dont3anciens pilotes du20 conservés|258289 octets|
|ERA5 sept journées20–26octobre|474556 octets|
|ERA5 quatre journées27–30octobre|351528 octets|

Projection conservatrice : chaque journée ERA5 comme archive singleton258289B et un cycle météo562843B/jour, soit821132B/jour ;30jours=24633960B,365jours=299713180B,730jours=599426360B. Cela reste sous la garde objets900MiB(943718400B), distincte de la garde DB. Ce sont des projections mesurées, pas24 mois déjà acquis. Pas de suppression pour fabriquer cette capacité.

Politique préparée : fenêtre de consultation chaude90jours et conservation intégrale des blobs PRA/catalogue au moins24mois ; les données DB historiques actuelles sont gardées. L'API sait retrouver un cycle ancien par `run=YYYY-MM-DD` et les archives ERA5 via `storage=cold`. Aucun purgeur n'est activé. Le writer ERA5 existant continue à publier en DB : sa bascule incrémentale vers archive seule n'est pas validée, donc automatisation ERA5 non prête pour24mois sous375Mo.

## Intégrité et lecture

Archives immuables adressées par SHA256, stockage privé, décompression bornée32MiB, blob8MiB,100000 lignes maximum. Publication du catalogue seulement après lecture et restauration complètes. Aucun cycle incomplet ne remplace le précédent. La publication est sérialisée par la concurrence du workflow. Un seul reader cache le cycle par empreinte ; catalogueTTL15min pour borner la fréquence de lecture de son futur volume. Les réponses cartographiques météo sont limitées à713 lignes/date/variable (~1,06Mo maximal mesuré), historique PRA≤45. Pas de clé ni grille source dans le navigateur.

Le lecteur ERA5 vérifie aussi les empreintes des enveloppes exactes et convertit les nombres float64 archivés vers les mêmes représentations PostgreSQL float4 que l'API chaude, sans toucher aux octets archivés. Restauration locale2145 enveloppes identiques. Restauration DEV dans une table temporaire typée :2852 lignes,713PRA×4jours, différences dans les deux sens=0 ; aucune mutation des tables réelles. Lecture API chaude/froide :8556 lignes DTO identiques sur19/20/30octobre et quatre variables.

Rejeu national dédié `--mode replay` :49910 lignes restaurées et réencodées byte-identiques, deux GET Storage, zéro acquisition et zéro écriture. Transport `read_only=True` interdit toute requête nonGET avant envoi. `pra_weather_health.py` contrôle en lecture seule intégrité713PRA et âge≤36h ; rapport et sortie nonzéro si périmé. Santé réelle6novembre réussie. Les publications sont en outre bornées à l'hôte Supabase DEV connu.

## Limites fournisseurs et activation

Sources officielles consultées le6novembre2026 : [Supabase facturation](https://supabase.com/docs/guides/platform/billing-on-supabase), [egress Storage](https://supabase.com/docs/guides/storage/serving/bandwidth), [GitHub Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [Vercel payload](https://vercel.com/docs/functions/limitations).

Free Supabase :1Go d'objets,5Go egress noncaché et5Go caché ; notre accès privé n'est pas présumé bénéficier du cache public. La projection objets seule tient ; l'egress et les démarrages serverless dépendent du trafic et ne constituent pas une promesse de coût nul à trafic illimité. À730cycles, prévoir un catalogue de quelques centaines deKo :TTL15min réduit le coût par instance, sans prouver une limite globale multi-instance. Suivre le tableau d'usage avant activation.

GitHub Free :500Mo d'artefacts partagés selon compte, minutes standard publiques gratuites, quotas/conditions du compte à vérifier. Le checkpoint réel95,62Mo×7jours≈669Mo dépasserait500Mo si conservé quotidiennement, même sans les artefacts historiques. **Pas de cadence quotidienne activée.** Préparer une rétention future3jours(~287Mo) après validation du volume partagé, ou des checkpoints réduits ; ne supprimer aucun artefact existant sans autorisation. Une cadence30cycles/mois≈350minutes de calcul source hors installation, CI, health et Vercel. Aucun plafond n'est augmenté.

Le workflow existant propose dispatch explicite, autorisation nationale et `publish_dev=false` par défaut. Les checkpoints conservent les résultats acquis. Task12 est définitivement dispatch-only avec autorisation d'écriture DEV séparée ; les CI PR/push ne reçoivent aucune clé de sources réelles ni secret DB. Quality/Security restent actifs.

GitHub exécute les crons **sur la branche par défaut uniquement**. La branche dePR55 reste en draft ; aucune modification de main/merge/production autorisée. Health DEV est préparé mais désactivé tant que `PRA_WEATHER_DEV_HEALTH_ENABLED` n'est pas explicitement activé sur une version approuvée du workflow par défaut. L'acquisition nationale reste dispatch-only. Ne pas activer une variable pour contourner cette contrainte.

Opérations restantes : vérifier le budget Actions/egress réel du compte, valider le writer ERA5 archive-only et une nouvelle journée, décider la rétention future sans effacer l'existant, puis publier le workflow approuvé sur la branche par défaut dans une revue ultérieure, activer DEV et surveiller la première exécution. Désactivation immédiate par retrait du flag pour health ; aucune automatisation nationale active à arrêter aujourd'hui.

Contrôle final en lecture seule :DB164501171octets,Storage1648456octets/cinq objets,23580anciennes lignes et521916normales quotidiennes avec les mêmes empreintes queTask26. Les petites variations de taille physique DB ne constituent pas une nouvelle ingestion ; les lignes/empreintes scientifiques sont identiques. Preuve :operational-evidence/task26c-final-preservation.json.
