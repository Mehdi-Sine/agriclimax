# COUV-02 — Complétude littorale et qualification nationale des PRA

**Verdict : PARTIAL.** Le pilote historique démontre 713 PRA exploitables à 90 %
pour la température moyenne et les précipitations, dont les six PRA corses.
L'adaptateur reste **désactivé par défaut**, sans appel depuis l'application.
Ce résultat ne signifie ni 713 supports intégraux, ni qualification des extrema,
ni activation de nouvelles cartes ou du Journal.

## Résultat national mesuré

Les colonnes comparent les **mêmes 29 dates réelles, du 02 au 30 octobre 2026**.
Le référentiel conserve ses 713 PRA de France métropolitaine et Corse ; ce
périmètre ne comprend pas les outre-mer. Le seuil produit s'applique séparément
à chaque PRA, variable et fenêtre temporelle, jamais à une moyenne nationale.
Les données sont historiques gelées, pas un état de disponibilité en direct au
13 novembre. Les résultats d'ERA partiel étaient déjà disponibles dans `main`.

| Indicateur | `main` ERA5-Land, sources gelées | Candidat COUV-02, même période |
|---|---:|---:|
| PRA exploitables à ≥ 90 %, Tmoy et pluie | 681 | **713** |
| Supports complets, tolérance numérique 0,01 % | 645 | **658** |
| Supports partiels exploitables | 36 | **55** |
| PRA indisponibles, Tmoy et pluie | 32 | **0** |
| PRA corses exploitables, Tmoy et pluie | 2 / 6 | **6 / 6** |
| Provenance sélectionnée par PRA et fenêtre | ERA uniquement | **681 ERA + 32 SIM** |
| Tmin / Tmax ERA, conventions inchangées | 681 | **681** ; 32 indisponibles |
| Humidité ERA | absente | absente ; SIM séparé disponible sur 713 |
| Acquisition quotidienne ajoutée | 0 | **0 activée** ; budget candidat ci-dessous |

Le choix ERA prioritaire conserve les valeurs et réduit le recours à SIM.
Il laisse 658 supports complets plutôt que les 675 obtenus avec SIM national :
le critère produit est 90 %, pas la maximisation artificielle du nombre à 100 %.
« Complet » conserve la tolérance de fermeture historique 1e-4 ; même cette
catégorie ne certifie pas la représentativité des microclimats.

Pour les **30 dates du 01 au 30 octobre**, le 1er octobre manque dans la
restitution ERA partielle : une série homogène exige alors **645 ERA + 68 SIM**,
soit 713 Tmoy/pluie, 675 supports complets et 38 partiels. On ne raccorde jamais
29 jours ERA à une journée SIM. Les Tmin/Tmax ERA restent limitées à 645 sur cette
fenêtre. Pour les **60 dates du 08 septembre au 06 novembre**, SIM seul possède
713 supports ≥ 90 %, pour ses cinq variables distinctes. Cela ne prouve aucune
disponibilité au-delà de ces dates.

![Diagnostic national avant/après](evidence/national-before-after.svg)

La carte est une preuve de disponibilité historique, sans modification de l'UX.
Chaque couleur remplit la PRA pour faciliter le diagnostic national : la valeur
d'un support partiel décrit seulement sa portion représentée. Les surfaces SIM
manquantes restent dans `sim-residual-gaps-3035.geojson` (coordonnées EPSG:3035,
ne pas interpréter comme un GeoJSON RFC7946 en longitude/latitude).

## ERA5-Land avant toute deuxième source

Le code existant `territories/spatial.py` inclut déjà les cellules dont le centre
est à l'extérieur de la PRA mais dont l'emprise intersecte son polygone. Les
poids utilisent toute la surface officielle, en EPSG:3035. Un nouveau masque
« centre dans la PRA » retirerait du support ; une nouvelle renormalisation
masquerait les trous. Les valeurs ERA des portions ont déjà été restaurées par
Task26D/DATA-01 et consommées par CORE-01 : elles sont réutilisées telles quelles.

Sur les 68 PRA historiquement incomplètes :

- Les intersections existantes ferment la grille à **8,17e-13** près au maximum.
- Passer de 0,01° à 0,002° de densification des cellules modifie la fraction
  valide d'au plus **5,88e-7**, soit **0,000059 point de pourcentage**.
- **Aucune PRA supplémentaire ne franchit 90 %** par cette correction numérique.
- 36 des 68 PRA atteignent déjà 90 % sur ERA. Ce gain par rapport au critère
  intégral de COUV-01 est disponible dans `main` ; COUV-02 ne le revendique pas
  comme une nouvelle correction.
