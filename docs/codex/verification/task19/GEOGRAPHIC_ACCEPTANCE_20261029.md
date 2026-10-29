# Acceptation géographique PRA — recherche officielle du 29 octobre 2026

**Décision : `BLOCKED`.** La nomenclature officielle inclut Marseille et Lyon.
En revanche, aucune documentation consultée ne qualifie officiellement leur
quasi-absence des contours OFB/MASA : ni exclusion volontaire de la couche,
ni règle de traitement des arrondissements, ni incident de fabrication confirmé.
L'acceptation géographique du snapshot reste ouverte ; cette recherche ne lève
pas le blocage de la revue finale. Elle ne certifie aucune couverture nationale.

Périmètre : documentation et métadonnées d'acceptation uniquement. Référence
`ofb-masa-pra-2017-snapshot-20261017`, 713 PRA et 14 541 poids inchangés. Aucun
contour, poids, manifeste d'exécution, migration, code applicatif ou service distant
modifié. Aucun contour synthétique créé. Aucun merge.

## Marseille et Lyon : rattachements officiels établis

Le [classeur Agreste](https://agreste.agriculture.gouv.fr/agreste-web/download/methode/Z_PRA_2017/Referentiel_CommuneRA_PRA_2017.xls)
a été téléchargé directement chez le producteur. Ses 7 218 688 octets ont le
SHA256 `1a47ade01fa9d936da77d3d7d06eaed1f8944f535802147995f96fd39a0b5008`,
identique à la pièce fournie et auditée le 17 octobre. La provenance de cette
nouvelle lecture est donc indépendante du transfert utilisateur.

Feuille `COM`, géographie au 01/01/2017 ; numéros de lignes Excel, en-tête compris :

| Ligne | Commune | Département | RA | PRA | Libellé PRA |
|---|---|---|---|---|---|
| 4392 | 13055 Marseille | 13 | 469 | 13469 | LITTORAL DE PROVENCE - 13 |
| 27439 | 69123 Lyon | 69 | 196 | 69196 | ZONE MARAICHERE DE LYON - 69 |

Ces deux codes PRA figurent aussi dans la feuille `Nmcl_RA_PRA`. Les valeurs,
en-têtes et références de cellules sont conservés dans
[agreste-selected-rows.json](evidence/geography-qualification-20261029/agreste-selected-rows.json).
Ce n'est plus une attribution déduite d'une proximité spatiale ou d'une carte VNF.
**Une exclusion de Marseille ou Lyon du référentiel communal Agreste 2017 est
contredite par ces lignes.** Elles ne documentent toutefois pas la fabrication de
la couche géométrique OFB ; elles ne permettent pas d'en déduire la cause exacte
des absences ni de produire de nouveaux contours.

Les mesures précédentes restent celles du contrôle indépendant 2018, pas une
nouvelle mesure : 240,986768 km² sans aucune PRA à Marseille et 47,035294 km²
à Lyon. Voir [le contrôle ciblé](FINAL_ACCEPTANCE_REVIEW_20261029.md#anomalies-terrestres-qui-restent-ouvertes).
L'absence géométrique ne constitue jamais une règle officielle d'exclusion.

## Emprise des PRA et arrondissements municipaux

La [notice Agreste](https://agreste.agriculture.gouv.fr/agreste-web/methodon/Z_PRA_2017/methodon/)
définit les RA à partir de communes entières et les PRA comme leur croisement
avec les départements. Elle compte 432 RA hors Paris et 713 PRA. Elle indique
une actualisation communale au 1er janvier 2017 et, pour les fusions touchant
plusieurs PRA, l'attribution de la PRA de la commune pôle à la commune fusionnée.
Cette règle décrit un zonage communal, pas un masque limité aux parcelles
agricoles ou aux surfaces non urbanisées. Aucune exception pour Marseille ou
Lyon n'a été trouvée dans cette notice ou le classeur associé.

L'[Insee](https://www.insee.fr/fr/metadonnees/definition/c1282) décrit les
arrondissements municipaux comme des subdivisions de Paris, Lyon et Marseille,
sans suppression de l'unité communale. Les 45 codes municipaux recherchés
(16 Marseille, 9 Lyon, 20 Paris) sont absents de la feuille `COM`, qui contient
les communes parentes. La colonne `ARR` de ce classeur ne doit pas être confondue
avec ces arrondissements municipaux.

Le descriptif [IGN GEOFLA 2.2, annexe p.22](https://geoservices.ign.fr/sites/default/files/2021-07/DC_GEOFLA_2-2.pdf)
présente, dans son extrait officiel indexé, un traitement des arrondissements
comme unités communales de GEOFLA. **Limite d'accès :** le lien redirige aujourd'hui
vers une page HTML de cartes.gouv.fr ; le PDF complet n'a pas été récupéré.
Cet indice reste distinct des pièces intégralement lues.

Une jointure naïve entre codes de communes parentes et codes d'arrondissements
pourrait perdre les deux villes. **C'est une hypothèse de mécanisme**, pas la
preuve que l'OFB utilise GEOFLA, cette édition ou cette jointure. La généalogie
OFB ne nomme pas le fond source. Aucune règle officielle autorisant à retirer
les villes avec arrondissements n'est établie. Aucun rattachement d'arrondissement
n'est fabriqué dans cet audit.

## Métadonnées OFB et millésime géométrique

La [fiche data.gouv.fr / OFB](https://www.data.gouv.fr/datasets/petites-regions-agricoles-source-ministere-de-lagriculture-2017)
renvoie à la même couche `ref_met_petite_region_agricole_masa_pol_3857` et à Agreste.
Son [enregistrement ISO original par CSW](https://data.ofb.fr/catalogue/Donnees-geographiques-OFB/fre/csw?service=CSW&version=2.0.2&request=GetRecordById&elementSetName=full&outputSchema=http://www.isotc211.org/2005/gmd&id=b5da2acc-cc68-4378-b0c4-f7a811209f97)
a été lu intégralement et conservé : [réponse brute compressée](evidence/geography-qualification-20261029/ofb-iso.xml.gz),
[copie XML lisible](evidence/geography-qualification-20261029/ofb-iso.xml).
Seules les fins de ligne CRLF et la ligne vide finale de la copie lisible sont
normalisées ; le SHA256 du reçu porte sur la réponse brute décompressée.

| Champ vérifié | Valeur / portée |
|---|---|
| Citation du jeu, création et publication | 2017-01-01, deux dates déclarées dans la citation |
| Horodatage de la fiche ISO | 2026-09-30T10:28:57.298887Z ; date de métadonnées |
| Généalogie | Texte générique, sans fond communal, édition, jointure ni étapes de traitement |
| Résolution déclarée | Dénominateur 1000 ; ne démontre pas une précision positionnelle |
| Référence spatiale de la fiche | EPSG:2154 ; ne remplace pas le CRS de la réponse WFS contrôlée en Task 19 |
| Emprise déclarée | Rectangle métropolitain ; ne démontre pas la couverture intérieure |
| Exception Marseille/Lyon, édition corrigée | Aucune trouvée dans cet enregistrement |

Les autres dates imbriquées dans les citations de thésaurus ou de réglementation
ne datent pas le jeu. Les dates de moissonnage data.gouv.fr et de modification du
service WMS ne datent pas davantage ses coordonnées.

**Millésime retenu : nomenclature au 01/01/2017 ; millésime des géométries inconnu.**
Les dates de citation OFB rendent une origine déclarée 2017 plausible, mais ne
certifient pas le fond ou l'actualité de chaque contour. Le rattachement observé
de Freigné au 49 est compatible avec une situation antérieure au transfert du
01/01/2018 ; il ne borne pas l'âge de toutes les coordonnées. Il n'existe pas,
dans les pièces examinées, de fourchette homogène assez étayée pour remplacer
`geometry_vintage=null`. La date d'extraction WFS documentée précédemment et la
réception du snapshot le 17 octobre restent distinctes du millésime.

## Sources alternatives et versions plus récentes

La recherche porte sur les sources déjà identifiées, leurs liens producteur,
les catalogues publics et des recherches ciblées Agreste / Ministère / IGN /
INRAE / OFB / Insee / data.gouv.fr. Ce n'est pas une preuve d'inexistence d'une
autre édition. Aucun remplacement national approprié n'a été validé.

| Source examinée | Résultat et conséquence |
|---|---|
| Agreste, notice courante | Référence 2017, notice mise à jour le 20/02/2020 ; même XLS, pas de nouveau contour national livré par cette page |
| OFB, ISO et data.gouv.fr | Même couche ; aucune release corrigée ou règle d'exclusion dans les métadonnées lues |
| INRAE AgroMetInfo, DOI 10.57745/0F1QAN | Provenance publique de l'archive antérieure désormais vérifiée, mais pas un remplacement national accepté |
| DRAAF PACA, carte des RA | Composition Agreste 2017 et fond IGN Admin Express 2017 documentés ; carte régionale, pas une nouvelle couche nationale PRA |
| DRAAF AURA, panorama 2024 p.15 | Carte RA fondée sur INSEE/SSP 2017 et Admin Express 2024 dans l'extrait indexé ; PDF complet non récupéré par l'outil web (taille), pas un export national PRA validé |
| DDTM 13, carte PRA février 2012 | Extrait indexé et lien de la page Baux ruraux consultés ; PDF renvoie 503/502, aucune couleur ou inclusion de Marseille certifiée visuellement |
| Catalogue data.gouv.fr, recherche littérale | 17 résultats, essentiellement départementaux/régionaux ; [liste datée](evidence/geography-qualification-20261029/datagouv-candidates.json), recherche non exhaustive |

Sources des trois cartes : [DRAAF PACA](https://draaf.paca.agriculture.gouv.fr/regions-agricoles-a1655.html),
[DRAAF AURA](https://draaf.auvergne-rhone-alpes.agriculture.gouv.fr/IMG/pdf/18_essentiel_panorama2024_1_territoire.pdf),
[DDTM 13](https://www.bouches-du-rhone.gouv.fr/Actions-de-l-Etat/Agriculture-foret-et-developpement-rural/Agriculture/Structures-agricoles/Baux-ruraux).
Une date récente d'article ou de fond cartographique ne suffit pas à désigner
une nouvelle nomenclature ou une nouvelle géométrie PRA.

### Ce que l'archive INRAE apporte réellement

Le dépôt [Données pour AgroMetInfo](https://doi.org/10.57745/0F1QAN), version 2.0
publiée le 21/01/2025, fournit le fichier
[pra_shapefile.zip, identifiant 214154](https://entrepot.recherche.data.gouv.fr/api/access/datafile/214154).
Téléchargement complet vérifié : 5 911 666 octets,
SHA256 `2aa7b8dba936215a6f5db9914f1fb5d9364c3730d998a511f63bf2f5db124dd1`,
identique à l'archive utilisateur auditée. Le fichier PRA est le même fichier
créé dans le dépôt en juin 2024, publié initialement le 11/07/2024 ; la version
2.0 du jeu ne prouve pas une mise à jour des contours. Le README et les
métadonnées ne donnent pas leur fond ni millésime géométrique. La licence
Etalab 2.0 est maintenant documentée dans le dépôt public.

Contrôle ciblé supplémentaire en EPSG:3035, sur les contours sources non modifiés,
comparés aux mêmes communes indépendantes 2018 que l'audit précédent :

| Commune | Aire communale km² | Intersection avec la PRA Agreste attendue, INRAE km² | Même PRA, OFB km² |
|---|---:|---:|---:|
| Marseille 13055 → 13469 | 241,891666 | 232,733192 | 0,564002 |
| Lyon 69123 → 69196 | 47,980473 | 47,966347 | 0,898374 |

Ce tableau mesure l'intersection avec **la PRA attendue**, pas l'union nationale
ni la surface agricole utile. Il montre une divergence effective entre les deux
diffusions, sans prouver la cause du défaut OFB ou certifier chaque mètre carré
du contour INRAE. Les restes ne sont pas attribués automatiquement aux îles, à
l'eau ou à la généralisation. [Mesures et empreintes](evidence/geography-qualification-20261029/inrae-targeted-comparison.json).

L'[audit INRAE antérieur](PRA_INRAE_VALIDATION.md) reste applicable aux mêmes octets :
contours répétés par cellule SAFRAN, Paris supplémentaire, composantes sans code
dont deux normandes et onze hors emprise française apparente. Les deux
composantes normandes sont couvertes par OFB mais pas par les PRA codées INRAE
dans cet audit. La nouvelle provenance publique ne résout pas ces anomalies.
Remplacer le snapshot complet, ou lui greffer seulement les deux villes, ne
serait donc pas une conclusion justifiée par ce contrôle. Aucun assemblage
hybride n'est proposé et aucun poids SAFRAN n'est réutilisé.

## Arbitrage et pièces nécessaires à la clôture

| Décision possible | Motif de l'arbitrage |
|---|---|
| `ACCEPT` | Non : exclusion géométrique officielle non documentée ; les deux communes ont au contraire un rattachement Agreste explicite |
| `ACCEPT_WITH_SCOPE` | Non retenu : la fidélité de l'export est établie, mais l'emprise des deux PRA concernées reste non qualifiée ; définir un périmètre produit restreint serait une décision distincte, pas une explication officielle des omissions |
| `REPLACE_REFERENCE` | Non retenu : pistes publiques trouvées, mais aucun remplacement national démontré plus adapté et accepté ; INRAE exige encore une qualification complète |
| **`BLOCKED`** | **Retenu : rattachements connus, cause/statut des omissions du snapshot OFB et emprise effectivement voulue non documentés** |

Le déblocage nécessite une réponse du détenteur/producteur (Ministère/SSP,
avec l'OFB diffuseur) ou une documentation officielle publiée qui :

1. qualifie les divergences 13055 → 13469 et 69123 → 69196 dans cette couche ;
2. précise si les communes parentes ou les arrondissements ont servi à fabriquer
   les contours et comment les codes ont été raccordés ;
3. donne le fond communal, son édition, la méthode de constitution et la règle
   d'emprise, ou désigne une version officielle de remplacement ;
4. explique, si une exclusion de diffusion est voulue, sa portée et sa relation
   aux rattachements communaux Agreste.

Aucune demande n'a été envoyée au producteur pendant cet audit. La règle
d'acceptation reste `reference_verified_national=false` dans le paquet inchangé.
Le verdict documentaire est enregistré dans
[acceptance.json](evidence/geography-qualification-20261029/acceptance.json).
Le statut technique global demeure NOT READY selon la revue précédente ;
aucun autre audit technique ou opération nationale n'est relancé ici.

## Reproduction et intégrité du périmètre

[Reçus des sources](evidence/geography-qualification-20261029/source-receipts.json)
(SHA256 des réponses brutes, erreurs et limitations),
[métadonnées OFB moissonnées](evidence/geography-qualification-20261029/ofb-datagouv.json),
[métadonnées INRAE](evidence/geography-qualification-20261029/inrae-dataset.json).
Les redirections temporaires signées ne sont pas conservées. Les fichiers lourds
restent dans `work`, hors dépôt. Aucun nouveau fichier de contours n'est publié.

Extraction reproductible du XLS, avec l'environnement d'audit existant `xlrd` :

```sh
curl -fL --max-time 60 \
  'https://agreste.agriculture.gouv.fr/agreste-web/download/methode/Z_PRA_2017/Referentiel_CommuneRA_PRA_2017.xls' \
  -o /tmp/Referentiel_CommuneRA_PRA_2017.xls
sha256sum /tmp/Referentiel_CommuneRA_PRA_2017.xls
python - <<'PY'
import xlrd
s = xlrd.open_workbook('/tmp/Referentiel_CommuneRA_PRA_2017.xls').sheet_by_name('COM')
for i in range(6, s.nrows):
    if s.cell_value(i, 0) in {'13055', '69123'}:
        print(i + 1, s.row_values(i))
PY
```

La comparaison INRAE est reproductible en lisant les SHP/SHX/DBF du ZIP en mémoire
avec `shapefile.Reader`, en retenant les codes 13469 et 69196 et en vérifiant
qu'il n'y a qu'un WKB distinct par code (11 et 9 répétitions respectivement).
Reprojeter ces deux géométries et les communes 13055/69123 de
`evidence/acceptance-20261029/selected-communes-2018.json` avec
`Transformer.from_crs(4326, 3035, always_xy=True)` ; calculer
`commune.intersection(pra).area / 1e6`. Refaire avec les deux mêmes codes dans
le `reference.json` OFB existant. Aucun traitement de réparation ou de lissage.

Les empreintes de tous les fichiers `config/coverage` et `supabase/migrations`
avant cette reprise sont conservées dans
[unchanged-protected-files.json](evidence/geography-qualification-20261029/unchanged-protected-files.json)
et recontrôlées après rédaction. Validation pertinente : cohérence des JSON,
rattachements et empreintes, liens locaux, `git diff --check` et restriction du
diff à la documentation Task 19. Aucun changement de logiciel ne nécessite ici
de nouvelle acquisition ERA5, de test distant ou de migration.
