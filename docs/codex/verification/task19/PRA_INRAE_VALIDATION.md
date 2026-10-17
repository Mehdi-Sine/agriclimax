# Validation du fichier PRA INRAE fourni — 17 octobre 2026

**NOT READY : nomenclature réconciliée, géométries ministérielles non comparées.**
Les contours INRAE ne sont pas promus au rang de référentiel ministériel validé.
Aucun import SQL, aucune correspondance ERA5/PRA, aucune acquisition climatique,
aucune migration distante et aucun backfill ne sont déclenchés par cette analyse.

Périmètre : fichiers fournis par l’utilisateur, lus comme données ; analyse
hors ligne, script d’audit, preuves et documentation. Aucun changement des règles
scientifiques, du schéma, des privilèges ou des parcours produit.

## Sources et reproduction

- `pra_shapefile.zip`, 5 911 666 octets, SHA256
  `2aa7b8dba936215a6f5db9914f1fb5d9364c3730d998a511f63bf2f5db124dd1`.
  Attribution INRAE AgroMetInfo communiquée par l’utilisateur ; l’archive ne
  contient ni DOI, date de version, licence, ni description de fabrication.
- `Referentiel_CommuneRA_PRA_2017.xls`, 7 218 688 octets, SHA256
  `1a47ade01fa9d936da77d3d7d06eaed1f8944f535802147995f96fd39a0b5008`.
  La feuille COM indique « Géographie au 01/01/2017 » et « Insee, Code officiel
  géographique/Agreste, Nomenclature PRA ». Il s’agit de la nomenclature et des
  rattachements communaux, **pas de contours géographiques indépendants**.
  Provenance de transfert : pièce jointe utilisateur, pas téléchargement vérifié.

Archive : SHP, SHX, DBF, PRJ, CPG, QIX et QMD, même radical
`CommunePra_SFWGS84_WithCell`. SHP : 135 902 436 octets ; DBF : 28 495 216.
CPG UTF-8 ; PRJ WGS84 géographique, reconnu équivalent EPSG:4326.
Le QMD QGIS 3.22.1 contient des métadonnées de provenance vides.

Installation dans un environnement Python isolé puis reproduction :

```sh
python -m pip install -r engine/requirements-geo.lock -r scripts/requirements-pra-audit.lock
python scripts/pra_inrae_audit.py \
  --zip /chemin/pra_shapefile.zip \
  --xls /chemin/Referentiel_CommuneRA_PRA_2017.xls \
  --output work/inrae-pra-audit.json
```

Le script ne répare, simplifie, importe ni télécharge rien. Il conserve la
précision source et mesure les surfaces en EPSG:3035. Les archives brutes ne
sont pas ajoutées au dépôt. Résultats complets par code, attributs, checksums,
composantes sans code et intersections :
[evidence/inrae-pra-audit.json](evidence/inrae-pra-audit.json).
Exécution réelle : [logs/inrae-pra-audit.log](logs/inrae-pra-audit.log).

## Pourquoi 714 au lieu de 713

La feuille `Nmcl_RA_PRA` contient exactement **713 lignes / 713 codes PRA uniques**,
432 codes RA distincts. Aucun de ces 713 codes ne manque dans le SHP.
Le seul code supplémentaire du SHP est **75000**.

La feuille COM contient 35 287 communes distinctes, dont la ligne :

| Commune | Département | Région | RA | PRA / territoire | Libellé |
| --- | --- | --- | --- | --- | --- |
| 75056 Paris | 75 | 11 | 000 | 75000 | PARIS |

Dans cette cellule XLS, `75000` est numérique ; les codes PRA de la nomenclature
sont textuels. Cette exception est constatée explicitement, sans conversion
généralisée qui perdrait les zéros initiaux. Paris figure dans les rattachements
communaux mais pas dans la liste des 713 PRA. **714 correspond donc ici à
713 PRA + le territoire Paris**, pas à une PRA ministérielle supplémentaire.
Le code 75000 doit rester un cas territorial séparé, exclu du dénominateur PRA.

Le contour 75000 est un polygone de 105,402424 km², emprise
2,224219–2,469573°E / 48,815943–48,902148°N. Il apparaît sur sept lignes SAFRAN.
L’attribut `dept` de ces lignes indique 78/92/93/94, jamais 75 : son absence
n’implique donc pas que la géométrie de Paris manque. La concordance du contour
avec le contour officiel de Paris reste à mesurer, et non déduire de sa surface.

## Ce que représentent les 17 238 lignes

**L’hypothèse initiale de fragments géométriques n’est pas confirmée.**
Il existe 715 géométries WKB distinctes : exactement une pour chacun des
714 codes renseignés, et une pour l’ensemble des six lignes sans code.
Les 16 523 autres géométries sont des répétitions exactes. Toutes les géométries
lues sont valides et non vides. Aucun couple `(PRA_Code, cell)` n’est dupliqué.

Le fichier est compatible avec une jointure un-à-plusieurs des contours PRA
vers des cellules SAFRAN, avec répétition du contour entier. Il ne contient pas
les polygones des cellules SAFRAN ni des intersections PRA/cellule distinctes.
La méthode exacte de sélection des associations n’est pas documentée.
**Additionner les surfaces des lignes compterait plusieurs fois chaque PRA.**
Une déduplication exacte par code et WKB suffit à récupérer les contours
présents ; une dissolution n’ajoute aucune information. Cela prouve leur
reconstructibilité informatique, pas leur conformité aux limites ministérielles.

Attributs DBF, types et longueurs complets dans le JSON :

- `PRA_Code` : texte, largeur 80, code département + RA sur cinq caractères.
- `cell`, `altitude` : entiers ; identifiant SAFRAN et altitude selon le contexte
  de fourniture, sans dictionnaire d’unités joint.
