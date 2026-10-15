# Task 15 — stratégie France métropolitaine

## Inspection avant écriture

Travail démarré depuis `main` c255e22, worktree séparé, branche
`codex/15-france-coverage`, identité Mehdi-Sine / mehdi.sine@acta.asso.fr.
Avant modification, inspection du schéma et des volumes de `agriclimax-dev`
(`yyfbpecxvxglzxopsmel`) par SQL en lecture seule : **21 870 259 octets**, cinq
stations, 190 lots météo, 480 références climatiques. Tables Task11 :
`weather_stations`, `station_weather_batches`, PK station/source/date. Tables
Task12 : `climate_references` et `climate_indicators`, clés de contenu et index
version/maille/date. Les 480 références correspondent à 60 partitions logiques
(20 mailles × 3 dates), avec huit révisions ; elles restent conservées.
Le payload climatique moyen compressé PostgreSQL est de 1 692 octets.

Stratégie annoncée avant écriture : grille native, acquisition par tuiles,
archives hors Postgres, valeurs quotidiennes compactes et références suffisantes,
stations ponctuelles séparées, quotas et reprise. L'hypothèse initiale de
200–320 octets/ligne a ensuite été **révisée après mesure** à 400–650 octets,
index compris. La rétention initialement envisagée de 90 jours est ramenée à 30.
Aucun historique massif ni nouvelle ressource payante n'a été lancé.

## Volumes et coût

Masque Natural Earth versionné dans `config/coverage/`, centres dans le polygone,
Corse incluse, outre-mer exclu. Pas de rééchantillonnage : grille CDS ERA5-Land
0,1° (résolution native du modèle environ 9 km). Frontières/côtes : règle du
centre, pas une affirmation sur la présence agricole dans chaque maille.

| Objet | Volume |
| --- | ---: |
| Centres métropolitains | 6 429 |
| Tuiles d'acquisition de 1° | 93 |
| Lignes quotidiennes compactes/jour | 6 429 |
| Valeurs de variables/jour | 25 716 |
| Lignes/an, 365 jours | 2 346 585 |
| DB/an, 400–650 octets/ligne | 0,94–1,53 Go décimaux |
| Fenêtre SQL de 30 jours | 192 870 lignes ; 77–125 Mo |
| Source horaire 2 variables float32/an, hors compression/masque/coordonnées | 450,5 Mo |
| Source horaire 30 ans, même hypothèse | environ 13,5 Go |
| Références calendaires, 366 jours, 4 variables par ligne | 2 353 014 lignes |
| Références SQL actives : budget d'exploitation | 50 000 lignes maximum |

Mesure locale : 45 004 lignes, 19 570 688 octets, **434 octets/ligne** avec les
index. Les petits essais, le remplissage des pages, les quality_flags, le WAL,
les révisions, les backups et le bloat font varier le volume ; prévoir une marge.
Le plan est **Free**, confirmé par le connecteur d'organisation. La limite de
base Free de 500 Mo interdit de charger une année nationale entière dans ce
schéma. Garder environ 77–125 Mo de données récentes, les petites références de
zones demandées et les métadonnées est compatible avec ce premier budget, sous
surveillance du total de la base et des autres fonctionnalités.

