# Task 19 — clôture technique, 19 octobre 2026

> Rapport historique. Voir la [revue du 29 octobre](FINAL_ACCEPTANCE_REVIEW_20261029.md)
> pour les trous terrestres qualifiés, l'état des runners et la correction du
> diagnostic daily : absence d'historique ne signifiait pas absence de DDL.

Branche distante inchangée : `codex/19-national-coverage`, PR #40. Base auditée :
`680630360a13a860a52c828fa6e5e72685f7efc9` (v0.2.0 préservée).
Ce rapport remplace les conclusions de disponibilité réseau du 18 octobre.
Les rapports historiques restent des preuves datées, pas l'état courant.

## A. TECHNICAL MERGE READINESS — NOT READY

Les tests de code et de migration passent, mais un critère de validation du
référentiel reste ouvert : **compatibilité administrative non établie et écarts
non expliqués.** Le contrôle indépendant est désormais chiffré, mais le
millésime/la précision des géométries PRA restent inconnus. Il faut qualifier les
écarts avec un référentiel compatible, puis consigner leur acceptation ou leur
résolution à la source.

Cette réserve concerne l'acceptation du référentiel intégré, donc le merge selon
la Definition of Done Task19 §18.2. Elle n'est pas une erreur de CI. La ressource
officielle fournie en cours de contrôle a permis de vérifier sa provenance et
de reproduire XML → GeoJSON ; la réserve initiale d'accès au XML est levée pour
cette extraction officielle. L'identité binaire du XML historique reste inconnue.
La date géométrique peut rester explicitement inconnue : aucune obligation
d'inventer un millésime pour fermer un champ. Une revue peut accepter une
provenance correctement bornée ; cette décision n'est pas prise automatiquement.

Ne bloquent **que l'activation nationale** : support structurel CDS non certifié,
validation temporelle nationale absente, déploiement distant non réalisé,
coûts d'exécution/egress non mesurés et opérations manuelles ci-dessous.
Le schéma non déployé n'est pas, à lui seul, un blocage de merge d'une migration
additive testée localement. Aucun merge effectué ; draft conservée.

## B. NATIONAL OPERATIONAL READINESS — NOT READY

713 PRA et 14 541 intersections existent ; cela ne démontre pas 713 PRA servies
quotidiennement. Les quatre pilotes réels et la sonde nationale à deux instants
restent les seules preuves climatiques versionnées. Aucun backfill supplémentaire.
La publication nationale exige une décision explicite sur les littoraux, le support
effectif du produit CDS, la période/les variables et les exclusions éventuelles.
Le THI PRA reste non supporté et les diagnostics blé exploratoires.

## Provenance : vérification réellement exécutée

Le lien fourni par l'utilisateur,
`https://www.data.gouv.fr/api/1/datasets/r/16ba1df7-4f07-4715-ad53-384a0dfbcf61`,
redirige (HTTP 302) vers le WFS OFB `referentiel/ows`, couche MASA EPSG:3857.
Le XML original du service, sans modification du paquet versionné, a été reçu à
`2026-10-19T21:48:20.985Z` (23:48:20 à Paris), SHA256
`7a98ce13cc9bd698cc9dce0b0df5e5a39f33e19165a807422018e96d8153ecab`.
Il s'agit de l'horodatage de réponse WFS, pas de création des géométries.
URL et empreintes : [source-receipts.json](evidence/closure/source-receipts.json).
Les [métadonnées data.gouv](evidence/closure/datagouv-resource-metadata.json)
confirment couche, CRS et Licence Ouverte 2.0 ; leur checksum de ressource est
NULL. Les dates de création du catalogue (2017), de ressource (juillet 2026) et
de mise à jour du catalogue (octobre 2026) ne datent pas la géométrie.

Le convertisseur strict WFS2/GML3.2 inspecte le CRS déclaré EPSG:3857, les anneaux
fermés, les géométries valides et non vides, les comptes `numberMatched` et
`numberReturned`, les codes texte uniques et l'identité RA/PRA. Il transforme les
coordonnées avec PROJ vers EPSG:4326 sans réparation ni simplification.
La comparaison utilise EPSG:3035 pour les surfaces et les distances.

Résultat : [wfs-comparison.json](evidence/closure/wfs-comparison.json).