- `dept`, `region2016`, `region`, `nature` : texte ; deux générations de régions.
- `clc_211/221/222/231/241/242/311/312/313`, `hsat`, `rupromax`, `rupromin`,
  `rupro`, `hcc`, `pro`, `hpf` : numériques décimaux, sémantique/unités/millésimes
  non établis dans l’archive. Aucune réutilisation agronomique dans Task19.
- `AreaPRA` : entier ; 3 330 valeurs nulles, concernant 50 codes renseignés
  ainsi que les six lignes sans code. Ne pas l’utiliser comme surface de référence.
  Les surfaces de cette analyse sont recalculées depuis les contours.

Sur 3 091 lignes renseignées, le préfixe du code PRA diffère de `dept`.
Ces attributs peuvent caractériser la cellule jointe ; on ne peut les utiliser
comme hiérarchie de la PRA sans dictionnaire source. Pour les PRA, les codes
administratifs et libellés doivent venir de la nomenclature/rattachement officiel,
pas de la première ligne SAFRAN rencontrée. Le SHP ne fournit pas de nom PRA.

## Anomalies géographiques et couverture

Les 713 contours de codes officiels totalisent **548 491,359808 km²** en
EPSG:3035 ; 140 sont multiparties. Les six PRA corses 2A258/259/260 et
2B258/259/260 sont présentes. Ce total est une mesure du fichier, pas une
preuve de couverture intégrale de la métropole.

Aucune intersection de surface supérieure à 1 m² entre les 715 contours
uniques, y compris Paris et le contour sans code. Ce contrôle ne démontre pas
l’absence de lacunes : aucun masque administratif indépendant n’était disponible.

Les six lignes sans code ont les cellules 1049, 1063, 1064, 962, 976, 977 et des
attributs `dept` 14 ou 27. Elles répètent **le même multipolygone de 13 parties**,
13 479,329976 km², et non six petits fragments locaux :

- Onze composantes, environ 13 437,34 km², se situent entre 4,41°W et 1,48°E,
  41,35–42,38°N, très au sud de la Normandie annoncée par les attributs.
  Leur origine et leur éventuelle présence hors France doivent être expliquées
  par le producteur et comparées à des frontières officielles.
- Deux composantes sont situées en Normandie : 36,718551 km² autour de
  1,333233°E / 49,216784°N et 5,272764 km² autour de
  0,224560°W / 49,183513°N. Elles ne chevauchent pas les PRA codées au seuil
  contrôlé. Leur rattachement n’est pas déduit par proximité ou par cellule.

Les coordonnées exactes de chaque composante figurent dans le JSON. Supprimer
ces lignes éliminerait également les deux composantes normandes sans expliquer
leur statut. Leur attribution à une commune/PRA exige des limites officielles
compatibles avec le millésime et une analyse de leurs intersections.

## Comparaison ministérielle : acquis et limites

**Vérifié :** concordance exhaustive des ensembles de codes avec la nomenclature
Agreste 2017 fournie, exception Paris expliquée dans son propre classeur,
présence Corse, répétitions exactes, validité et topologie interne mesurées.

**Non vérifié :** égalité des contours avec la couche ministérielle 2017,
version géométrique réelle du SHP INRAE, exhaustivité des frontières et îles,
traitement des communes nouvelles, appartenance des composantes sans code,
concordance département/région par intersection spatiale indépendante.
Le millésime 2017 du XLS ne date pas automatiquement les géométries du SHP.

Source ministérielle à obtenir : diffusion OFB de la couche
`ref_met_petite_region_agricole_masa_pol_3857`, source Ministère 2017 :
https://www.data.gouv.fr/datasets/petites-regions-agricoles-source-ministere-de-lagriculture-2017
Le téléchargement est toujours bloqué dans cet environnement : nouvel essai le
17 octobre 2026, `Tunnel connection failed: 403 Forbidden`.
Le XLS ne remplace pas ce contrôle géométrique.

## Décision et actions nécessaires

**Référentiel INRAE non validé pour import national en l’état.** Aucun remplacement
silencieux du référentiel ministériel et aucun calcul de poids sur des limites
encore non vérifiées. Le fichier permet de récupérer les contours fournis sans
approximation ; il ne suffit pas à certifier les contours officiels.

1. Obtenir l’export ministériel 2017 complet, ses métadonnées, licence, CRS et
   date/version ; idéalement les limites communales 01/01/2017 et départementales
   officielles compatibles pour expliquer les lacunes et contrôler Paris.
2. Obtenir du producteur INRAE la provenance/version des contours, le dictionnaire
   des attributs, la méthode de jointure SAFRAN et l’explication du contour sans code.
3. Comparer par code, dans une projection commune, différences symétriques,
   surfaces manquantes/excédentaires, îles, trous et limites départementales.
   Identifier les deux composantes normandes par intersection officielle ;
   documenter chaque écart, sans `buffer(0)`, rattachement voisin ou simplification.
4. Après validation explicite, dédupliquer les contours, joindre la nomenclature
   officielle, exclure Paris du compteur PRA tout en documentant son traitement,
   puis préparer un import versionné et contrôlé avec `scripts/pra_reference.py`.
5. Calculer alors les intersections avec les cellules **ERA5-Land 0,1°** en
   EPSG:3035 selon la méthode Task19. Les identifiants `cell` SAFRAN, leur altitude
   et les associations de ce fichier ne sont jamais des cellules ou poids ERA5.

Aucune couverture climatique PRA réelle supplémentaire n’est validée par cet
audit. Les preuves DEV, synthétiques et les quatre boîtes ERA5 antérieures
restent distinctes. Recommandation PR #40 : conserver en draft, **NOT READY**.
