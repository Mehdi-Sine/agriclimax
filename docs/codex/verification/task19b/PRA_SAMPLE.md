# Échantillon opérationnel reproductible

73/713 PRA (environ 10 %), 13 régions métropolitaines, Corse comprise.
Échantillon raisonné de diversité opérationnelle, **pas un tirage statistique** :
son taux d'indisponibilité ne peut pas être extrapolé sans précaution à toutes
les PRA.

Le fichier versionné est `config/pilots/pra73-v1.json`. Il conserve code, nom,
département source, région, surface EPSG:3035, catégories et raison de sélection.
Une PRA appartient à un département dans cette nomenclature ; les réserves de
rattachement historique ne sont pas corrigées par un découpage géométrique.

Algorithme `pra-pilot73-maximin-1` : ancres nommées pour plaines, massifs, littoraux,
frontières et limites connues ; plus grande PRA nationale ; quotas régionaux
explicites ; extrêmes régionaux de surface si le quota le permet ; complément
maximin des distances entre centroïdes en EPSG:3035, avec départage par code.
Les catégories fondées sur le nom ne constituent pas une classification d'occupation
du sol ni un masque terrestre.

Reproduction :

```sh
PYTHONPATH=engine/src python scripts/pra_pilot_sample.py \
  --bundle config/coverage/ofb-masa-pra-2017-snapshot-20261017 \
  --output /tmp/pra73-v1.json
cmp config/pilots/pra73-v1.json /tmp/pra73-v1.json
```

Support : **1 808 cellules distinctes, 1 892 poids existants, 86 tuiles de 1°**, acquises
via 27 groupes de 2°. Les ancres Crozon, Corse littorale et montagneuse,
Dévoluy, Jura, Pyrénées, Alpes, Beauce, Grand Est, Nord, Landes et Massif central
sont conservées. Les PRA 13469 et 69196 sont incluses avec les réserves connues ;
aucune prétention de couverture communale exhaustive à Marseille ou Lyon.

