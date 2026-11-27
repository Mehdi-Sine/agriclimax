# OPTI-01 · Audit du 27 novembre 2026

Base GitHub `aeddc9df4dd2f0a8f29f624bd2ebcf91ac763aac`, merge EDIT-09 #117. L’état opérationnel du 27 a été contrôlé séparément en lecture seule sur le projet `agriclimax-dev`, PostgreSQL 17 en `eu-west-1`. Toutes les estimations utilisent des unités décimales, sauf mention contraire.

## Facturation et trace de transfert

L’alerte Acta communique **13,44 Go cached**, un seuil de **5,5 Go** et l’échéance du **29 novembre**. Le barème public Free affiche deux enveloppes distinctes de 5 Go, une pour le cached et l’autre pour l’uncached. Conserver le seuil du courrier pour le traitement de l’alerte. Le connecteur recense deux projets dans la même organisation, Climacta actif et Agent Emplois inactif. La requête Storage sur Agent Emplois renvoie zéro ligne durant la dernière fenêtre. Les 2 195 lignes edge de la dernière fenêtre ne contiennent aucun code 402 ni 503. Le cumul mensuel, la période exacte et la part de chaque projet restent à rapprocher de l’export Usage d’Acta. [Supabase Egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress) · [Tarifs Supabase](https://supabase.com/pricing)

Logs edge de 08 h UTC à 08 h UTC. Agrégation des réponses GET Storage `200/206` par `Content-Length`, sans URL signée, adresse IP ni identité client. Le total est une mesure d’octets déclarés dans les réponses observées. Les tailles zéro sont comptées séparément. Les lignes origin Storage servent à vérifier les opérations, sans les ajouter aux réponses edge.

| Fenêtre UTC | GET HIT | Octets HIT | GET MISS | Octets MISS |
|---|---:|---:|---:|---:|
| 24 → 25 novembre | 1 959 | 1 981 540 079 | 62 | 35 302 193 |
| 25 → 26 novembre | 1 230 | 1 626 398 090 | 99 | 87 113 021 |
| 26 → 27 novembre | 1 123 | 1 542 712 597 | 42 | 20 465 317 |
| Trois fenêtres | 4 312 | 5 150 650 766 | 203 | 142 880 531 |

| Famille, fenêtre 26 → 27 | GET HIT | Octets HIT | GET MISS | Octets MISS |
|---|---:|---:|---:|---:|
| `edition-maps` | 983 | 1 510 301 514 | 8 | 12 518 031 |
| `era5` | 81 | 19 599 650 | 17 | 4 135 194 |
| `editorial-inputs` | 5 | 5 374 343 | 2 | 2 149 886 |
| `weather` | 7 | 3 839 017 | 1 | 546 867 |
| `support` | 20 | 3 171 870 | 6 | 1 048 623 |
| `catalogue.json` | 14 | 342 937 | 2 | 49 684 |
| `candidates` | 2 | 59 666 | 0 | 0 |
| `forecast-native` | 6 | 13 239 | 2 | 4 413 |
| `current.json` | 5 | 10 361 | 2 | 4 150 |
| `catalogues` | 0 | 0 | 2 | 8 469 |

Le 27, **1 510 301 514 o sur 1 542 712 597 o HIT (97,9 %)** proviennent d’`edition-maps`. Le 26, cette famille représente 1 601 150 802 o HIT (98,4 %). Les journaux du 27 montrent 801 023 952 o de GET HIT Node sur les blobs de cartes entre 04 h et 05 h UTC et 471 628 939 o l’heure suivante. Cinq blobs de 6,33 Mo ont chacun été lus 31 fois. Plusieurs autres éditions ont exactement 31 lectures durant la même fenêtre. Dans le code de référence, la liste d’archives et la route de vignette passent par `operationalEditions()` et chargent des bundles complets pour vérifier les révisions. Le cache de décodage contient trois bundles alors que le registre parcourt jusqu’à soixante identifiants. Le motif est compatible avec des parcours répétés du catalogue. Les plages horaires, l’agent Node et les chemins ne distinguent pas une instance de production d’une preview ou d’un script.

Le 27, les inputs gelés et ERA5, candidats pour les acquisitions et reprises, représentent 5,37 et 19,60 Mo HIT respectivement. L’action watchdog apparaît comme tâche `pg_cron` active toutes les 15 minutes. La liste des Edge Functions du projet est vide. Les trois échecs d’acquisition prévision et la relance ERA5 sont visibles dans le registre, avec la qualification finale du dossier. Les masques prévisionnels sont volumineux sur disque. `forecast-native` représente environ 13 ko HIT, et la famille racine `forecast-masks` n’apparaît pas sur cette fenêtre. Les archives d’articles sont lues via RPC PostgREST, hors du tableau Storage. Les transferts GitHub d’artifacts et les transferts amont météo sont sur des canaux distincts.

### Du 1er au 27 novembre

Les 26 fenêtres UTC de 24 h entre le 1er novembre 08 h et le 27 novembre 08 h cumulent **22 770 840 272 o HIT** et **1 173 162 919 o MISS** sur les GET Storage publics ou authentifiés en succès. Leur rapprochement avec l’alerte à 13,44 Go exige les bornes exactes du relevé de facturation et la définition du compteur. Le résultat des logs dépasse le chiffre de l’alerte. L’imputation détaillée des 13,44 Go reste ouverte.

| Famille | GET HIT | Octets HIT | GET MISS | Octets MISS |
|---|---:|---:|---:|---:|
| `edition-maps` | 19 526 | 16 210 301 242 | 152 | 197 228 845 |
| `forecast-masks` | 7 565 | 4 761 906 412 | 1 087 | 545 666 687 |
| `era5` | 2 068 | 557 441 525 | 203 | 54 504 152 |
| `support` | 3 225 | 517 477 853 | 112 | 16 981 356 |
| `weather` | 698 | 391 648 579 | 54 | 30 265 811 |
| `editorial-inputs` | 68 | 302 568 654 | 33 | 144 406 571 |
| `forecast-native` | 150 | 17 761 643 | 293 | 182 485 753 |
| `current.json` | 3 324 | 5 744 424 | 73 | 135 969 |
| `catalogue.json` | 536 | 5 415 461 | 85 | 1 006 074 |
| `candidates` | 44 | 523 360 | 23 | 345 493 |
| `catalogues` | 19 | 51 119 | 49 | 136 208 |

Les cartes d’édition représentent **71,2 %** des octets HIT sur cette fenêtre et les masques de prévision à la racine **20,9 %**. Ensemble, ces deux familles représentent **92,1 %**. Les masques ont une charge historique importante et sont presque absents lors des deux dernières fenêtres. Garder les deux profils pour la qualification. Une suppression théorique de toutes les lectures de cartes d’édition laisserait **6,56 Go HIT** sur ce relevé élargi. La seule projection du Journal ne démontre donc pas la cible mensuelle de 3 Go. Dans un scénario où les transferts Supabase des deux familles seraient entièrement évités, le solde observé serait de 1,80 Go sur 26 jours, soit 2,08 Go extrapolés sur 30 jours à charge constante. Cette borne ignore les nouveaux transferts et les profils de fréquentation futurs.

Sur le second projet, les 26 fenêtres contiennent 351 requêtes edge GET 200/206, avec zéro octet de réponse Storage HIT ou MISS exploitable et zéro octet déclaré HIT sur les autres services. Ce résultat est limité aux journaux et aux filtres employés. L’état et le compteur de facturation du projet restent à rapprocher dans Usage/Billing.

### Vingt chemins classés par transfert

Fenêtre 26 → 27 novembre. Les clés complètes sont identifiables dans l’inventaire privé par le préfixe SHA-256.

| Rang | Clé dans le bucket | GET | Octets | Octets HIT |
|---:|---|---:|---:|---:|
| 1 | `edition-maps/blobs/5e107223e33f….json.gz` | 31 | 196 285 180 | 196 285 180 |
| 2 | `edition-maps/blobs/d16751663d04….json.gz` | 31 | 196 270 548 | 196 270 548 |
| 3 | `edition-maps/blobs/e725177f6ad1….json.gz` | 31 | 196 262 054 | 196 262 054 |
| 4 | `edition-maps/blobs/581e9623a739….json.gz` | 31 | 196 258 427 | 196 258 427 |
| 5 | `edition-maps/blobs/e71fb602c865….json.gz` | 31 | 196 248 166 | 196 248 166 |
| 6 | `edition-maps/blobs/a12160d80687….json.gz` | 10 | 63 309 490 | 56 978 541 |
| 7 | `edition-maps/blobs/45751bc69a16….json.gz` | 31 | 48 192 352 | 48 192 352 |
| 8 | `edition-maps/blobs/847bd3cb4f2e….json.gz` | 31 | 48 010 568 | 46 461 840 |
| 9 | `edition-maps/blobs/4df411b80446….json.gz` | 31 | 47 956 318 | 46 409 340 |
| 10 | `edition-maps/blobs/1de1e4932e4c….json.gz` | 31 | 47 896 674 | 47 896 674 |
| 11 | `edition-maps/blobs/c6a3e10fcb77….json.gz` | 31 | 47 894 721 | 46 349 730 |
| 12 | `edition-maps/blobs/e2028dd93a2a….json.gz` | 31 | 47 884 615 | 47 884 615 |
| 13 | `edition-maps/blobs/9a3a6cf010fa….json.gz` | 31 | 47 880 492 | 47 880 492 |
| 14 | `edition-maps/blobs/57ab0998801f….json.gz` | 31 | 47 878 105 | 47 878 105 |
| 15 | `edition-maps/blobs/92716002fa05….json.gz` | 31 | 47 872 370 | 46 328 100 |
| 16 | `edition-maps/blobs/4846f2c46609….json.gz` | 30 | 46 354 980 | 46 354 980 |
| 17 | `support/0b13908a0de9….json.gz` | 4 | 3 933 504 | 2 950 128 |
| 18 | `weather/8856d2d69b98….json.gz` | 6 | 3 281 202 | 2 734 335 |
| 19 | `editorial-inputs/6c251da78a21….json.gz` | 3 | 3 223 989 | 2 149 326 |
| 20 | `editorial-inputs/89f3518e629d….json.gz` | 2 | 2 150 446 | 1 075 223 |

### Rejouer l’agrégation

Supabase Logs Explorer ou outil `query_logs`, une fenêtre UTC de 24 heures par appel. Pour des séries comparables, exporter aussi méthode, statut et services hors Storage, joindre les IDs de requête dans un espace privé et marquer le client (production, preview, job, recette). Rapprocher les séries de l’export de facturation du compte. La journalisation du CDN et de l’origine ne doit compter chaque réponse qu’une fois.

```sql
SELECT if(arrayElement(seg,5)='authenticated',arrayElement(seg,7),arrayElement(seg,6)) AS family,cache,count() AS n,sum(bytes) AS volume,countIf(bytes=0) AS missing
FROM (SELECT splitByChar('/',log_attributes['request.path']) AS seg,upper(toString(log_attributes['response.headers.cf_cache_status'])) AS cache,toUInt64OrZero(toString(log_attributes['response.headers.content_length'])) AS bytes
FROM logs
WHERE source='edge_logs' AND log_attributes['request.method']='GET' AND toString(log_attributes['response.status_code']) IN ('200','206') AND startsWith(log_attributes['request.path'],'/storage/v1/object/')) AS x
GROUP BY family,cache ORDER BY volume DESC
```

## PostgreSQL et Vercel

`pg_database_size` confirme **201 414 323 o**, 97 tables visibles dans les statistiques, dont 45 dans `agriclimax_private` (171 843 584 o). Les plus grosses relations privées sont `pra_climatology_daily` (51,74 Mo), `pra_daily` (29,81), `climate_references` (15,35), `pra_batches` (15,23), `pra_climatology_normals` (12,73), `pra_territories` (11,42), `editorial_diagnostics` (7,15) et `editorial_archives` (6,12). TOAST totalise notamment 9,79 Mo dans les territoires, 6,97 dans les batches, 6,64 dans les diagnostics et 6,09 dans les archives. Le projet a 713 PRA et PostGIS 3.3.7.

`pra_daily_date_idx` (7,00 Mo et 47 480 scans) et la PK (6,34 Mo et 545 197 scans) ont des ordres différents, adaptés au parcours par date et par PRA. La PK de climatologie quotidienne a 4,32 millions de scans. `pra_climatology_support_geo_idx` affiche zéro scan et 114 688 o. C’est une piste à vérifier sur une période représentative, de même que les petits index de recherche et de release. Préserver les contraintes uniques, notamment `editorial_one_active_attempt_per_date`. Observer les opérations rares, les dépendances de contraintes et les plans via `EXPLAIN` sur le clone. Aucun index ou géométrie à modifier sur ces seules mesures. Les mesures agrégées `pg_stat_statements` montrent des requêtes répétées jusqu’à 30 876 appels et une moyenne maximale de 1 012 ms parmi les plus coûteuses en temps cumulé à volume significatif. Les compteurs sont cumulatifs et nécessitent des deltas par fenêtre. Les octets TOAST des copies JSON/texte ne suffisent pas à conclure à une duplication sémantique. L’archive texte vérifie les octets historiques.

L’alerte Vercel Function Storage de 10 Go concerne une métrique distincte de la bande passante Supabase et des octets JS livrés au navigateur. EDIT-09 relevait 68,82 Mo de traces serveur pour le Journal et 40,05 Mo pour Cartes du jour, avant compression. Les traces d’un build peuvent partager des fichiers ou être dupliquées par le packaging du fournisseur. GitHub liste 458 déploiements déclarés dans son environnement Preview, dont 302 créés depuis le 1er novembre et 29 depuis le 20 novembre. Il s’agit d’un historique de déclarations. Relever dans Vercel les déploiements effectivement conservés, leurs octets par fonction et les dates de rétention avant de chiffrer le gain agrégé. [Mesures EDIT-09](../EDIT-09/README.md)
