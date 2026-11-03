# Données et limites — Task24

| Source | Maille / période | Traitement local |
|---|---|---|
| OFB / MASA, référence `ofb-masa-pra-2017-snapshot-20261017` | 713 PRA, dont 6 corses | Géométrie officielle versionnée, mêmes coordonnées ; génération GeoJSON au build. Réserves géographiques issue #49 inchangées. |
| ERA5-Land `era5land-national-20260919-20261018-v1` | PRA, quotidien UTC, 19/09–18/10/2026 | Lecteurs serveur existants, aucun backfill ; services distants non vérifiés. |
| ERA5-Land climatologie `era5land-pra1991-2020-annual-compact-v1-9babc3b9b96830d2` | PRA, calendrier annuel 1991–2020 | Lecteurs existants ; normalisation du tableau de couverture historique. Référence insuffisante du 29 février conservée. |
| Agreste / SSP, SAA | Département, annuel | Non connecté. Ressource attendue : https://www.data.gouv.fr/datasets/agreste-statistique-agricole-annuelle-saa ; fichier structuré avec codes département, année, production, surface ha, rendement q/ha ou volume t, licence et date de publication à qualifier. Aucun millésime présumé. |
| Météo-France | Stations | Parcours historiques et THI conservés en secondaire ; aucune extrapolation THI aux PRA. |

## Méthodes versionnées `pra-period-1`

| Indicateur | Calcul sur jours disponibles | Normale / anomalie |
|---|---|---|
| Tmoy, Tmin, Tmax | Moyenne temporelle des valeurs spatiales quotidiennes ; Tmin/Tmax = extrema des cellules | Moyenne des normales homologues, mêmes dates et série observée complète |
| Pluie | Somme de la profondeur spatiale moyenne quotidienne | Somme des normales homologues, mêmes dates et série observée complète |
| Jours chauds | Compte strict Tmax > seuil paramétré | Non calculables depuis les normales moyennes |
| Jours de gel | Compte strict Tmin < 0 °C | Non calculables depuis les normales moyennes |
| Degrés-jours | Somme max(0, Tmoy − base) | Non calculables depuis les normales moyennes |

`NULL` reste absent. Un résultat sans jours valides est indisponible, jamais zéro. Jours manquants ou couverture spatiale incomplète : partiel ; somme/moyenne uniquement sur les jours renseignés, aucune extrapolation. Une référence manquante conserve la valeur observée, sans anomalie. DTO : couverture, jours valides/attendus, version, provenance, fraîcheur archive et flags. Règles exploratoires, sans inférence de vulnérabilité.

Agrégateur serveur borné à 30 dates et 713 PRA, quatre lecteurs journaliers en parallèle au maximum (pagination séquentielle de chaque date), cache mémoire de 60 journées pendant cinq minutes, erreurs non conservées. L’abandon de la requête arrête les prochains lots. Le navigateur reçoit 713 agrégats et, à la demande, 120 lignes de série d’une seule PRA. Aucun tableau national annuel ni NetCDF client.

Les flags et secrets restent inchangés à distance. Le lancement local a activé `PRA_NATIONAL_ENABLED=1` dans le seul processus de test. Aucun secret n’est inscrit dans les sources, captures ou archives. Pas de migration, ingestion ni changement de droits. Les erreurs 502 constatées localement ne valident ni n’invalident les données DEV : la connexion réelle reste à vérifier dans l’environnement distant.
