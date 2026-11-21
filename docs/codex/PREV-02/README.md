# PREV-02 · Indexation quotidienne des prévisions natives

Le point de départ est `5b3e15139713a993924012183c9d2796f6a626ff`, fusion de la [PR #109](https://github.com/Mehdi-Sine/agriclimax/pull/109). Les responsabilités concernées sont la collecte et sa reprise, la qualification des surfaces, les objets privés et leur catalogue, les lecteurs Explorer et la recette de déploiement. Les règles et seuils scientifiques COUV-04 à COUV-08 et PREV-01 sont repris tels quels.

## Pourquoi le 20 novembre n’avait aucun index

Dans `operational-journal.yml`, le job prévision appelle `task36_nightly.py --source forecast`, qui restaure le checkpoint puis appelle `national_weather.py --mode national … --publish-dev`. Son adaptateur publiait le catalogue numérique après validation. Les décodeurs AROME/ARPEGE et IFS conditionnaient la capture à `COUV05_CAPTURE_NATIVE_MASKS=true`, absent du workflow. Le workflow `meteofrance-ingestion.yml` ne fait que sonder les catalogues prévisionnels à la demande. Le workflow manuel `pra-climate.yml` ne possède plus de déclencheur planifié. Le flux quotidien ne lançait ni `couv05_masks.py` ni l’écriture des objets privés. Un cycle numérique déjà publié sortait de surcroît immédiatement par `no_new_data`. Les index du 14 et du 15 provenaient de la chaîne manuelle COUV-05D.

## Exploitation

- Le job prévision capture les preuves avant l’agrégation. Le déclenchement manuel `native-index` accepte un identifiant explicite de checkpoint T36 et exécute la même publication, sous le même verrou, sans acquisition fournisseur ni étape éditoriale. Il conserve le checkpoint Actions de trois jours et lance l’indexation dans un step séparé du Journal. Un run abandonné reprend avec les objets immuables déjà en place. Une archive existante peut être reprise à partir du checkpoint, y compris en recréant les captures à partir des champs vérifiés hors ligne.
- Le producteur vérifie l’archive exacte, les 70 matrices modèle, run, jour et variable de 713 lignes, leurs provenances et les identités officielles. Les valeurs servent au contrôle d’association. Les intersections et les limites d’admission restent celles du producteur COUV-05.
- Les objets sont insérés avant l’index. Le déclenchement manuel les relit par octets. Au quotidien, les objets volumineux sont vérifiés par taille et ETag de l’envoi simple, avec relecture exacte si l’ETag n’est pas un MD5 de contenu. L’index et sa liaison sont relus par octets dans les deux modes. Les lecteurs comparent le SHA-256 de chaque objet qu’ils utilisent. Le catalogue natif est adressé par SHA-256 de l’archive dans le bucket privé, sous `forecast-native/v1/<archive>/binding.json`. Cet objet immuable est le point de visibilité atomique. Les lecteurs exigent le même SHA dans le manifeste et l’index. Les pointeurs du Journal, d’ERA5 et du catalogue numérique gardent leur propre cycle de publication.
- Les publications quotidiennes sont sérialisées par le groupe `t36-acquire-forecast`. Après rétablissement d’une erreur transitoire, le producteur reprend par comparaison des octets existants. Le suivi vérifie la présence et le SHA de l’index du cycle le plus récent et alerte après 36 heures. Les journaux Actions distinguent le diagnostic de fraîcheur du résultat d’acquisition.
- Le budget est de 900 Mio pour les objets réellement listés dans le bucket, avec un maximum de 256 Mio pour un candidat et la limite effective du bucket par objet. Sous pression, seuls les objets du nouveau préfixe appartenant à des cycles plus anciens peuvent être retirés. Le dernier index valide et les paquets historiques partagés sont protégés. Une capacité insuffisante fait échouer la publication avant tout nouvel upload.
- L’API météo réutilise la réponse sérialisée par archive, index, modèle, échéance et variable (24 entrées, 12 Mio, 60 s). Elle télécharge les coordonnées natives nécessaires aux emprises partielles et utilise le référentiel officiel pour les PRA entières après qualification. Les composantes composites évitent les recalculs lorsqu’un résultat certifié correspond exactement à la règle active et au support. Le cache composite inclut le SHA de l’index. Le CDN Vercel peut réutiliser pendant 60 secondes une carte vérifiée dont la requête fixe le run exact, le jour et la variable. Le catalogue, les fiches et les preuves indisponibles gardent leur comportement sans cache CDN. Une route ne prend jamais la preuve d’un autre cycle.

## Canari et retour arrière

Le déploiement de la branche PREV-02 sert de canari uniquement sous `VERCEL_ENV=preview`. Vérifier la protection de l’aperçu. Pour une cible indépendante, activer `COUV05_RENDER_ENABLED=true`, `COUV05_DAILY_INDEX_ENABLED=true`, `PRA_NATIONAL_ENABLED=1` et le flag client `NEXT_PUBLIC_COUV04_RENDER_ENABLED=true` pour ce build. Maintenir `NEXT_PUBLIC_COUV06_HISTORICAL_RENDER_ENABLED=true`. Les correspondances explicites d’archives PREV-01 restent disponibles par `COUV05_ARCHIVE_INDEX_PINS` sur les environnements qui en ont besoin. Tester le catalogue, les trois modèles, la pluie partielle et l’humidité, la navigation mobile, les composites certifiés et le retour historique. Vérifier la révision déployée et chronométrer avec un processus neuf et sous charge.

Le rollback du lecteur se fait par `COUV05_RENDER_ENABLED=false` et, pour le rendu, par un nouveau build avec `NEXT_PUBLIC_COUV04_RENDER_ENABLED=false`. Garder le flag historique actif. Les objets restent privés et disponibles pour une reprise. Désactiver `COUV05_DAILY_INDEX_ENABLED` seul rétablit la résolution PREV-01 par pins existants.

## Publication opérée le 21 novembre 2026

| Objet | Cycle en UTC | SHA-256 de l’archive | SHA-256 de l’index |
| --- | --- | --- | --- |
| Prévision native | 20 novembre, 18 h | `a5c8779bc2244acaef1b6257952de582eec0c589cf1757d225fe60e8af9e56fb` | `ed8dc50e54be7fbd5a2d0d2f1df0a9dabc7a5764215e192ede8370d06ea2326c` |
| Paquet composite PREV-01 | 14 novembre, 18 h | `ed93ab41472f81cec83a6039d8634133fa1feb42fe71d6513090d74d6985a398` | `40cc3aebeb338f5cb63898f77a12680104749a7d9f67c27afc97810e5ec193c9` |

Le [checkpoint Actions](https://github.com/Mehdi-Sine/agriclimax/actions/runs/44849021843/artifacts/14683909272) a reproduit les 49 910 lignes numériques à partir des champs déjà acquis, avec zéro requête fournisseur. La relance de l’indexation a repris 70 matrices qualifiées. Les 273 objets de la prévision ont été vérifiés. Le paquet composite a vérifié 503 objets, dont des géométries et masques déjà présents. Le catalogue numérique et `current.json` ont conservé leurs SHA-256 `fb526cbc…` et `a824c6a8…`. Le cas composite du 14 est consulté sur sa propre archive. L’inventaire final compte 274 objets pour le cycle courant, liaison incluse, et 614 538 783 octets pour le bucket.

Un processus neuf a relu l’index courant et renvoyé `healthy`. Le [rejeu Actions du mode `native-index`](https://github.com/Mehdi-Sine/agriclimax/actions/runs/44934670553) a restauré le checkpoint, confirmé la publication existante et contrôlé sa fraîcheur. Les jobs de planification, d’acquisition et du Journal ont été ignorés. Ce run teste la reprise avec le stockage réel. Le déclenchement planifié utilisera le correctif après fusion manuelle.

La prévision a ajouté **182 445 836 octets** et le composite **5 454 158 octets**. Aucune rétention n’a supprimé d’objet lors de cette publication. Le bucket est privé et sa limite par objet est de 8 Mio. L’organisation Supabase est au forfait Free. La relecture systématique des objets d’un cycle de cette taille représenterait environ 5,47 Go sur 30 jours, au-delà des 5 Go d’egress non mis en cache du forfait. Le contrôle de métadonnées évite ce téléchargement au quotidien tout en gardant la relecture complète disponible pour la recette. La consommation agrégée de l’organisation et la facture n’ont pas été mesurées. Aucun nouveau service, aucune nouvelle acquisition et aucun appel OpenAI. [Quotas Supabase](https://supabase.com/docs/guides/platform/manage-your-usage/egress)

## Recette

Les 70 matrices couvrent chacune les 713 PRA. Les neuf combinaisons HTTP du 21 novembre couvrent température, pluie et humidité sur AROME, ARPEGE et IFS. Le contrôle national inclut les six PRA corses. La pluie IFS affiche 665 PRA entières et 48 grisées. Le contrôle EPSG:3035 des 30 emprises partielles relues dans Storage pour cette carte retrouve un écart maximal de fraction de `2,57 × 10⁻⁸`. Aucune des 30 ne dispose d’une valeur numérique admissible. La pluie composite du 18 au 19 novembre sur l’archive du 14 affiche 709 PRA entières et quatre partielles. Le contrôle EPSG:3035 de ces quatre géométries retrouve un écart de fraction d’au plus `2,56 × 10⁻⁸` et une fraction hors PRA d’au plus `1,49 × 10⁻⁸`.

Les 234 requêtes HTTP composites et les 912 liaisons vérifiées incluent 660 résultats distincts dans Explorer. Les 525 résultats dont la règle est absente d’Explorer restent refusés. La comparaison avec ERA5 donne 681 PRA entières, 31 partielles et une grisée.

| Mesure | Build local relié au stockage privé | Canari Vercel, révision `1aeceff` |
| --- | --- | --- |
| Météo, première lecture | 4,87 s sur processus neuf | 4,42 s à la première mesure |
| Météo, p95 de 45 requêtes, concurrence 3 | 0,385 s | 3,82 s |
| Composite, p95 de 234 requêtes, concurrence 3 | 3,49 s pendant la publication | 1,61 s |
| Premier rendu météo, trois contextes Chromium neufs | 4,80 à 6,89 s | 3,60 à 6,40 s |
| Rendu météo répété dans le même contexte | 4,10 à 6,16 s | 3,10 à 4,26 s |
| Carte composite mobile, 390 px | 5,55 s | 4,34 s |
| Carte ERA5 mobile, 390 px | 5,18 s | 7,13 s |

Chromium a parcouru les largeurs 1 440, 768 et 390 px. Le changement d’échéance sur mobile a conservé une preuve vérifiée. Le canari Vercel exige l’authentification et utilise les objets distants, sans origine locale intermédiaire.

Le retour arrière a été exécuté sur un processus neuf avec le lecteur prévisionnel désactivé. La même API a renvoyé les 713 lignes numériques sans transport natif. Chromium mobile a encore rendu ERA5 à 681/31/1. Le premier déploiement Preview de la PR a aussi servi de témoin avec le lecteur désactivé.

### Second passage Vercel

La [révision `098448e`](https://vercel.com/mehdi-sines-projects/agriclimax/DdL4h7pfPU7XT76v74weRUkGwCUZ) a confirmé le cache CDN sur les 45 requêtes météo répétées, avec un p95 de **0,252 s** et un maximum de **0,275 s**. La première lecture hors CDN a pris **3,98 s**. Les premiers accès aux autres clés sont descendus à 0,72 s et montés à 2,59 s. Les réponses de calcul observées indiquent toujours `iad1` malgré la préférence `cdg1` déclarée. Le résultat à chaud repose sur le cache, avec un dépassement de l’objectif de 2 s sur certains accès à froid.

Sur ce second passage, les premiers rendus météo Chromium ont pris **2,90 à 6,03 s** et les répétitions **3,14 à 3,36 s**. Le composite partiel mobile a pris 5,10 s au premier rendu et ERA5 7,01 s. Les cinq indicateurs hors registre, correspondant aux 525 refus, ont chacun renvoyé `400 INVALID_QUERY` via l’API du canari.

La vérification Storage par métadonnées a aussi été rejouée sur les 273 objets du cycle récent, avec zéro octet supplémentaire enregistré et zéro écriture. Les tests ciblés passent avec 13 cas Python, 15 cas web et les deux contrôles de rejeu du paquet composite.

**État public.** Vercel Production est sur `5b3e151` et sert le cycle numérique du 20 novembre sans le transport natif. Le rendu public n’est pas activé. Le canari protégé est consultable avec les droits Preview. La PR reste en brouillon, sans fusion automatique. Le workflow planifié avec PREV-02 et le prochain renouvellement restent à observer après fusion manuelle. Le dépassement à froid reste visible dans la décision d’activation.