Prix documentés Supabase consultés le 15 octobre 2026 :
[disque gp3](https://supabase.com/docs/guides/platform/manage-your-usage/disk-size)
0,125 USD/Go/mois au-delà des 8 Go provisionnés inclus sur Pro ;
[stockage objet](https://supabase.com/docs/guides/storage/pricing)
0,0213 USD/Go/mois au-delà du quota (Free 1 Go, Pro 100 Go).
Ce sont des prix de stockage, hors abonnement/compute/egress/taxes. Une archive
horaire de 13,5 Go ne rentre pas dans le quota objet Free ; sa valeur de stockage
au tarif marginal serait environ 0,29 USD/mois, mais il faut un plan/fournisseur
adapté. Aucune souscription ni dépense nouvelle n'a été engagée.
Trente années quotidiennes en SQL représenteraient environ 28–46 Go avant marges :
ce n'est pas le choix retenu. Le coût dépend du disque provisionné, pas seulement
des octets utiles ; un abonnement Pro éventuel serait une décision séparée.

## Organisation du stockage

- Cache source : NetCDF adressés par SHA256 + reçus de requête immuables, jamais
  des NetCDF dans Postgres. Conserver une racine durable via `--root`, puis
  mirrorer les objets et vérifier les empreintes avant d'enlever une copie locale.
- Archive quotidienne : JSON gzip déterministe, valeurs compactes et métadonnées
  communes stockées une fois par tuile. Les séries historiques et échantillons
  pour ECDF/fenêtres homologues restent dans ces archives/cache objet.
- SQL : `france_acquisitions` partage les métadonnées d'un lot ; `france_daily`
  contient les quatre valeurs utiles, nulls et quality_flags. Clé naturelle
  version/maille/date. Les corrections de valeurs exigent une nouvelle version.
- `france_calendar_references` prépare un cache de normales et p10/p50/p90 :
  quatre variables dans des tableaux d'ordre documenté, nombres d'années et
  empreinte d'archive. Préparation hors ligne, pas de chargement national automatique.
  Conserver ce cache SQL aux zones actives (budget 50 000 lignes) ; les autres
  références préparées restent en objet. La table est encore vide.

Variables ERA5 actuelles : Tmin, Tmax, moyenne quotidienne UTC et précipitation.
L'agrégation de Task12, dont le cumul pluie à 00 UTC le jour suivant, est conservée.
Aucune humidité ERA5 n'est inventée : ce lot ne permet pas de THI sur grille.
Le THI bovin reste alimenté par les stations Task11 avec humidité disponible.

Référence préparée : 1991–2020, minimum 24 années complètes par jour calendaire et
variable. Pas de normale/percentile avec un échantillon insuffisant. Le 29 février
reste insuffisant sous cette politique (huit occurrences possibles) ; pas de
lissage/interpolation implicite. Méthode exploratory, type 7 ; ECDF exacte et
fenêtres homologues nécessitent les échantillons archivés, pas uniquement les
percentiles précalculés. Le petit lot réel ne constitue pas une normale 30 ans.

## Rétention et quotas

`--persist-supabase` refuse les dates de plus de 30 jours ; les backfills anciens
sont archivés localement. Quota source/local fixe 512 Mio avec réserve de 64 Mio.
Une exécution ERA5 exige dates/version/max-tiles/max-rows : 7 jours maximum,
4 tuiles maximum et 4 000 lignes maximum ; une RPC accepte au plus 1 000 lignes.
Arrêt SQL sur taille physique du quotidien >255 Mio ou des acquisitions >31 Mio.
Ces arrêts n'autorisent ni croissance automatique ni suppression automatique.

Avant d'ouvrir un nouveau mois, vérifier l'archivage distant (SHA256, lisibilité,
permissions privées), puis purger par petits lots les lignes de plus de 30 jours
avec leurs clés d'acquisition vérifiées. Retirer les acquisitions orphelines après
vérification des archives et laisser autovacuum travailler ; DELETE ne rend pas
immédiatement le disque au fournisseur. La purge et le miroir objet ne sont pas
automatisés ici : en leur absence le quota arrête le pipeline. Ne pas purger les
sources/références historiques nécessaires aux calculs. Réduire à 7 jours si le
budget total DB se rapproche de 400 Mo. Pas de cron national activé.

La couverture géographique complète n'implique pas que tous les historiques sont
présents. Le plan couvre toute la métropole ; le remplissage est progressif et
son état est exposé par les checkpoints et les réponses absentes de l'API.

## Stations

Catalogue officiel DPObs : 1 818 candidats dans l'emprise ; 96 sélectionnés par
échantillonnage déterministe des points les plus éloignés, distance corrigée par
cosinus. Géographie seulement, pas validation d'une représentativité climatique.
Les identifiants restent contrôlés par les catalogues officiels de chaque produit.
Le catalogue serveur reste borné à 200 (pilote + France), chaque acquisition à dix
stations. Le runner France lance au plus deux lots et sept dates par exécution,
sériellement, avec la régulation Task11 conservée. Pas d'interpolation ; sources
station et grille ne sont jamais fusionnées. Pour 96 stations : 96 lots quotidiens
/jour/source, 35 040/an/source ; les lots JSON ont un volume variable selon la
résolution et les variables. Les observations horaires restent des instantanés
Task11 ; aucune archive horaire complète nationale n'est revendiquée.