- Les 32 autres nécessitent réellement un complément ou restent indisponibles.

Le bitmap cellulaire à deux instants reste un **diagnostic historique** ; il ne
prouve pas une disponibilité quotidienne actuelle. Son résultat spatial est
identique à la matrice gelée. La qualification temporelle emploie les valeurs
réelles des archives, séparément de ce bitmap. Le masque ECMWF déjà audité
présente 39 cellules absentes avec fraction terrestre ≥ 0,5 et 42 cellules
présentes sous 0,5 : ce masque auxiliaire ne permet pas de fabriquer des données.
Crozon conserve six cellules ERA sans valeur dans le contrôle NetCDF initial.
Aucune interpolation, IDW, translation, réparation des PRA ou météo ajoutée.

## Les 38 résidus SIM

[Table nominative détaillée](RESIDUALS.md) et [CSV quantitatif](evidence/residual-38.csv).
Les 38 sont individuellement vérifiés par différence entre le polygone PRA et
l'union des emprises SIM de 8 km, projetées depuis les coordonnées Lambert II
étendu officielles. Les sommes d'intersections et les unions concordent à 1e-7.
Les trous représentent **150,563 km²** au total. Le plus faible support est le
littoral Corse 2A258, à **96,5047 %**. Les 38 atteignent donc tous la règle produit.

La cause géométrique mesurée est une portion de PRA hors de l'emprise finie des
cellules SIM disponibles. Le CSV distingue nombre de fragments du trou et nombre
de composantes du polygone officiel. Ce constat ne démontre pas, pour chaque
fragment, une cause physique terre/mer ni une précision météorologique locale.
L'affinement des cellules de 1 000 à 250 m change les fractions d'au plus
**1,82e-8** : il ne résout pas ces lacunes. La solution retenue est d'admettre la
valeur de portion avec sa couverture explicite, sans attribuer de valeur au trou.

La réserve COUV-01 sur le datum des colonnes géographiques et la représentativité
littorale reste ouverte. Le calcul conserve EPSG:27572, les coordonnées projetées
officielles et EPSG:3035 ; aucun déplacement n'a été introduit pour fermer le bord.

## Variables, périodes et compatibilité

| Variable | ERA5-Land | SIM/SAFRAN | Décision |
|---|---|---|---|
| Température moyenne | moyenne des échantillons horaires UTC, °C | T, ]00UTC–00UTC], °C | Disponibilité descriptive ; sources distinctes |
| Minimum / maximum ERA | moyennes spatiales d'extrema horaires UTC du produit existant | **pas de remplacement** | 32 lacunes sur les 29 jours ; 68 sur 30 jours |
| Extrema horaires SIM | absents sous ces identifiants | TINF_H ]18UTC–18UTC] ; TSUP_H ]06UTC–06UTC], °C | Noms `hourly_temperature_min_mean` / `hourly_temperature_max_mean` distincts |
| Précipitations | accumulation à 00UTC du lendemain, mm | PRELIQ + PRENEI, ]06UTC–06UTC], mm | Pas d'alignement artificiel de six heures |
| Humidité | absente de l'historique ERA existant | HU, ]00UTC–00UTC], % | SIM séparé ; pas de THI hybride |
| Indicateurs agronomiques, normales, anomalies | règles existantes préservées | équivalence et calibration non établies | **Non autorisés par l'adaptateur** |

Des dates portant la même étiquette n'impliquent pas la même journée météo.
Une carte de pluie multi-source devra afficher les conventions par PRA avant
toute intégration ; les précipitations SIM ne deviennent pas des cumuls UTC ERA.
Les comparaisons COUV-01 (9 030 Tmoy, 84 paires station/SIM) restent des
diagnostics, pas une preuve d'interchangeabilité, de calibration ou de validation
hors assimilation. Leurs limites stationnelles, altitudinales et saisonnières
sont conservées dans `../COUV-01/SAFRAN_PILOT.md`.

L'adaptateur `national_support.py` transporte PRA/date/variable, valeur, source,
nature, modèle, unité, définition, période, méthode, support, fraîcheur,
provenance et drapeaux. Il produit le contrat existant `climate-coverage-1` sans
changer son schéma. Le partiel a `value=null`, `observed_value` réel,
`state=observed_partial`, `scope=observed_area`. Aucune estimation territoriale
n'est certifiée. `indicator_eligible` et `journal_eligible` restent faux pour
**toutes** les sorties expérimentales. Sous 90 %, valeur et portion affichable
restent nulles. Une série exige toutes ses dates et un support stable ; une
lacune ou un changement de support refuse la série de la source concernée.

