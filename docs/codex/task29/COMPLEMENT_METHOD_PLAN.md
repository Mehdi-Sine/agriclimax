# Plan préalable du complément littoral

## Candidat ERA5-Land : interpolation spatiale exploratoire

Reconstruire uniquement Crozon, jamais remplacer les portions natives des67autres PRA. Estimer les cellules cibles manquantes par les quatre cellules terrestres voisines valides les plus proches, inverse du carré de distance en EPSG3035, rayon maximal25km et au moins3voisins ; agréger avec les poids PRA existants. Aucun changement de grille de référence ou de contour. Les données manquantes restent absentes si les conditions ne sont pas réunies chaque jour.

Validation spatiale bloquée : retirer **toutes** les cellules d’une PRA témoin du groupe de voisins, puis estimer sa moyenne depuis les seules cellules extérieures. Contrôles maritimes du nord-ouest : départements22,29,50,56, référence observée≥90%. Pondération et métrique de référence sur le même support valide ; un témoin sans voisins suffisants est rejeté, jamais extrapolé hors rayon. Paramètres fixés avant lecture des erreurs, pas de réglage pour forcer un succès. Première période test19–31octobre ; nouvelle période2–18 servirait à une vérification temporelle supplémentaire, pas à ajuster la méthode.

Critères internes d’admissibilité exploratoire, **pas seuils agronomiques ni garantie métrologique** : au moins5PRA témoins et65PRA-jours, biais absolu Tmoy≤0,5°C, MAE≤1°C, percentile95de l’erreur absolue≤2°C. Pluie : MAE≤2mm/j,biais du cumul≤15%,percentile95≤5mm/j ; pas de seuils ou séquences reconstruits depuis une pluie interpolée sans qualification événementielle séparée. Ne pas publier un candidat qui échoue. Vérifier également que les distances des voisins de Crozon restent dans le domaine des témoins.

La référence est le champ ERA5-Land observé, pas une station indépendante : cette comparaison évalue une reconstruction du champ, pas la météo réelle de chaque parcelle ni la représentativité littorale absolue. Pas de Tmin/Tmax reconstitués depuis Tmoy, pas de THI sansRH, aucune normale/anomalie hybride. Tout résultat admissible porterait une provenance de reconstruction distincte, couverture native0%,incertitude et limites explicites ; il ne deviendrait jamais une valeur native ou une estimation≥90%.

## Candidat SAFRAN/SIM

Vérifier métadonnées officielles, licence, résolution8km, historique réellement accessible, cellules intersectant Crozon, variables et unités avant téléchargement. Le visualiseur Geobretagne annonce15jours et expose SWI/ETR/cumul15j, pas les températures et pluies quotidiennes nécessaires ; son WFS ne peut donc pas être assimilé directement à un complément climatique30jours. La référence ancienne data.gouv fournie par ses métadonnées retourne404 ; une recherche officielle du catalogue est en cours. Aucun fichier national SAFRAN acquis.

Les deux candidats seront comparés sur disponibilité réelle, biais mesurés, couverture, résolution, coût et limites. Aucune conclusion de validation ou de réussite Crozon n’est prise à ce stade.
