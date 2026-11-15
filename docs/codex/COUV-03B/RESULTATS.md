# COUV-03B — Résultat : PARTIAL

Recette du 15 novembre 2026 UTC sur `main` **98a972f**, intégrant #92 et #94.
**La collecte réelle fonctionne ; l'activation quotidienne distante n'est pas
réalisée.** Les API GitHub de lecture et de modification des variables retournent
`403 Resource not accessible by integration`. La valeur distante du flag demeure
inconnue. Aucun workflow n'a été déclenché et aucun merge n'est réalisé.

## Configuration vérifiée

`operational-journal.yml` comporte déjà une étape canari exclusivement sur la
branche `era5` de la matrice d'acquisition, avec la condition exacte
`vars.AGRICLIMAX_SIM_CANDIDATE_ENABLED == 'true'`. L'étape est non bloquante,
limitée à 2 minutes, le collecteur à 115 s et 4 Gio d'espace d'adressage. Le job
passe de 26 à 28 minutes lorsque le flag est actif. Le canari réutilise les
checkpoints ERA et leur artifact `t36-era5-checkpoints`, rétention **3 jours**.
La reprise parcourt les 20 derniers runs de la même branche ; elle n'est donc
pas une garantie de conservation durable. Le magasin local retient au plus
730 dates, deux révisions par date, 16 Mio. Pas de nouveau cron.

`couv03_collect.py` sélectionne les **32 PRA** dont le support ERA gelé COUV-02
est inférieur à 90 %, soit 807 cellules SIM contributrices. Ce sous-ensemble
n'est pas un inventaire exhaustif de toutes les PRA littorales. L'adaptateur
conserve cinq variables distinctes ; les résultats demandés ci-dessous portent
sur Tmoy et précipitations. Les lecteurs restent opt-in (`enabled=False`),
`indicator_eligible=false` et `journal_eligible=false`.

## Première collecte réelle

Reçu complet : `evidence/first-collect.json`. Acquisition réelle le
**2026-11-15T09:09:44Z**, aucune donnée simulée ou recopie du dernier jour.

| Contrôle | Observation |
| --- | --- |
| Fenêtre demandée | 8–14 novembre 2026 inclus |
| Dates constatées dans le Parquet courant | 15 septembre–13 novembre 2026 |
| Dates réduites et stockées | 8–13 novembre, six journées |
| Date absente | 14 novembre ; retard constaté J−2, pas J−1 |
| Tmoy | 32/32 PRA par date, 192/192 PRA-jours utilisables au seuil 90 % |
| Pluie | 32/32 PRA par date, 192/192 PRA-jours utilisables au seuil 90 % |
| Couverture minimale Tmoy/pluie | 96,5047116 % de surface ; complétude temporelle 100 % |
| Tmoy, plage des moyennes sur support représenté | 4,8847–20,6896 °C |
| Pluie, plage des cumuls sur support représenté | 0–72,5497 mm |
| Durée acquisition + réduction | 19,382 s ; réduction 3,202 s |
| Mémoire maximale du processus | 125 132 Kio de RSS |
| Réseau première collecte | 6 appels, 12 207 830 octets, dont Parquet 11 168 324 octets |
| Résultats | 960 lignes natives : 32 PRA × 6 jours × 5 variables ; 384 lignes Tmoy/pluie |
| Blobs quotidiens compressés | 25 852 octets, six objets |
| Checkpoint persistant | 3 976 octets de manifeste en plus des blobs |

La matrice `evidence/coverage.csv` donne chaque PRA/date/variable, valeur sur la
surface représentée, fraction, période, état, méthode, support et provenance.
Le résumé est dans `evidence/coverage-summary.json`. À Crozon comme pour chaque
PRA ciblée, le statut reste descriptif et exploratoire : aucune validation de
microclimat littoral n'est déduite de la couverture géométrique. Les diagnostics
`coastal_representativeness_not_independently_validated` et, selon les supports,
`incomplete_spatial_support` sont conservés. Une couverture à 96,5 % ne devient
pas une valeur sur 100 % de la PRA.

**713/713 est le résultat historique antérieur, pas un résultat quotidien acquis
ici.** Aucune qualification nationale quotidienne n'a été refaite ; les 681 PRA
restantes ne sont pas contrôlées par cette collecte. Un seul état indépendant de
la source est observé. Six dates dans le même fichier ne valent pas six cycles.

Une deuxième invocation réelle (`evidence/second-collect.json`) constate la même
source : 1 appel catalogue, 118 735 octets, 1,689 s, **zéro nouvelle révision** et
aucun téléchargement Parquet répété. Ce contrôle vérifie la reprise incrémentale,
pas une deuxième mise à jour quotidienne indépendante.

## Provenance et limites temporelles

Données Météo-France, modèle SAFRAN-ISBA, nature analyse. Le transport effectivement
lu est le **Parquet médié data.gouv**, ressource `QUOT_SIM2_latest`, identifié par
URL, date, ETag, taille et SHA-256 dans le reçu. La date de mise à jour fournisseur
est le 14 novembre à 08:03:24 UTC ; le Parquet est daté du 14 novembre à 09:31:13 UTC.
Ces dates de fichier ne sont pas la dernière date climatique (13 novembre).
Aucune équivalence octet par octet avec le gzip national courant n'est prétendue.