| Vérification de la nouvelle extraction | Mesure |
|---|---:|
| Entités valides / codes communs | 713 / 713 |
| Codes ajoutés ou retirés | 0 |
| Écarts sur les attributs communs | 0 |
| Attribut XML supplémentaire | `fid`, dans 713 entités |
| Géométries strictement/topologiquement différentes en flottants | 707 |
| Somme des différences symétriques | 0,0014425822 m² |
| Distance de Hausdorff maximale projetée | 7,0004241 × 10⁻⁹ m |

Les différences sont à l'échelle des arrondis de reprojection, très inférieures
à la précision des sources. On ne prétend pas à une identité binaire ni à une
précision nanométrique des limites réelles. Aucun arrondi correctif appliqué.
Le `fid` du service est conservé dans la conversion ; il n'était pas dans les
attributs de l'export versionné. Les codes, noms et `surf_ha` communs concordent.

**Millésime géométrique : non documenté.** La nomenclature Agreste 2017 et ses
713 codes ont été vérifiés séparément dans l'itération précédente. Le nom du
paquet `...2017-snapshot-20261017` ne date pas les géométries. La réception du
paquet du 17 octobre ne date pas non plus son extraction WFS originale.

Pour reproduire la conversion sur les octets conservés du XML de cette ressource :

```sh
export PYTHONPATH=engine/src
gzip -dc docs/codex/verification/task19/evidence/closure/ofb-wfs-20261019.xml.gz > work/ofb-resource-original
python scripts/pra_closure_audit.py wfs \
  --input work/ofb-resource-original \
  --expected-sha256 7a98ce13cc9bd698cc9dce0b0df5e5a39f33e19165a807422018e96d8153ecab \
  --bundle config/coverage/ofb-masa-pra-2017-snapshot-20261017 \
  --output work/resource-wfs-audit
```

Le SHA correspond aux octets du fichier reçu, avant conversion ; il est calculé
localement et non comparé à un checksum publié par data.gouv (absent). Le script
refuse une extraction tronquée ou un CRS différent ; adapter un autre
encodage GML exige une revue explicite, pas une supposition d'axes.
Il produit `converted.geojson` et la comparaison par code. Une nouvelle requête
WFS peut changer d'horodatage/identifiants GML et donc de SHA même sans changement
géométrique. Le SHA historique déclaré
`6ced4c263b48fa27fe283353d93b90d93f2b2ff86cdc9b041574a04983ca1acc` n'est donc
pas certifié : ses octets n'ont pas été fournis. Conserver chaque XML reçu avec
son reçu d'acquisition, sans qualifier le lien dynamique d'archive immuable.

## Contrôle administratif indépendant

Archive Etalab 2018 des départements, dérivée d'IGN ADMIN EXPRESS, généralisation
5 m, WGS84 : [métadonnées et SHA](evidence/closure/admin-source.json).
L'index officiel propose 2018 comme première édition ; l'URL 2017 retourne 404.
La classe « 5 m » est une généralisation, pas une garantie d'exactitude à 5 m.
La précision et l'édition des PRA étant inconnues, **compatibilité non certifiée**.

[Comparaison brute par département](evidence/closure/administrative-comparison.json) :

| Mesure EPSG:3035 | km² |
|---|---:|
| Surface administrative sans PRA, Paris inclus | 1 731,261875 |
| Paris seul, sans PRA officielle | 105,378512 |
| Surface administrative sans PRA, hors Paris | 1 625,883363 |
| PRA hors de leur département assigné, somme par département | 1 134,566554 |

Les plus grandes lacunes brutes hors Paris concernent le 13 (405,75 km²), le 44
(79,48 km²), le 56 (62,11 km²) et le 69 (55,12 km²). Ces métriques ne sont pas
des taux de défaillance certifiés : littoral, plans d'eau, choix de découpage et
millésimes doivent être analysés. Les dépassements par département peuvent aussi
inclure des surfaces situées dans un autre département ; ce n'est pas seulement
une mesure de dépassement du contour national. Aucun contour corrigé pour un test.

Le même contrôle accepte une archive officielle manuelle ZIP avec membre GeoJSON
explicite, un GeoJSON brut ou gzip, sans extraction des chemins de l'archive.
Fournir un JSON de métadonnées selon `admin-source.json`, avec URL officielle,
producteur, édition, CRS réel, précision, compatibilité motivée et SHA256 de
l'archive. Pour un SHP/GPKG officiel, conserver l'archive et le reçu puis exporter
explicitement les départements en GeoJSON avec GDAL, en documentant la commande,
le champ code et le CRS ; ne pas inventer une précision après conversion.

