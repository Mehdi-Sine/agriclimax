# Task 19 — disponibilité native et budget mesuré — 18 octobre 2026

**NOT READY pour validation nationale. Backfill national déconseillé à ce stade.**
Branche `codex/19-national-coverage`, PR draft #40, reprise après `90ebecb`.
Les 713 géométries et 14 541 intersections sont intégrées localement ; le pilote
climatique quotidien réel reste limité à quatre PRA. Une sonde spatiale nationale
sur deux instants est ajoutée ici ; elle n'est ni un backfill ni un pilote
quotidien national. Aucune migration distante, purge, modification scientifique,
activation payante ou fusion n'a été effectuée.

## 1. Couverture : observations nationales, certification structurelle bloquée

Une seule requête CDS `reanalysis-era5-land`, deux variables natives T2m (K) et TP
(m), 1er et 7 octobre 2026 à 12:00 UTC, emprise [52, −6, 41, 10], grille CDS
0,1° inchangée. Fichier de **150 875 octets**, reçu le 18 octobre à 11:29:06 UTC,
SHA256 et requête dans [le reçu](evidence/final/native-probe-receipt.json).
Le NetCDF reste hors Git et PostgreSQL, dans le cache local. Lecture des coordonnées
exactes à 10⁻⁶ degré près, sans sélection du voisin, interpolation ou remplissage.
Aucune réduction quotidienne ou qualification de risque à partir de ces instants.

Les 6 861 cellules sont présentes comme coordonnées. **269 sont NaN pour les deux
variables aux deux instants**, les 6 592 autres ont des valeurs finies. Aucun cas
variable/instant discordant n'est détecté dans cette sonde. Les sept cellules
manquantes des quatre PRA pilotes sont retrouvées exactement. Cela renforce
l'hypothèse d'un problème de support natif côtier, sans prouver la permanence.

Pondération : intersections existantes EPSG:3035, dénominateur = surface entière
PRA. Aucune renormalisation sur les cellules valides. Les proportions observées
sont identiques aux deux instants :

| Couverture **observée aux deux instants** | PRA |
|---|---:|
| 0 % | 1 |
| >0 et <90 % | 31 |
| ≥90 et <99 % | 27 |
| ≥99 % | 654 |
| Total | 713 |

68 PRA ont une fraction strictement inférieure à 100 % à la précision 10⁻¹⁰,
dont neuf dans la catégorie ≥99 %. 59 sont sous 99 %. L'aire non représentée
aux deux instants est 6 673,643299 km² sur 548 320,355649 km², soit une couverture
surfacique nationale observée de 98,782893 %. Ce taux national pondéré ne dit pas
que 98,8 % des PRA possèdent un diagnostic valide.

**Classement structurel certifié : 713 inconnues**, pas 713 absentes. Le
[tableau structurel](evidence/final/structural-inventory.csv) contient explicitement
une valeur vide pour chaque taux non établi. Le
[tableau national observé des 713 PRA](evidence/final/native-probe-pra.csv) porte
séparément les proportions de chaque instant. Le
[rapport de sonde](evidence/final/native-probe-audit.json) liste les 269 cellules
manquantes et les 59 PRA sous 99 %. Ces catégories ne doivent pas être présentées
comme des classes structurelles définitives.