| Code | Nom | Dép. | Surface km² | Raison |
|---|---|---|---:|---|
| 02034 | SAINT-QUENTINOIS ET LAONNOIS - 02 | 02 | 2368.452 | extrême régional de surface |
| 04460 | MONTAGNE DE HAUTE-PROVENCE - 04 | 04 | 4404.796 | plus grande PRA nationale |
| 05236 | DEVOLUY - 05 | 05 | 186.686 | haute montagne Dévoluy |
| 07171 | PLATEAUX DU HAUT ET MOYEN VIVARAIS - 07 | 07 | 3256.913 | extrême régional de surface |
| 08021 | ARDENNE - 08 | 08 | 1046.817 | complément maximin des centroïdes EPSG:3035 dans la région |
| 09472 | REGION PYRENEENNE - 09 | 09 | 2382.321 | massif des Pyrénées et frontière |
| 13244 | CAMARGUE - 13 | 13 | 1212.175 | Méditerranée et Camargue |
| 13469 | LITTORAL DE PROVENCE - 13 | 13 | 175.434 | littoral, réserve Marseille documentée |
| 15409 | CHATAIGNERAIE - 15 | 15 | 1113.005 | complément maximin des centroïdes EPSG:3035 dans la région |
| 18434 | CHAMPAGNE BERRICHONNE - 18 | 18 | 2994.371 | extrême régional de surface |
| 19421 | ARTENSE - 19 | 19 | 14.757 | extrême régional de surface |
| 21010 | TONNEROIS - 21 | 21 | 193.716 | complément maximin des centroïdes EPSG:3035 dans la région |
| 22358 | LITTORAL BRETON NORD - 22 | 22 | 1438.062 | complément maximin des centroïdes EPSG:3035 dans la région |
| 26463 | BARONNIES - 26 | 26 | 1217.243 | complément maximin des centroïdes EPSG:3035 dans la région |
| 27330 | VEXIN BOSSU - 27 | 27 | 207.890 | complément maximin des centroïdes EPSG:3035 dans la région |
| 27351 | PERCHE - 27 | 27 | 39.075 | extrême régional de surface |
| 28341 | BEAUCE DUNOISE - 28 | 28 | 765.350 | plaine céréalière Beauce |
| 29102 | PRESQU ILE DE CROZON - 29 | 29 | 121.701 | Bretagne littorale, absence observée Task19 |
| 29358 | LITTORAL BRETON NORD - 29 | 29 | 622.049 | littoral breton nord |
| 2A258 | LITTORAL CORSE - 2A | 2A | 525.649 | littoral corse potentiellement partiel |
| 2B259 | COTEAUX CORSES - 2B | 2B | 1543.695 | complément maximin des centroïdes EPSG:3035 dans la région |
| 2B260 | MONTAGNE CORSE - 2B | 2B | 2413.777 | montagne corse |
| 30465 | VALLEE DU RHONE - 30 | 30 | 572.537 | complément maximin des centroïdes EPSG:3035 dans la région |
| 32386 | VIC-BIHL - 32 | 32 | 14.207 | extrême régional de surface |
| 33115 | BAS-MEDOC - 33 | 33 | 177.718 | complément maximin des centroïdes EPSG:3035 dans la région |
| 34412 | PLATEAUX DU SOMMAIL ET DE L'ESPINOUZE - 34 | 34 | 655.503 | complément maximin des centroïdes EPSG:3035 dans la région |
| 35098 | POLDERS DU MONT-SAINT-MICHEL - 35 | 35 | 26.087 | extrême régional de surface |
| 36436 | BOISCHAUT DU SUD - 36 | 36 | 2264.974 | complément maximin des centroïdes EPSG:3035 dans la région |
| 37074 | BASSIN DE SAVIGNE - 37 | 37 | 168.120 | complément maximin des centroïdes EPSG:3035 dans la région |
| 38457 | REGION HAUTE ALPINE - 38 | 38 | 2494.881 | complément maximin des centroïdes EPSG:3035 dans la région |
| 39449 | HAUT JURA - 39 | 39 | 559.330 | massif du Jura et frontière suisse |
| 40378 | GRANDES LANDES - 40 | 40 | 3670.603 | façade Atlantique et Landes |
| 41434 | CHAMPAGNE BERRICHONNE - 41 | 41 | 71.186 | extrême régional de surface |
| 43417 | CEZALLIER - 43 | 43 | 26.257 | extrême régional de surface |
| 44104 | PAYS DE CHATEAUBRIANT - 44 | 44 | 640.166 | complément maximin des centroïdes EPSG:3035 dans la région |
| 44364 | PRESQU'ILE GUERANDAISE ET GRANDE BRIERE - 44 | 44 | 533.418 | complément maximin des centroïdes EPSG:3035 dans la région |
| 45338 | GATINAIS PAUVRE - 45 | 45 | 1217.332 | complément maximin des centroïdes EPSG:3035 dans la région |
| 46409 | SEGALA - 46 | 46 | 695.175 | complément maximin des centroïdes EPSG:3035 dans la région |
| 47394 | CAUSSES - 47 | 47 | 38.282 | complément maximin des centroïdes EPSG:3035 dans la région |
| 50081 | LA HAGUE - 50 | 50 | 199.773 | complément maximin des centroïdes EPSG:3035 dans la région |
| 50354 | LE MORTAINAIS - 50 | 50 | 809.245 | complément maximin des centroïdes EPSG:3035 dans la région |
| 51317 | CHAMPAGNE CRAYEUSE - 51 | 51 | 3650.110 | plaine céréalière du Grand Est |
| 52311 | PLATEAU LANGROIS,MONTAGNE, - 52 | 52 | 898.390 | complément maximin des centroïdes EPSG:3035 dans la région |
| 53357 | ZONE D'ELEVAGE - 53 | 53 | 2454.907 | complément maximin des centroïdes EPSG:3035 dans la région |
| 56363 | REGION CENTRALE - 56 | 56 | 2922.851 | extrême régional de surface |
| 57004 | VALLEE DE LA MOSELLE - 57 | 57 | 246.895 | complément maximin des centroïdes EPSG:3035 dans la région |
| 58340 | PUISAYE - 58 | 58 | 145.518 | complément maximin des centroïdes EPSG:3035 dans la région |
| 59025 | FLANDRE INTERIEURE - 59 | 59 | 769.381 | plaine intérieure du Nord |
| 59325 | FLANDRE MARITIME - 59 | 59 | 448.826 | Nord et frontière maritime |
| 60330 | VEXIN FRANCAIS - 60 | 60 | 305.729 | complément maximin des centroïdes EPSG:3035 dans la région |
| 62324 | PLAINE DE LA LYS - 62 | 62 | 174.618 | extrême régional de surface |
| 63426 | LIMAGNE AGRICOLE - 63 | 63 | 729.673 | Massif central et Limagne |
| 64142 | MONTAGNE DU BEARN - 64 | 64 | 1253.491 | complément maximin des centroïdes EPSG:3035 dans la région |
| 65146 | MONTAGNE DE BIGORRE - 65 | 65 | 2995.849 | extrême régional de surface |
| 66254 | CRU BANYULS - 66 | 66 | 78.110 | complément maximin des centroïdes EPSG:3035 dans la région |
| 68302 | RIED - 68 | 68 | 44.673 | extrême régional de surface |
| 68303 | SUNDGAU - 68 | 68 | 840.467 | frontière est Sundgau |
| 69196 | ZONE MARAICHERE DE LYON - 69 | 69 | 136.713 | réserve Lyon documentée |
| 70007 | REGION DES PLATEAUX - 70 | 70 | 2745.019 | extrême régional de surface |
| 71183 | BRIONNAIS - 71 | 71 | 400.050 | complément maximin des centroïdes EPSG:3035 dans la région |
| 72345 | BEAUGEOIS - 72 | 72 | 56.615 | extrême régional de surface |
| 74458 | GRANDES ALPES - 74 | 74 | 518.834 | Alpes et frontière |
| 76046 | PAYS DE CAUX - 76 | 76 | 2892.467 | Normandie et façade Manche |
| 77335 | BRIE CHAMPENNOISE - 77 | 77 | 358.685 | complément maximin des centroïdes EPSG:3035 dans la région |
| 78054 | YVELINES - 78 | 78 | 729.097 | extrême régional de surface |
| 79373 | BOCAGE - 79 | 79 | 1475.519 | complément maximin des centroïdes EPSG:3035 dans la région |
| 83248 | REGIONS FRUITIERES DE SOLLIES-PONT ET DE FREJUS - 83 | 83 | 454.322 | complément maximin des centroïdes EPSG:3035 dans la région |
| 84463 | BARONNIES - 84 | 84 | 168.695 | extrême régional de surface |
| 85368 | BAS BOCAGE - 85 | 85 | 3620.772 | extrême régional de surface |
| 87432 | HAUT-LIMOUSIN - 87 | 87 | 3804.623 | extrême régional de surface |
| 88307 | MONTAGNE VOSGIENNE - 88 | 88 | 2102.502 | massif vosgien |
| 90450 | PLATEAUX MOYENS DU JURA - 90 | 90 | 45.567 | extrême régional de surface |
| 95332 | VALLEE DE LA SEINE - 95 | 95 | 11.124 | petite PRA nationale |