SHA-256 source : `a05d7fb9222e0c919fd5c7e32e99a3b3a5f1465b38edbe670897dadef9bef85c`.
Support gelé COUV-01/02 :
`5efd4b6b81bbc11ada8bc0fba3b27db3b9f38c8c3c82f542e8830b73fa5e4a32`.
Méthode native `sim-pra-area-3035-1.0.0`, qualification descriptive
`couv02-descriptive-support-90-1.0.0`. Les empreintes de grille officielle et de
référentiel PRA sont vérifiées par le collecteur avant calcul.
Tmoy : `]00UTC-00UTC]`, °C ; pluie liquide + solide : `]06UTC-06UTC]`, mm.
Ces journées gardent leurs conventions SIM ; aucun mélange avec les journées ERA.

## Stockage persistant préparé et testé

Le bucket **privé existant** `pra-climate-archives` est réutilisé exclusivement
sous `candidates/safran-sim/v1/`. Aucune nouvelle infrastructure, table, migration,
politique d'accès, catalogue publié, suppression ou grille brute conservée.

`scripts/couv03b_checkpoint.py` sauvegarde les blobs immuables par SHA-256 puis
un manifeste candidat immuable ; la restauration demande son empreinte explicite
et un nouveau répertoire. Les tailles et empreintes sont vérifiées, les liens
symboliques refusés ; une restauration corrompue ne remplace pas le checkpoint
local. Il n'existe aucun pointeur candidat branché sur les cartes ou le Journal.

La recette distante réelle a écrit **7 objets** : six blobs et un manifeste,
29 828 octets au total. La relecture distante et la restauration ont réussi ;
index et rapport correspondent exactement à la première collecte. Les reçus
`storage-before.json`, `storage-save.json`, `storage-restore.json` et
`storage-after.json` documentent cette opération.

Checkpoint : `420ae816f19d6d18d506c9dc5915995eddf592552891f35806f062dafb777faf`.
Le script est **manuel, pas raccordé au cycle quotidien** dans cette PR. Il prépare
une reprise durable indépendante de la rétention Actions, sans prétendre que
chaque futur cycle sera automatiquement persisté. Conserver les reçus hors
Actions. Avant raccordement durable, prévoir un seul écrivain et une politique
bornée de rétention des anciens manifestes/blobs candidats, avec budget partagé :
le budget local 16 Mio ne limite pas à lui seul l'accumulation distante.
Les objets publiés ne doivent jamais être purgés par cette politique.

## Coût

Aucun appel OpenAI et aucune nouvelle ressource facturable créée. Les sources
publiques ne nécessitent pas de secret SIM. Le transfert et le stockage réellement
mesurés figurent ci-dessus ; aucune facture fournisseur ou GitHub n'est accessible
ici, donc **aucun coût monétaire nul ou exact n'est affirmé**. Le job Actions n'a
pas été exécuté : sa durée facturable n'est pas mesurée (installation incluse dans
les 2 minutes du canari). À source renouvelée, prévoir environ 12,2 Mo/jour,
soit ~366 Mo/30 jours si le format reste comparable. Les cinq variables ciblées
produisent environ 4,3 ko compressés/jour dans cet échantillon ; le transport
national demeure temporaire. Surveiller taille Parquet ≤16 Mio, consommation du
bucket, anciennes révisions et facturation réelle avant pérennisation.

## Isolation et non-régression

Aucune modification des workflows, du snapshot, du code web, des cartes, du
Journal, des indicateurs, légendes ou archives publiées. Les seuls ajouts sont
les outils manuels de recette/persistance, les preuves, tests et documentation.
Les empreintes distantes de `catalogue.json` et `current.json` sont identiques
avant/après (`storage-after.json`). Le transport n'appelle aucune méthode de
publication ni RPC DB : ses écritures sont limitées au préfixe candidat.

Les contrôles automatisés et leurs résultats sont dans `VERIFICATION.md`.

## Décision quotidienne et conditions

**PARTIAL** : acquisition réelle et reprise démontrées, couverture des 32 cibles
satisfaisante sur six dates, persistance manuelle réelle vérifiée. **Pas de GO
pour J−1 garanti, activation distante non réalisée, ni publication.**

Pour une activation quotidienne durable, il reste à :

1. Faire définir le flag par un administrateur (voir `ACTIVATION.md`). Observer
   les vrais cycles ERA sans relancer le pipeline éditorial pour les besoins SIM.
2. Observer au moins **sept mises à jour quotidiennes distinctes** au créneau
   opérationnel : délais, révisions, disponibilité du Parquet, temps incluant
   installation, volumes, coûts et absence d'impact ERA/Journal.
3. Accepter explicitement les dates SIM effectivement disponibles ou rester
   indisponible ; ne jamais transformer J−2 en J−1 ni reporter une valeur.
4. Raccorder et tester la persistance/reprise candidat avec un écrivain unique,
   budget et rétention distants, y compris après >3 jours d'interruption.
5. Maintenir les deux éligibilités à `false`. Toute intégration publique requiert
   une décision séparée sur source, périodes, datum, représentativité littorale
   et références scientifiques ; le canari n'autorise aucun indicateur hybride.
