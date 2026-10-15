# Référence climatologique ERA5-Land — Task 12

L'observation live reste Météo-France (`ingestion/`). `climate/` sépare données
historiques, statistiques descriptives, indicateurs dérivés et restitution.
Les contrats V1 de risque restent inchangés. Aucun indicateur ici ne constitue
un risque blé/bovin, une exposition, une sensibilité ou une validation scientifique.

## Source, version et espace

Copernicus Climate Change Service / ECMWF, **reanalysis-era5-land** (produit
horaire standard), DOI [10.24381/cds.e2161bac](https://doi.org/10.24381/cds.e2161bac).
[Catalogue](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land),
[documentation](https://confluence.ecmwf.int/display/CKB/ERA5-Land%3A+data+documentation).
Licence annoncée par le catalogue au 15 octobre 2026 : CC-BY ; accepter les termes
sur son compte CDS, conserver attribution et termes de la récupération effective.
La réanalyse a une maille native d'environ 9 km ; le produit CDS utilisé est la
grille régulière **0,1°**, dont l'espacement métrique varie avec la latitude.
Aucune nouvelle interpolation/regrille AgriclimaX. Coordonnées EPSG:4326 et ID
`era5land.<latitude>.<longitude>`. Le GeoJSON expose ces points, pas des parcelles,
ni une précision agronomique ou des cellules de risque Task 04.
`reference_geojson` prépare une couche dédiée compatible MapLibre ; la jointure
territoire/grille et son support surfacique restent à définir.

`dataset_version` est un label explicite de snapshot utilisateur, **pas** un numéro
de release officiel inventé. Catalogue mutable : référence exacte = requête,
checksum SHA-256 de chaque fichier, date de récupération UTC, période de référence,
version de transformation. Le checksum du lot est le SHA-256 de la liste triée des
checksums source. Les sources sont conservées hors Postgres ; les receipts dans
les payloads permettent de les retrouver. Archives/réanalyses ne sont pas
assimilées à des observations station homogènes ni sans biais.

## Variables et temps

- `t2m` K : minimum, maximum et moyenne des **24 échantillons horaires** UTC
  de J 00:00 à J 23:00, puis conversion centralisée en °C. Pas `(min+max)/2`.
  Les extrema horaires échantillonnés ne sont pas les extrema continus d'un
  thermomètre. Un horaire absent/non fini rend les trois valeurs nulles.
- `tp` m du produit horaire **standard accumulé** : J+1 00:00 contient le cumul
  de J 00:00 à J+1 00:00. Conversion ×1000 en mm. Ne pas additionner les cumuls,
  ni soustraire les minuits de jours consécutifs. La requête inclut J+1.
  [Table de conversion ECMWF](https://confluence.ecmwf.int/pages/viewpage.action?pageId=197702797).
  Cette transformation ne s'applique PAS au produit ARCO/time-series dé-accumulé.
- Humidité relative absente de l'extraction choisie : aucun % RH fabriqué.
  Le point de rosée disponible au catalogue n'est pas une humidité relative.
  Une future dérivation doit versionner formule, phase eau/glace et domaine.
- ET0 absente : rayonnement/vent/pression non acquis ; pas d'ET0 ni de bilan P-ET0.
  L'ETPMON station Task 11 conserve son identité et n'est pas substituée à ET0.

Stockage `observed_at=J 00:00Z` : étiquette de la réduction quotidienne, avec flags
et méthode explicites. La date de publication inconnue reste null ; date de
récupération distincte. Une archive ancienne ne devient pas fraîche au téléchargement.
Formats/dimensions/unités inconnus, ensembles/expver non résolus, archives ZIP,
longitude 0–360 non compatible avec la bbox demandée et doublons sont refusés,
pas transformés silencieusement. Le format réel CDS reste à valider avec accès.

## Référence et méthodes

La CLI impose les trois paramètres de période/couverture ; aucun défaut caché.
**1991–2020** est une option explicite, pas une période validée implicitement.
Pour une normale complète par jour de calendrier : minimum_years=30 ; une démo
plus courte doit être étiquetée exploratoire et utiliser un minimum explicite.
`compare_daily` regroupe par même mois/jour, cellule, variable, unité et version,
jamais tous les jours de toutes les saisons. Le 29 février conserve son propre
échantillon (donc insuffisant avec minimum=30), sans interpolation automatique.
Le nombre d'années attendu et celui effectivement disponible sont restitués.

Moyenne arithmétique ; médiane et quantiles type 7 ; anomalie absolue signée
valeur−normale dans l'unité ; anomalie relative 100×écart/normale uniquement pour
pluie non négative et normale >0 (pas °C ou %RH). Percentile midrank ECDF avec
moitié des égalités. Comptages stricts au-dessus/en dessous : égalités exclues.
Fréquence empirique = nombre/n, pas période de retour ni probabilité extrême
extrapolée. `period_position` compare des **fenêtres calendaires homologues**,
agrégées par année (moyenne ou somme explicite), écarte les années incomplètes ;
l'appelant doit sélectionner la même fenêtre et expliciter le traitement du 29/02.
Cela permet le classement d'une période/année à date ; ne pas comparer une année
incomplète à des années historiques complètes.

Pas d'imputation ni de remplissage des nulls, de mélange de versions ou de règles
agricoles. Couverture insuffisante : normale/anomalie/rank nulls et flags explicites.
`compare_daily` exige des observations quotidiennes réelles Task 11 et une
association station/point grille explicitement choisie. L'appelant reconnaît les
différences de support et de fenêtres Météo-France/UTC. Résultats **exploratory**,
non corrigés de biais, non harmonisés temporellement. Ce différentiel brut n'est
pas une anomalie station climatologiquement corrigée. Une harmonisation et une
validation experte restent requises avant usage décisionnel.

## Reprise et persistance

Installation complémentaire : `python -m pip install -r engine/requirements-climate.lock`.
CDSAPI_KEY serveur via environnement ; URL CDS fixe, proxy/CA hérités, vérification
TLS maintenue. SDK lancé dans un sous-processus borné à 20 minutes, trois essais
transport avec backoff SDK <=8 s ; sorties upstream masquées. En cas de timeout,
un job CDS peut continuer côté serveur : vérifier le portail avant une relance.
Un timeout n'est pas une annulation distante. Aucun ordonnanceur nouveau.

Requêtes bornées à 31 dates passées et bbox <=2° par axe, découpées par mois avec
listes exactes de jours ; pas de produit cartésien de dates hors plage. Cache de
requête et receipts immuables vérifiés par checksum ; `--refresh` acquiert une
révision. Si le cache est corrompu : échec explicite. Rejeu de mêmes inputs
identique ; les nouvelles révisions sont ajoutées sans effacer les anciennes.
Une récupération fraîche crée un nouveau reçu même si les valeurs ne changent pas.
La RPC Supabase transactionnelle déduplique le payload par contenu ; les résultats
incluent un `computed_at` explicite pour rendre le rejeu reproductible. Trois essais
RPC bornés, reprise par rejeu après transport incertain. Les tables privées RLS
forcées n'accordent que SELECT/INSERT au serveur, aucun droit client. Aucun blob
NetCDF dans Postgres. Rétention/stockage objet durable restent à industrialiser.

Exemple d'acquisition **réelle**, après configuration des accès :

```sh
python scripts/ingest_climatology.py --bbox=-4.5,48.4,-4.3,48.6 \
  --from 1991-09-01 --to 1991-09-03 \
  --reference-start-year 1991 --reference-end-year 2020 --minimum-years 30 \
  --dataset-version cds-snapshot-2026-10-15 --persist-supabase
```

Répéter sur les années de référence avec mêmes mois/jours pour alimenter la normale ;
ce seul exemple de trois jours ne suffit pas. `scripts/compare_climatology.py --help`
consomme un export quotidien de l'endpoint Task 11 et les fichiers normalisés,
avec station, point grille, timestamp et reconnaissance des limites obligatoires.
Cette commande ne requiert pas de règle agricole ni de modification de contrat.
