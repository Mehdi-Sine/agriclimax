# Comparaison du complément littoral — résultats intermédiaires

## Reconstruction du champ ERA5-Land voisin

Essai pré-déclaré IDW4, puissance2, rayon25km, minimum3voisins, sans ajuster les paramètres après lecture des erreurs. Toutes les cellules de chaque PRA témoin sont exclues des voisins. Parmi17PRA de référence maritimes≥90% dans22/29/50/56,9PRA satisfont la contrainte de voisinage sur13jours :117comparaisons indépendantes par variable. Les208couples PRA-jour-variable sans voisins suffisants sont rejetés.

| Variable | Biais | MAE | Erreur absolue P95 | Biais cumulé relatif absolu |
|---|---:|---:|---:|---:|
| Tmoy | +0,129°C |0,165°C|0,408°C|1,12%|
| Pluie | +0,048mm/j|0,224mm/j|0,906mm/j|1,15%|

Les critères exploratoires pré-déclarés sont satisfaits sur19–31octobre. Les voisins de Crozon restent dans le domaine de distance contrôlé :24,807km maximum, contre24,931km pour les témoins. Cette validation porte sur la reconstruction du champ ERA5-Land, pas une mesure indépendante en station, ni une validation agronomique ou des microclimats côtiers. L’extension2–18octobre doit encore être contrôlée avant une livraison30jours. Aucun Tmin/Tmax, événement ou THI n’est déduit des moyennes reconstituées.

## SAFRAN/SIM officiel

Source officielle trouvée : [Météo-France, SIM quotidienne](https://www.data.gouv.fr/api/1/datasets/6569b27598256cc583c917a7/), Licence Ouverte2.0. Catalogue : fichiers annuels, mise à jour quotidienne sur60jours glissants, résolution annoncée0,072°≈8km. Le CSV natif de coordonnées est en LambertIIétendu, unités hectométriques ; le maillage est analysé comme carrés8km, pas comme grille géographique ERA5.

La grille candidate intersecte Crozon sur7cellules et environ99,81% de sa surface. **Ce n’est pas une couverture temporelle vérifiée.** Un écart atteignant0,00097° entre reprojection EPSG27572 et coordonnées géographiques du CSV reste à qualifier avant d’utiliser cette géométrie comme référence. Les axes et valeurs temporelles réels n’ont pas été acquis.

Les paramètres officiels distinguent T moyenne ]00UTC–00UTC] et précipitations neige+pluie ]06UTC–06UTC] : la pluie ne se substitue pas silencieusement aux journées UTC ERA5-Land. L’humidité relative disponible dans SIM ne justifierait pas un THI hybride.

HEAD des fichiers officiels au7novembre :60jours `QUOT_SIM2_latest.csv.gz`,19936780octets ; année2026,114689299octets. Le premier dépasse la garde source16Mio par fichier et le second est un téléchargement national disproportionné pour Crozon. Aucun fichier national SIM n’est téléchargé. Seuls métadonnées, coordonnées277541octets et paramètres340950octets sont lus ; reçus et empreintes dans `evidence/safran-assessment.json`.

## Choix provisoire

La reconstruction ciblée réutilise les cellules ERA5 déjà présentes, sans acquisition supplémentaire et avec mêmes journées UTC. Elle passe la première validation spatiale bloquée et conserve une provenance de méthode distincte. Candidat privilégié pour Tmoy/GDD/pluie de Crozon, sous réserve de la vérification temporelle supplémentaire et de tests de refus des lacunes. Les surfaces observées natives restent distinctes des estimations. SAFRAN demeure une solution indépendante possible après résolution géométrique, contrôle temporel et budget de sous-ensemble ; il n’est ni acquis ni mélangé ici pour obtenir artificiellement713mesures.

## Contrôle conservateur du domaine d’extrapolation

Les six centres de cellules cibles de Crozon sont hors de l’enveloppe convexe de leurs voisins : il s’agit d’une extrapolation spatiale vers le littoral. Distance maximale à cette enveloppe :18,245km ; les contrôles spatiaux bloqués atteignent22,281km et incluent aussi des PRA dont100%des poids de cellules sont extrapolés. La publication est refusée si la distance ou la fraction extrapolée de la cible dépasse celles validées sur les témoins, en plus du rayon25km. Ce contrôle de domaine renforce les critères d’admissibilité ; il ne mesure pas un éventuel effet maritime propre à Crozon.

Les comparaisons portent sur des champs corrélés dans l’espace et le temps :117PRA-jours ne sont pas117observations statistiquement indépendantes. Le percentile empirique des erreurs des témoins ne constitue jamais un intervalle de confiance local ni une probabilité de dommage.

## Vérification temporelle supplémentaire — 2–18 octobre

Les cellules du nord-ouest sont entièrement présentes dans le deuxième checkpoint ciblé, avant la fin de restauration des autres côtes. Même sélection de témoins établie au19octobre, mêmes paramètres et mêmes critères ;153PRA-jours supplémentaires par variable, neufPRA. Tmoy : biais+0,088°C,MAE0,141°C,P95absolu0,360°C. Pluie : biais+0,036mm/j,MAE0,156mm/j,P95absolu0,656mm/j,biais relatif de cumul1,99%. Les deux périodes et leur agrégation satisfont les critères, sans réajustement de paramètres.

Les30journées de Crozon disposent du même support de voisins et des mêmes poids reconstitués. Le complément retenu concerne seulement Tmoy,GDD,pluie ; il est exposé comme objet complémentaire distinct, avec couverture native0%,et ne modifie jamais les NULL natifs. L’absence historique native2–18octobre est en outre établie par les30jours indisponibles et comptes maximum0/6 de l’inventaire Task19D conservé ; ses empreintes et sa période sont liées au document de reconstruction. Aucun masque nul n’est redemandé pour Crozon.

Référence méthodologique générale : Donald Shepard (1968), *A two-dimensional interpolation function for irregularly-spaced data*, doi:10.1145/800186.810616, métadonnées bibliographiques Crossref vérifiées. Cette référence ne valide ni le rayon de 25 km, ni la représentativité climatique de Crozon : ces paramètres sont explicités et évalués par les contrôles propres à cette Task.