ECMWF publie le masque invariant sur sa
[documentation ERA5-Land](https://confluence.ecmwf.int/spaces/CKB/pages/140385202/ERA5-Land+data+documentation),
lien NetCDF `lsm_1279l4_0.1x0.1.grb_v4_unpack.nc`. Le téléchargement est refusé
HTTP 403 par la politique réseau actuelle. L'utilisateur a choisi de poursuivre
avec ce contrôle signalé bloqué, sans changement de politique ni contournement.
Même obtenu, ce masque fractionnaire interpolé doit être confronté au support
natif effectivement disponible ; un seuil 0,5 appliqué aveuglément ne constitue
pas une certification. Voir aussi la
[discussion ECMWF sur cette discordance](https://forum.ecmwf.int/t/era5-land-land-mask-vs-what-is-actually-land/13114)
(témoignage technique, pas une règle scientifique approuvée).

Trois axes restent séparés :

- **Support structurel** : masque/grille/fournisseur vérifiés, encore en attente.
- **Complétude temporelle** : deux instants ici ; sept jours complets contrôlés
  uniquement pour les quatre PRA du pilote précédent. Une cellule présente ici
  peut manquer à une autre heure ; aucun taux quotidien national n'en découle.
- **Validité d'indicateur** : les métriques blé restent exploratoires ; THI PRA
  reste non supporté, notamment faute d'humidité et de validation spatiale.
  Une valeur climatique disponible ne valide pas le modèle agronomique.

## 2. Crozon et les autres littoraux

Crozon (29102) est le seul zéro observé : six cellules absentes, également NaN
sur les 192 heures sources du pilote antérieur. Les intersections couvrent
bien sa surface ; changer leurs poids ne créerait pas de climat natif.
À titre de comparaison : 29103 à 39,9407 %, La Hague 50081 à 43,9270 %,
littoral corse 2A258 à 46,9222 %, Val de Saire 50083 à 52,9032 %.
Les six PRA corses vont de 46,9222 à 99,9839 % dans cette sonde ; la montagne
corse 2B260 garde précisément la même petite lacune que le pilote.
La liste complète des 68 proportions observées partielles figure en annexe.

## 3. Traitement scientifique proposé, non activé

Conserver `unavailable` pour Crozon et des scalaires complets NULL lorsqu'une
cellule requise manque. Conserver séparément couverture, cellules attendues et
valides, provenance, fraîcheur, observations partielles et statut scientifique.
Ni valeur voisine, ni interpolation, ni renormalisation implicite. Le moteur
n'utilise pas le seuil 99 % pour autoriser silencieusement un résultat complet.

Options à soumettre à validation scientifique après le contrôle du support :

| Option | Conditions et limites | Calcul / stockage indicatifs |
|---|---|---|
| SAFRAN/SIM complémentaire | Source Météo-France indépendante, grille native et référentiel vérifiés ; contrôler couverture Corse/littoraux, période, révisions, unités et horodatage ; comparer les biais sur zones communes. Calculs natifs puis nouvelles intersections PRA. Ne jamais traiter les cellules SAFRAN INRAE comme ERA5. | Nouvelle chaîne d'acquisition et réduction ; pour 68 PRA ×90 jours ×1024 octets : 6,27 Mo de scalaires supplémentaires, hors correspondances, reçus et diagnostics. Nombre de cellules réellement nécessaires et téléchargement non mesurés. |
| ERA5 à résolution propre | Source distincte, cellules côtières mixtes mer/terre, résolution et orographie différentes. Tester représentativité terrestre et biais avant toute substitution. Ne pas présenter comme ERA5-Land fin. | Même ordre de stockage de scalaires pour une sélection de PRA ; calcul et volume source dépendent de la grille/variables retenues. Aucun budget de téléchargement mesuré. |
| Maintien indisponible / couverture partielle explicite | Scientifiquement transparent en attendant une source compatible. Aucune prétention à un diagnostic représentatif de la totalité. | Aucun téléchargement supplémentaire, couverture existante et flags conservés. |

SAFRAN/SIM fournit des champs sur un maillage d'environ 8 km, selon les
[métadonnées Météo-France SIM](https://www.data.gouv.fr/datasets/meteo-france-donnees-sim)
et la [documentation Météo-France](https://confluence-meteofrance.atlassian.net/wiki/spaces/OpenDataMeteoFrance/pages/621510657).
Disponibilité précise sur les PRA déficitaires et licence de chaque produit
à vérifier avant import. Aucun service complémentaire n'a été activé.
Une série composite exigerait une identité de source/méthode propre, des
climatologies compatibles et une validation des ruptures : pas de mélange caché.

## 4. PostgreSQL : mesures avant/après et décision

Les tests tournent dans le conteneur PostGIS 17 local déjà utilisé pour les
713 contours. Les tables d'expérience sont temporaires et annulées par ROLLBACK.
Aucun résultat météorologique synthétique n'est publié. Sources, paramètres et
forme des reçus proviennent du pilote ; les dates/digests de capacité sont
explicitement synthétiques. Les identifiants de géométrie et de poids sont ceux
des PRA réelles, avec digests distincts par lot. Aucun reçu essentiel supprimé.

96 tuiles natives de 1° ; 1 440 liens PRA/tuile par fenêtre ; 1 à 5 tuiles par
PRA (227/329/76/78/3 PRA utilisent respectivement 1/2/3/4/5 tuiles).
90 jours = 13 fenêtres : **9 269 lots PRA** pour le contrat actuel de persistance,
mais au plus **1 248 acquisitions tuile/fenêtre** si chaque tuile est chargée une
fois et son cache partagé. Les mois et révisions peuvent fragmenter les reçus.
Diminuer les acquisitions ne permet pas de supprimer les états/reprises par PRA.

| Mesure locale (tables + index) | Octets |
|---|---:|
| 4 lots pilotes réellement persistés | 81 920 |
| Métadonnées pilotes, taille moyenne / maximale de colonne | 2 275 / 2 488 |
| 9 269 lots représentatifs, schéma actuel | 28 934 144 |
| Dont index des lots | 1 138 688 |
| Colonne metadata, moyenne / maximum dans ce scénario | 2 212,07 / 2 520 |
| Prototype mutualisé : lots + sources + liens | 28 975 104 |
| Surcoût du prototype mutualisé | 40 960 |
| 64 170 lignes quotidiennes non NULL synthétiques, deux index inclus | 53 821 440 |
| Dont index quotidiens | 20 930 560 |
| 74 152 diagnostics hebdomadaires non NULL synthétiques | 41 689 088 |
| Dont index diagnostics | 19 152 896 |

La compression/TOAST PostgreSQL explique pourquoi additionner les tailles JSON
sérialisées surestime le stockage. La normalisation testée conserve exactement
les métadonnées (reconstruction SQL vérifiée), mais ses longues clés texte et
index de liaison absorbent le gain. **Prototype non retenu ; aucun gain physique
appliqué ni annoncé.** Une autre conception à clés internes numériques pourrait
être étudiée ultérieurement, avec adaptateur et migration progressive ; elle
n'est pas nécessaire pour ce scénario et n'est pas validée ici.

Les tables restent inchangées. Le planificateur remplace seulement l'hypothèse
16 Kio par **4 Kio/lot**, soit environ **31,2 % de marge** au-dessus de la capacité
mesurée totale. C'est une recalibration documentée, pas une réduction réelle
de 114 Mo dans une base nationale existante. Une future augmentation des reçus,
flags, paramètres ou révisions impose une nouvelle mesure. Le garde-fou de
persistance à 375 Mo demeure inchangé.

Déporter les reçus détaillés hors PostgreSQL peut rester une option : archive
immuable adressée par SHA256 avec requête, source, date, taille et lien conservés
en DB. Exiger vérification de lecture, durée de conservation et restauration
avant toute suppression. Aucun déport activé ; aucun bucket ou coût payé créé.
Les petits reçus compressés mesurés ne justifient pas actuellement cette
complexité. Les journaux de reprise existants restent bornés à 100 fichiers ;
pas de duplication nationale de logs verbeux ou de sources horaires en DB.

## 5. Budget actualisé à 90 jours

Supabase DEV observé en transaction READ ONLY le 18 octobre à 11:26:46 UTC :
**25 376 435 octets**, zéro table Task19 distante, zéro objet Storage.
Les références locales coûtent 14 934 016 octets supplémentaires, dont
11 272 192 pour géométries/index et 3 530 752 pour poids/index.

| Composante prudente | Mo décimaux |
|---|---:|
| Base DEV mesurée | 25,376435 |
| Référentiel / poids, delta local mesuré | 14,934016 |
| 64 170 jours-PRA × 1024 octets | 65,710080 |
| 9 269 lots ×4096 octets | 37,965824 |
| 8 diagnostics ×713 PRA ×13 fenêtres ×1024 octets | 75,931648 |
| Journaux + catalogues, réserves non mesurées | 2,000000 |
| Croissance de l'existant, réserve non mesurée | 25,000000 |
| **Total avec diagnostics hebdomadaires systématiques** | **246,918003** |
| **Total sans diagnostics systématiques** | **170,986355** |

Ancien scénario avec la même base DEV : 360,815475 Mo. Écart de budget :
113,897472 Mo, exclusivement lié à une réserve de métadonnées désormais calibrée.
Marge : **128,081997 Mo sous 375 Mo**, mais seulement **3,081997 Mo sous l'objectif
renforcé de 250 Mo** pour le scénario avec tous les diagnostics. En remplaçant
également les provisions quotidiennes/diagnostics par les tailles mesurées et
en gardant les réserves, le scénario vaut 191,755123 Mo. Ce dernier n'est pas
retenu comme plafond prudent. Ni WAL, ni egress, ni croissance illimitée ne sont
couverts par ces chiffres. La
[documentation Supabase](https://supabase.com/docs/guides/platform/database-size)
distingue taille DB et disque ; le plafond Free annoncé demeure 500 Mo.

Diagnostics à la demande : le pipeline les produit déjà seulement lorsque des
paramètres sont explicitement fournis. Ne pas activer un produit cartésien de
productions/paramètres/PRA. Le scénario 170,99 Mo est une base sans diagnostic
systématique, pas une enveloppe illimitée de diagnostics gratuits.

## 6. Conservation scientifique, Task 20 et productions futures

Rétention glissante 90 jours toujours en **dry-run**. Aucun effacement, cron de
purge ou changement de l'historique v0.2. Avant activation : cartographier les
consommateurs/historiques, archiver les éléments nécessaires, vérifier restauration
et recomputation, puis autoriser séparément un plan de rétention. Les résumés
scientifiques de longue durée et climatologies doivent être séparés du glissant.
Une révision supplémentaire multiplie les lignes climatiques/diagnostiques ; le
présent budget n'en couvre qu'une. La suppression de lignes ne récupère pas
immédiatement les octets alloués sans maintenance : ne pas la compter comme gain
immédiat ou comme politique déjà testée.

Les moyennes PRA ne permettent pas de recalculer les seuils, durées de séquence
ou extrema locaux. Préserver l'accès aux sources natives, leurs reçus/checksums,
les versions et paramètres ; pour une source révisable, une simple URL de
re-téléchargement ne garantit pas la reproduction bit à bit. Les artifacts CI
à sept jours ne constituent pas une archive scientifique pérenne.

Ordres de grandeur **non téléchargés**, float32 sans format, compression ou index :
6 861 cellules ×90 jours ×4 statistiques ×4 octets = 9,88 Mo de valeurs natives
quotidiennes ; deux variables horaires ×24 h ×91 jours = 119,88 Mo de valeurs
pour les seules cellules utiles, ou 202,95 Mo si 96 tuiles de 121 points sont
chargées. Ces niveaux ne remplacent pas les heures pour les indicateurs horaires.
1991–2020 comporte 10 958 jours : les quatre statistiques natives quotidiennes
représentent déjà 1,203 Go de valeurs. Task20 devra réduire à la résolution
scientifique requise puis conserver des statistiques de référence versionnées,
pas l'historique national brut dans PostgreSQL Free. Aucune climatologie nationale
n'est calculée ici.

50–100 productions doivent partager météo et acquisitions. Répliquer les huit
diagnostics hebdomadaires par production donnerait environ 2,08–4,17 Go sur la
base des tables de capacité mesurées, ou 3,80–7,59 Go avec la provision 1024 octets
par ligne ; cela ne tient pas dans Free. Préférer définitions réutilisables,
sélections explicites, cache de résultats sparse et budgets par version/paramètre.
Des besoins scientifiques nouveaux imposeront variables natives et mesures
supplémentaires, pas seulement de nouveaux libellés.

## 7. Contrôles géographiques et provenance : acquis et blocages

L'archive fournie est à nouveau vérifiée : CRC correct, SHA256 identique, trois
membres (GeoJSON, comparaison INRAE, texte descriptif), **aucun XML WFS**.
Les validations du bundle, géométries, somme des poids, petits territoires,
montagne, littoral et Corse sont relancées dans les tests.
Paris demeure un territoire administratif sans PRA officielle : aucun code
75000 ajouté aux 713 codes. Les nomenclatures communales 2017 ne sont pas un
substitut géométrique à des limites administratives indépendantes.

L'accès au fichier départemental IGN/Admin Express diffusé par DINUM/Etalab
(`.../contours-administratifs/2026/geojson/departements-5m.geojson`) est refusé
HTTP 403. Cette édition 2026, même accessible, serait un contrôle indépendant
avec **différence de millésime et généralisation 5 m à déclarer**, pas une édition
2017 présumée identique. Il faut d'abord identifier une édition officielle
compatible, puis calculer par département intersections, hors-département,
différences symétriques, trous et îles, avec Paris séparé. Aucune aire de lacune
administrative ni concordance géographique complète n'est inventée.

| Métadonnée | Statut vérifié |
|---|---|
| Réception de l'archive / identifiant snapshot | 17 octobre 2026 / `ofb-masa-pra-2017-snapshot-20261017` |
| Date réelle d'extraction WFS | Non vérifiée indépendamment ; le snapshot ne la certifie pas |
| Millésime des géométries | Non établi |
| Nomenclature et rattachements textuels | Agreste 2017, 713 codes concordants avec le XLS fourni |
| Origine officielle déclarée | OFB/MASA, couche `ref_met_petite_region_agricole_masa_pol_3857`, WFS2 ; conversion CRS84 déclarée, GeoJSON contrôlé |
| XML original / concordance de conversion | Absent ; SHA déclaré antérieurement non recalculable |
| Licence | Licence Ouverte 2.0 selon métadonnées officielles de diffusion ; texte non fourni dans l'archive |

Le manifeste garde `reference_verified_national=false`. Les écarts déjà mesurés
avec INRAE ne sont pas requalifiés comme erreurs administratives sans ce contrôle.
Aucune donnée approximative n'est substituée au référentiel ministériel.

## 8. Migrations et validations

**Aucune migration nouvelle ou modifiée.** La migration existante
`20261017190818_pra_territorial_aggregation.sql` est inchangée, appliquée uniquement
localement lors de l'étape précédente. Le prototype d'optimisation est une
expérience SQL temporaire, pas un changement du modèle persistant.

- `make check` : réussi, 181 tests Python, 220 tests web, lint/typecheck/build,
  contrats, inventaire forward-only et contrôles de confidentialité des sources/bundle.
- Tests géographie/agrégation/reprise/disponibilité : 37 réussis ; tests nouveaux
  empêchant la confusion support inconnu / absent, renormalisation et classes
  incorrectes aux frontières 90/99 %.
- Vérification indépendante des sept sources NetCDF pilotes : 2 492 comparaisons,
  écart maximal zéro. Aucun nouveau téléchargement quotidien pilote.
- PostGIS local : migrations, RLS/privilèges, contrats, idempotence et reprise,
  stockage, blé et pipeline historique : réussite. Capacité : tables NULL puis
  non NULL, 9 269 lots et prototype mutualisé, ROLLBACK ; reconstruction sans
  perte vérifiée. Rejeu des quatre lots réels : aucune nouvelle insertion.
- APIs et `/territories` : 713 résultats paginés, quatre PRA réelles, champs
  absents NULL, Crozon indisponible, Corse partielle non arrondie à 100 %, stale,
  source ERA5-Land, live/démo distincts ; 1440/768/390 px, aucun débordement ni
  violation axe A/AA dans les 12 vues. Bridge PostGIS local réel, pas un mock.
- Preview avant push : `/territories` HTTP 200 avec bypass uniquement en en-tête,
  état explicite « référentiel non déployé » ; API référence HTTP 502 contrôlé,
  schéma Task19 absent de DEV. Cela n'est pas une validation distante des données
  réelles. Pas de secret, reçu source ou coordonnées brutes dans les réponses
  inspectées. Nouvelle vérification du dernier déploiement et CI consignée dans
  les preuves et la PR après push.

Les preuves du 18 octobre sont dans `evidence/final/` et `logs/final/`. Les preuves
antérieures ne sont ni écrasées ni présentées comme de nouveaux téléchargements.
Les captures du pilote restent dans `screenshots/official/`, le nouveau rapport
navigateur confirme les mêmes 12 cas. Aucune preuve synthétique de capacité ne
sert de preuve de disponibilité climatique.

## 9. Reproduction bornée

```sh
export PYTHONPATH=engine/src
python scripts/pra_native_probe.py --root work/task19/final
# Exécution explicite : une seule requête spatiale à deux instants ; cache vérifié.
python scripts/pra_native_probe.py --root work/task19/final --execute
python scripts/pra_native_probe_audit.py \
  --bundle config/coverage/ofb-masa-pra-2017-snapshot-20261017 \
  --netcdf work/task19/final/native-probe.nc \
  --receipt work/task19/final/native-probe-receipt.json \
  --output work/task19/final/audit
python scripts/pra_availability_inventory.py \
  --bundle config/coverage/ofb-masa-pra-2017-snapshot-20261017 \
  --output work/task19/final/structural
```

Le dernier outil ne déduit jamais le support structurel d'une sonde temporelle.
Un fichier `--support` doit porter une provenance et une attestation de support
natif vérifié ; cet outil comptabilise, il ne valide pas la source à la place de
l'opérateur. Le garde d'archive vérifie les checksums du bundle.

Pour la capacité, après import officiel dans le conteneur **local** documenté :
exécuter `supabase/tests/pra_metadata_capacity.sql` et
`supabase/tests/pra_filled_capacity.sql` via `docker exec ... psql -v ON_ERROR_STOP=1`.
Ces fichiers n'ont aucune URL distante et annulent leurs tables temporaires.
Le premier ne doit pas être exécuté contre une base sans les quatre lots pilotes.

## 10. Décision avant nationalisation

**Ne pas passer au backfill national.** Le budget d'une révision à 90 jours est
maintenant sous 250 Mo dans le scénario documenté, mais cela ne résout pas les
lacunes scientifiques ni ne certifie la couverture opérationnelle.

Restent nécessaires : masque/support natif vérifié sur les 6 861 cellules,
classement structurel définitif, contrôle administratif géométrique indépendant,
XML original et provenance/version géométrique à consolider, politique scientifique
explicite des littoraux et validation de toute source complémentaire. Le maintien
indisponible est préférable à un diagnostic complet fictif. Le déploiement distant
Task19, la validation distante sur données réelles et la rétention non destructive
restent des étapes séparées avant exploitation continue.

## Annexe : 68 PRA partiellement ou non représentées dans la sonde

**Observations à deux instants, pas certification structurelle.** Les 645 autres
PRA sont complètes dans cette sonde ; elles ne sont pas certifiées complètes dans
le temps. Données détaillées pour toutes les PRA dans le CSV national.

| Code | PRA | Couverture observée aux deux instants |
|---|---|---:|
| 29102 | PRESQU ILE DE CROZON - 29 | 0.000000 % |
| 29103 | ZONE LEGUMIERE DE LA PENEPLAINE SUD - 29 | 39.940707 % |
| 50081 | LA HAGUE - 50 | 43.926989 % |
| 2A258 | LITTORAL CORSE - 2A | 46.922158 % |
| 50083 | VAL DE SAIRE - 50 | 52.903175 % |
| 85365 | MARAIS BRETON - 85 | 61.722170 % |
| 33115 | BAS-MEDOC - 33 | 62.508957 % |
| 56364 | LITTORAL BRETON SUD - 56 | 66.723277 % |
| 2B259 | COTEAUX CORSES - 2B | 76.459532 % |
| 80037 | MARQUENTERRE - 80 | 77.785118 % |
| 64138 | COTE BASQUE - 64 | 78.102937 % |
| 83469 | LITTORAL DE PROVENCE - 83 | 78.746516 % |
| 13244 | CAMARGUE - 13 | 78.880921 % |
| 29363 | PENEPLAINE BRETONNE SUD - 29 | 82.039408 % |
| 34471 | PLAINE VITICOLE - 34 | 82.829832 % |
| 76047 | PETIT CAUX - 76 | 83.024166 % |
| 33137 | LANDES DU MEDOC - 33 | 83.853686 % |
| 62325 | WATERINGUES - 62 | 84.345560 % |
| 44364 | PRESQU'ILE GUERANDAISE ET GRANDE BRIERE - 44 | 84.373142 % |
| 17374 | AUNIS - 17 | 84.864006 % |
| 29101 | ZONE DE PLOUGASTEL-DAOULAS - 29 | 84.865961 % |
| 2B258 | LITTORAL CORSE - 2B | 85.235007 % |
| 66252 | PLAINE DU ROUSSILON - 66 | 86.026227 % |
| 40131 | MARENSIN - 40 | 86.922940 % |
| 06249 | LITTORAL NICOIS - 06 | 86.929186 % |
| 44365 | MARAIS BRETON - 44 | 87.441632 % |
| 2A259 | COTEAUX CORSES - 2A | 88.456354 % |
| 44108 | PAYS DE RETZ - 44 | 88.809623 % |
| 40144 | SEIGNANX - 40 | 88.898037 % |
| 17377 | SAINTONGE VITICOLE - 17 | 89.461799 % |
| 13468 | COTEAUX DE PROVENCE - 13 | 89.806675 % |
| 50082 | BOCAGE DE VALOGNES - 50 | 89.854681 % |
| 11471 | NARBONNAIS - 11 | 90.656353 % |
| 50084 | COTENTIN - 50 | 90.943946 % |
| 30471 | PLAINE VITICOLE - 30 | 91.516074 % |
| 14355 | PLAINES DE CAEN ET DE FALAISE - 14 | 91.707115 % |
| 62029 | BOULONNAIS - 62 | 92.056956 % |
| 13469 | LITTORAL DE PROVENCE - 13 | 92.607091 % |
| 40130 | PAYS DE BORN - 40 | 92.889933 % |
| 29362 | BASSIN DE CHATEAULIN - 29 | 92.912121 % |
| 66254 | CRU BANYULS - 66 | 93.224284 % |
| 85369 | MARAIS POITEVIN DESSECHE - 85 | 94.012025 % |
| 76046 | PAYS DE CAUX - 76 | 94.218329 % |
| 22358 | LITTORAL BRETON NORD - 22 | 94.385122 % |
| 29358 | LITTORAL BRETON NORD - 29 | 94.590167 % |
| 33378 | GRANDES LANDES - 33 | 94.813593 % |
| 50087 | AVRANCHIN - 50 | 95.236857 % |
| 29361 | PENEPLAINE BRETONNE NORD - 29 | 95.959810 % |
| 17111 | MARAIS DE ROCHEFORT ET MARENNES - 17 | 95.995580 % |
| 83247 | MAURES ET ESTEREL - 83 | 96.146888 % |
| 11470 | REGION VITICOLE - 11 | 96.415197 % |
| 14353 | PAYS D AUGE - 14 | 96.577355 % |
| 50086 | BOCAGE DE COUTANCES ET SAINT-LO - 50 | 96.633253 % |
| 83248 | REGIONS FRUITIERES DE SOLLIES-PONT ET DE FREJUS - 83 | 96.879670 % |
| 85368 | BAS BOCAGE - 85 | 97.262973 % |
| 80038 | VIMEU - 80 | 97.286237 % |
| 40132 | MARENNE - 40 | 97.640430 % |
| 44106 | ESTUAIRE DE LA LOIRE - 44 | 98.420327 % |
| 59325 | FLANDRE MARITIME - 59 | 98.817740 % |
| 2A260 | MONTAGNE CORSE - 2A | 99.269081 % |
| 14085 | BESSIN - 14 | 99.480952 % |
| 35358 | REGION  DE SAINT MALO - 35 | 99.639823 % |
| 56363 | REGION CENTRALE - 56 | 99.866272 % |
| 34416 | GARRIGUES - 34 | 99.910142 % |
| 85371 | PLAINE VENDEENNE - 85 | 99.964663 % |
| 2B260 | MONTAGNE CORSE - 2B | 99.983911 % |
| 64139 | COTEAUX DU PAYS BASQUE - 64 | 99.983913 % |
| 06245 | COTEAUX NICOIS - 06 | 99.989321 % |