Historique ERA = `reanalysis`, SIM = `analysis` : ni observation locale directe,
ni prévision. Aucune donnée récente ou prévisionnelle n'est reclassée.

## Ressources et alimentation future

Cette tâche fait **zéro requête météo et zéro écriture distante**. Le traitement
rejoue les archives existantes et contrôle uniquement les géométries problématiques.
`evidence/runtime.json` donne la mesure locale ; le rejeu final a pris 26,390 s,
avec 483 316 Kio de RSS maximal. Un second rejeu a pris 25,342 s, avec 484 196 Kio,
et produit les mêmes dix fichiers de preuve octet pour octet (hors durée/RSS).
Les valeurs météorologiques ne sont pas réingérées ou recalculées.

| Variante future | Archives SIM agrégées mesurées, cinq variables | Projection 730 jours uniques |
|---|---:|---:|
| 32 PRA, 807 cellules contribuant au poids | 4 281 octets/j en moyenne, max 4 346 | 3,12 Mo de payload |
| 68 PRA si ERA partiel absent dans la fenêtre | 8 123 octets/j, max 8 236 | 5,93 Mo de payload |
| Pilote national COUV-01 | 68 615 octets/j | 50,09 Mo de payload |

Ces mesures portent sur le contenu agrégé compressé ; prévoir au moins 25 %
de réserve pour manifestes/index, plus un budget séparé de révisions. Conserver
deux révisions au maximum et une seule copie de chaque blob inchangé.
**Le filtrage ciblé n'est pas une acquisition distante ciblée démontrée.** Le
transport existant COUV-01 lit encore le Parquet national de 11 156 587 octets
(6 GET / 12 196 093 octets avec les métadonnées), puis sélectionne les cellules.
Aucun endpoint officiel par PRA n'a été établi. Le coût réseau futur reste donc
de cet ordre tant qu'un sous-ensemble officiel n'est pas qualifié ; ne pas
annoncer une économie réseau de 32/713. La mesure nationale COUV-01 était
25,167 s / ~820 Mio ; ce n'est pas une mesure d'un futur job ciblé quotidien.

Pas de nouvel abonnement ou infrastructure ; dépense monétaire quotidienne
non chiffrable sans prix effectifs et nouvelle mesure du fournisseur. L'incrément
**activé** est nul. Les plafonds existants sont conservés : 16 Mio/fichier,
128 Mio/campagne, 128 appels, 448 Mio de workspace, 4 Gio de mémoire, 1 320 s.
Une conservation quotidienne de 60 jours glissants en doublon reste interdite.
Voir [activation et retour arrière](ACTIVATION.md).

## Preuves et reproduction

Depuis la racine, Python 3.12 et dépendances dev/geo existantes :

```sh
python -m venv work/couv02/venv
work/couv02/venv/bin/pip install -r engine/requirements-dev.lock -r engine/requirements-geo.lock -e engine
work/couv02/venv/bin/python scripts/couv02_qualification.py --output work/couv02/replay
python scripts/verify_couv01_frozen.py
python scripts/verify_couv02_frozen.py
work/couv02/venv/bin/pytest engine/tests/climate/test_national_support.py -q
```

Les vérificateurs gelés fonctionnent sans réseau et avec la bibliothèque standard.
L'audit géométrique et la validation de schéma emploient les dépendances existantes.
PyArrow n'est nécessaire que pour réacquérir le pilote COUV-01, ce qui n'a pas été
fait dans COUV-02. Aucun besoin d'accès Supabase, CDS, Météo-France authentifié.

- `input-checksums.json` : 101 fichiers d'entrée, référentiels et archives intacts.
- `national-713.csv` : disponibilité et choix source par PRA, même période.
- `residual-38.csv` / `era5-68-geospatial.csv` : diagnostic individuel et sensibilité.
- `selected-daily-matrix.csv.gz` : **41 354** valeurs réelles PRA/date/variable,
  avec période, portion, couverture, provenance et qualité ; **toutes** comparées
  exactement aux archives par le vérificateur indépendant.
- `window-matrix.csv.gz` : **9 269** décisions PRA/variable/fenêtre, y compris les
  refus et les variables SIM dont le nom reste distinct.
- `adapter-examples.json` : exemples conformes au contrat existant, par type de support.
- `MANIFEST.json` : empreintes des dix preuves déterministes ; durée/RSS séparés.
- [Reprise et frontières protégées](REUSE.md) ; [résultats des contrôles](VALIDATION.md).

Le gain historique est démontré. L'activation nationale permanente reste soumise
à une qualification opérationnelle et scientifique ciblée. Aucun objectif
713/713 pour les extrema ou pour l'ensemble des indicateurs n'est revendiqué.
