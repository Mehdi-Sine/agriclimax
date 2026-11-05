# Sources opérationnelles — 5 novembre 2026

## Accès réellement vérifiés

Preuves dans `operational-evidence/source-access.json` et `additional-access.json` (statuts, URLs publiques, volumes, aucun jeton).

| Source | Accès observé | Conséquence |
|---|---|---|
| ERA5-Land CDS | National réel jusqu’au30 octobre ;11 journées Task26B publiées | Réanalyse0,1°, T2m et TP ; même réduction UTC et masque NULL |
| AROME/ARPEGE | Métadonnées OpenAPI accessibles, champs **401** | Aucun champ ni analyse J−1 acquis |
| Observations DPObs/v1 et v2 | Catalogue **401** | Aucune valeur stationnelle actuelle obtenue |
| Package Observations v2 | Catalogue **401** | Pas de paquet24h acquis |
| IFS Open Data | Index réel5nov00UTC accessible, offsets2t/2d/TP identifiés | 170champs acquis par HTTP206 ; pilote réel retraité hors réseau |

Le secret observations présent ne prouve pas un abonnement modèles. Le contrôle WCS AROME0,025° conforme renvoie aussi401. Aucun abonnement/jeton inventé ; pas de substitution d'une observation par H+0. Les anciennes données stationnelles restent intactes, mais ne prouvent pas un accès actuel.

Confirmation depuis GitHub Actions : run42089606819, six endpoints, six401 (DPObs/v1,v2,PackageObs,v2,AROME,ARPEGE,DPClim/v1),4,29s de requêtes,0octet source. Preuve `operational-evidence/github-source-access.json`. Ce blocage d’authentification est également présent sur le runner ; aucune poursuite de téléchargement Météo-France ne peut le résoudre sans droits valides. Lecture DEV : dernière archive station24octobre2026 (250lots), dernier échantillon observations16octobre (10lots) ; aucune disponibilité J−1 prouvée par ces anciennes données.

## Documentation et limites de vérification

[Météo-France modèles](https://confluence-meteofrance.atlassian.net/wiki/spaces/OpenDataMeteoFrance/pages/621019138/) annonce analyses/prévisions AROME0,01/0,025°, ARPEGE Europe0,1°/monde0,25°, fréquence6h et échéances ARPEGE jusqu'à102h. Ces capacités ne sont pas des acquisitions réussies. Couverture exacte, heures de publication et rétention de chaque couverture WCS restent non vérifiées faute d'accès.

[Package Observations](https://www.data.gouv.fr/dataservices/api-package-observations) annonce paquets6min/horaires sur24h, plus de2000stations et100requêtes/min. Une disponibilité24h n'est pas une archive J−1 durable sans capture régulière. [ARPEGE](https://www.data.gouv.fr/dataservices/api-modele-arpege) et [AROME](https://www.data.gouv.fr/dataservices/api-modele-arome) : compte requis,100requêtes/min annoncées. Licence/CGU et droits propres au produit doivent être confirmés avant intégration effective. Radar : hors pilote, aucune acquisition.

[IFS documentation actuelle,23oct2026](https://confluence.ecmwf.int/spaces/DAC/pages/272310539/) : oper/fc00/12UTC jusqu'à360h, pas3h jusqu'à144h puis6h ;06/18limit90h. Tier0,25° retenu ;0,1° disponible depuis20octobre mais publié2h plus tard et non ajouté au pilote. [Licence ECMWF](https://www.ecmwf.int/en/forecasts/datasets/open-data) CC-BY4.0 et conditions ECMWF, attribution conservée, aucun service de livraison payant.

[Index HTTP](https://confluence.ecmwf.int/spaces/DAC/pages/738041083/) : offsets/longueurs recalculés chaque cycle ; refus de réponse200 à une demande Range, Content-Range/longueur/SHA contrôlés. Le coût comprend les champs sélectionnés entiers car l'index ne découpe pas une région à l'intérieur d'un champ ; **jamais le GRIB complet toutes variables/niveaux**. Sous-sélection France/Corse et seulement les cellules utiles aux12PRA ensuite. Un cycle,96Mio,240requêtes,1200s maximum. Rétention ancienne non testée ; limite interne3jours n'est pas une garantie fournisseur. Publication exacte inconnue : NULL.

Tmin/Tmax IFS : extrema échantillonnés3/6h, pas continus. Tmoy : intégration trapézoïdale. Humidité : Magnus eau liquide depuis2t/2d, approximation versionnée. Pluie : différence d'accumulations du même run entre deux00UTC, pas de concaténation implicite de cycles/modèles. Aucun fournisseur accessible ne prouve encore une estimation J−1 comparable aux observations. Le retard fournisseur est inconnu (NULL), distinct de la fraîcheur calculable depuis l’acquisition.

## Alternative publique Météo-France testée

Le dépôt officiel [PNT rétention14jours](https://www.data.gouv.fr/datasets/donnees-pnt-retention-14-jours) est accessible sans authentification sous Licence Ouverte2.0 (`lov2` dans l'API officielle). Arborescence réelle2556139octets et racine15017octets obtenues, huit réseaux3h le4novembre pour AROME, grilles0,01/0,025°. L'archive SP1 AROME0,025°00H06H du4nov00UTC annonce57221125octets. HEAD200 et requêteRange0–2047 réussie206 ; seulement2048octets d'en-tête sont lus, **aucun champ complet ni paquet national téléchargé**.

Le premier message (vent, catégorie2/paramètre0) est codé `typeOfGeneratingProcess=2` (prévision), échéance0. Ce H+0 ne constitue pas une observation et ne suffit pas à établir une analyse journalière J−1. La vérification ne prétend pas classifier les autres champs non lus. Le dépôt prouve une alternative publique de paquets, mais aucun sous-ensemble géographique ni chaîne d'analyses24h n'a été validé sous les bornes du pilote ; pas de téléchargement national AROME pour contourner l'API ciblée401. Preuve `operational-evidence/pnt-alternative-probe.json`.

[API ciblée officielle](https://confluence-meteofrance.atlassian.net/wiki/spaces/OpenDataMeteoFrance/pages/854032416) : rétention5jours annoncée, accès par modèle/réseau/échéance/niveau/paramètre et sous-ensembleWCS. Cette voie régionale reste conditionnée à des droits valides. Les paquets publics et une analyse spatialisée validée sont donc deux constats distincts.