```sh
sha256sum work/official-departments.zip
python scripts/pra_closure_audit.py admin \
  --input work/official-departments.zip --member archive/departements.geojson \
  --code-field code --metadata work/official-departments-metadata.json \
  --bundle config/coverage/ofb-masa-pra-2017-snapshot-20261017 \
  --output work/official-admin-audit
```

Les 96 limites métropolitaines, Paris compris, sont requises. Les résultats
restent « measured_requires_vintage_and_precision_review » ; aucun seuil de
réussite arbitraire n'est appliqué aux géométries.

## Disponibilité structurelle et observée

Le masque officiel ECMWF `lsm_1279l4_0.1x0.1.grb_v4_unpack.nc` (51 898 361 octets,
SHA256 `9df65151d1608990851e2aa8d0e1e4ca063b5181b0568493c42676d2572b202c`)
a été téléchargé depuis le lien de la documentation ERA5-Land. Il s'agit d'une
fraction terrestre auxiliaire **interpolée par ECMWF** sur la grille régulière
0,1°, pas d'un bitmap catégoriel de disponibilité CDS. Son temps interne est
2013-11-29 ; son historique de conversion est daté du 12 juin 2020. Ces dates ne
certifient pas le support de toutes les révisions futures de CDS.

Le script aligne les centres des 6 861 cellules à moins de 2 × 10⁻⁵ degré
(coordonnées float32 du masque), sans interpolation, décalage ou choix de cellule
voisine. Résultat : [comparaison masque/sonde](evidence/closure/ecmwf-mask-comparison.json).

| Test du seuil auxiliaire `lsm < 0,5` | Cellules |
|---|---:|
| Sous le seuil | 272 |
| Sous le seuil et absentes dans la sonde | 230 |
| Sous le seuil mais présentes dans la sonde | 42 |
| Au-dessus/égales au seuil mais absentes dans la sonde | 39 |

**Le seuil ne reproduit pas les 269 absences.** Aucune des 269 n'est certifiée
structurellement absente par ce seul test. Les 39 et 42 identifiants contradictoires
sont explicitement listés ; les fractions et états observés des 6 861 cellules
sont fournis dans [le CSV cellule par cellule](evidence/closure/ecmwf-mask-cells.csv).
Une affirmation contraire transformerait un masque auxiliaire
interpolé en support permanent sans preuve. Les discussions du forum ECMWF ne
remplacent pas une spécification de support du produit livré.

Par PRA : [inventaire structurel](evidence/closure/structural-inventory.csv) :
**713 inconnues**, aucune PRA certifiée structurellement nulle ou partielle.
La liste certifiée est vide faute de preuve, pas parce que la couverture serait
complète. Le fichier historique de [couverture observée](evidence/final/native-probe-pra.csv)
reste distinct : 1 PRA à 0 % (Crozon), 31 entre 0 et 90 %, 27 entre 90 et 99 %,
654 à au moins 99 %. Les 68 PRA partielles restent des observations à deux
instants, sans extrapolation de permanence.

```sh
python scripts/pra_closure_audit.py mask \
  --input work/land-mask.nc \
  --source-url 'https://confluence.ecmwf.int/download/attachments/140385202/lsm_1279l4_0.1x0.1.grb_v4_unpack.nc?version=1&modificationDate=1591983422208&api=v2' \
  --bundle config/coverage/ofb-masa-pra-2017-snapshot-20261017 \
  --probe docs/codex/verification/task19/evidence/final/native-probe-audit.json \
  --output work/mask-audit
```

Signalement : conserver « support structurel inconnu » indépendamment de la
complétude d'un lot observé. Cellule/heure requise absente → couverture observée
diminuée, statut partiel ou indisponible et scalaire complet NULL ; jamais zéro
risque, renormalisation, voisinage ou interpolation. Une couverture ≥99 % n'est
pas synonyme de 100 %. Fraîcheur, variables, période, révision, reçus et qualité
doivent rester affichables. Une panne/requête incomplète ne devient pas un masque.

Pour fermer ce point : obtenir une spécification/bitmap du support réellement
servi par CDS à la grille/révision utilisées, expliquer les 81 désaccords et
valider plusieurs périodes et variables sans promettre une disponibilité future.
ERA5, SAFRAN/SIM et observations station peuvent être évalués comme sources
complémentaires distinctes avec licences, périodes, biais, résolution et coûts
propres. Pas d'implémentation SAFRAN, de mélange implicite ou d'interpolation.

## Migration, sécurité et compatibilité

