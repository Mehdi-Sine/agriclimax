# Stockage réel et scénarios prudents

Mo = 1 000 000 octets ; KiB/MiB binaires. La taille physique inclut TOAST/FSM/VM.

| Incrément DEV du pilote | Table/TOAST | Index | Total (octets) |
|---|---:|---:|---:|
| pra_daily | 278528 | 155648 | 434176 |
| pra_batches | 278528 | 8192 | 286720 |
| pra_diagnostics | 212992 | 155648 | 368640 |

Delta pg_database_size : **1 097 728 octets** ; la somme des deltas des relations
est 1 089 536 octets, le reliquat physique est de 8 192 octets. DB finale 31,18 Mo.
Tuple daily moyen 474,59 octets, diagnostic 297,43 ; metadata compressée moyenne
2 181,89, maximum 2 500 octets. Les index et pages expliquent le reste.

## Extrapolation, pas une mesure nationale

Formule : PRA × jours × enveloppe daily, PRA × ceil(jours/7) × enveloppe batch,
et huit diagnostics par batch dans le scénario systématique. Enveloppes avec index :
**1 105 octets/jour, 5 106 octets/batch, 1 024 octets/diagnostic**.
Elles prennent au moins 30 % de marge sur le delta physique mesuré, ou le plancher
antérieur Task19 si plus prudent. La calibration sur seulement 73 lots inclut
les arrondis de pages ; elle ne garantit pas une loi linéaire.

Base commune prudente **63,99 Mo** : DEV pré-Task19 27,06 Mo + référence nationale
mesurée localement en Task19 14,93 Mo + réserve logs 2 Mo + croissance applicative
20 Mo. La référence nationale n’a pas été importée entièrement sur DEV. Cette
réserve complète est aussi utilisée pour 73 PRA, donc reste conservatrice.

| Scénario | Daily | Metadata | Diagnostics systématiques | Total complet | Sans nouveaux diagnostics systématiques |
|---|---:|---:|---:|---:|---:|
| 73 × 30 j | 2.42 Mo | 1.86 Mo | 2.99 Mo | 71.26 Mo | 68.64 Mo |
| 713 × 30 j | 23.64 Mo | 18.20 Mo | 29.20 Mo | 135.03 Mo | 106.20 Mo |
| 713 × 90 j | 70.91 Mo | 47.33 Mo | 75.93 Mo | 258.16 Mo | 182.59 Mo |

Le scénario minimisé **conserve les 584 diagnostics déjà persistés** (0,37 Mo de
delta), puis calcule à la demande sans nouvelle matrice systématique. Aucune purge.
Les éditions multiples, productions/paramètres supplémentaires et croissance v0.2
au-delà de la réserve nécessitent un nouveau budget. Le chiffre antérieur 246,92 /
170,99 Mo était un autre scénario ; les nouvelles mesures donnent **258,16 /
182,59 Mo à 90 jours**, avec hypothèses et réserves ci-dessus.

## Free, cache et coûts hors PostgreSQL

[Prix Supabase officiels](https://supabase.com/pricing), relus le 29 octobre :
500 MB PostgreSQL/projet, CPU partagé et 500 MB RAM, 1 GB file Storage,
5 GB egress non caché et 5 GB cached egress. Ce sont des enveloppes distinctes ;
la disponibilité restante du compte et les autres usages ne sont pas prouvés ici.
Le quota DB est une [règle de facturation](https://supabase.com/docs/guides/platform/manage-your-usage/database-size),
pas une garantie de bascule immédiate en lecture seule. Arrêt applicatif à 375 Mo,
alertes 300/375/450 Mo. Free peut être mis en pause après une semaine d’inactivité ;
pas de sauvegarde automatique comprise. Aucun upgrade ni abonnement activé.

Les 6,51 Mo horaires et les tuiles compactes restent sur le disque opérateur,
hors PostgreSQL et hors Supabase Storage. Ne pas additionner le quota Storage au
quota DB. La rétention 90 jours est un horizon de planification ; aucun purgeur
automatique n’est installé. Sans politique d’archivage et décision explicite,
l’accumulation indéfinie ne tient pas sur Free.

Recommandation Free : scalaires partagés + provenance/checkpoints conservés,
diagnostics exploratoires calculés à la demande après ce pilote ; validation du
budget avant chaque fenêtre. Pas de données horaires en DB, pas de grille de
diagnostics multipliée par production/paramétrage.

## Projection acquisition/temps et plateformes

Le pilote utilise déjà 27/30 emprises nationales de 2°. Les 30 jours du plan
font 162 jobs logiques pour 73 PRA, 180 estimés pour 713 (fin de mois incluse).
À la latence moyenne observée de cet unique run, ordre de grandeur 3,5 h / 3,9 h
d’acquisition séquentielle, **aucun SLA**, file CDS et réessais variables. La surface
et les jours horaires téléchargés suggèrent environ 28,5 / 31,6 Mo NetCDF, estimation
par 35 jours sources cumulés contre huit au pilote et facteur 30/27 ; compression,
pluie et emprises manquantes peuvent fortement changer ce volume. Prévoir une
réserve disque et vérifier les octets réellement reçus, pas une promesse de coût.

L’agrégation/persistance croît avec les PRA ; approximation naïve issue de ce
pilote : cinq fenêtres ×20,53 s ×713/73 ≈ 1 003 s de persistance, à revalider.
L’acquisition a lieu chez l’opérateur, jamais dans une requête Vercel. Actions ne
lance aucun backfill national ni cron nouveau. Un éventuel job distant consommerait
plusieurs centaines de minutes ; quota Actions du dépôt privé et quota Vercel
restants non mesurés. Garder les artefacts bruts hors Actions et leur durabilité
sous responsabilité opérateur. Le déploiement web ajoute seulement des lectures
bornées, sans clé privilégiée dans le navigateur.