Migration additive existante **inchangée**, SHA256
`c4c07c92290901b3ad0e72feb9aca9bf64f2a03e7f9137518c706b4a661aa4a6` :
`20261017190818_pra_territorial_aggregation.sql`. Dix tables privées, quatre
fonctions publiques `SECURITY INVOKER`, `search_path=pg_catalog`, délais bornés.
RLS activée et forcée sur les dix tables ; retrait des droits PUBLIC/anon/
authenticated ; SELECT/INSERT seulement pour service_role ; aucune permission
UPDATE/DELETE/TRUNCATE ajoutée. `service_role` reste un rôle de confiance côté
serveur et peut contourner RLS : la clé ne doit jamais atteindre le navigateur.
Fonctions : EXECUTE réservé à service_role, aucun SECURITY DEFINER nouveau,
aucune vue nouvelle qui contournerait RLS. Verrous et identité des lots protègent
le rejeu et refusent une révision contradictoire. Aucun DROP/ALTER des données
v0.2.0, changement de règles agricoles ou de contrat station.

Contrôles Supabase actuels lus : changelog du 19 octobre, changements PostgreSQL
15.19/17.11 et exposition Data API, documentation des privilèges/RLS. Aucun usage
de realtime/GraphQL concerné par les ruptures recensées. Vérifier explicitement
les paramètres Data API du staging : les privilèges et l'exposition du schéma
sont deux conditions distinctes. Ne pas exposer `agriclimax_private` pour résoudre
une erreur d'accès. Voir les procédures exécutables de [déploiement](DEPLOYMENT_CLOSURE.md).

Seul projet AgriclimaX accessible : DEV, sans branche de staging. DEV n'est pas
assimilé à un staging autorisé à modifier. Contrôle distant **lecture seule** :
25 638 579 octets, zéro table Task19, zéro objet Storage, `cron.job` absent.
Les migrations daily_pipeline/daily_live_read de v0.2.0 ne figurent pas dans son
historique distant. Réconcilier cette dérive avant déploiement ; aucune migration
distante ni nouvelle branche Supabase (payante) créée.

## Stockage et coûts

[Budget recalé](evidence/closure/storage-90-days.json), même modèle que le 18 octobre,
seule la base DEV est remesurée : **247 180 147 octets (247,18 Mo)** avec huit
diagnostics hebdomadaires/PRA, **171 248 499 octets (171,25 Mo)** sans leur
production systématique. Marge 127,82 Mo sous la cible d'ingénierie 375 Mo ;
seulement 2,82 Mo sous l'objectif 250 Mo du scénario supérieur.

Hypothèses conservées : une seule révision, 64 170 jours-PRA, 9 269 lots à 4 Kio,
74 152 diagnostics optionnels à 1 Kio, index et provenance inclus dans les
réserves antérieures. Les limites Free vérifiées : 500 Mo PostgreSQL par projet,
1 Go Storage, 5 Go d'egress ; le plan de l'organisation est effectivement Free.
Storage/egress ne sont pas une extension des 500 Mo PostgreSQL. Aucune assurance
que toutes les ressources restent gratuites sous une charge nationale non mesurée.
Minutes Actions privées, file CDS, CPU, téléchargements et egress restent à mesurer.

**90 jours = horizon de budget, pas fenêtre glissante automatisée.** Aucune purge
DB, TTL ou tâche planifiée de suppression n'est introduite. Le code de rétention
reste dry-run, sans DELETE. Les artifacts Actions à sept jours ne constituent
pas une archive pérenne ; leur expiration n'est pas une purge de données v0.2.0.
Sans politique ultérieure autorisée, la base continue de croître après 90 jours.
Seuils internes 300/375/450 Mo ; refus d'écriture Task19 à 375 Mo dans la RPC.
Remesurer taille, révisions, croissance des autres tâches et stockage réel avant
chaque activation/extension. Ni backfill national ni service payant activé.

## Validation et preuves

189 tests Python (dont huit nouveaux tests d'adaptateur), tests des entrées XML
tronquées/CRS erronés/anneaux invalides, archives sans extraction, contradictions
et désalignement du masque. Ces fixtures sont synthétiques, distinctes des
mesures officielles ci-dessus. Ruff et mypy strict du module territorial et du
nouvel outil passent. SQL local : toutes migrations, permissions/RLS, idempotence,
contrats station/blé/bovins/daily sur PostGIS public et extensions. Référence
officielle complète importée et rejouée uniquement dans un conteneur jetable.
Les logs finaux et l'état CI du commit publié sont consignés dans la PR.
Aucune UI modifiée dans cette clôture ; les contrôles UI précédents restent datés.
