# Acquisition nationale réelle — Task 26C

Le cycle du **6 novembre 2026 à 00 UTC** est publié en DEV. [Run national 42189132229](https://github.com/Mehdi-Sine/agriclimax/actions/runs/42189132229), commit efd43c1, réussi. Le contrôle préalable réel [42185386566](https://github.com/Mehdi-Sine/agriclimax/actions/runs/42185386566) a précédé cette acquisition : 14 appels, 125321 octets, 14,29 secondes ; T2m Kelvin, RH %, pluie P1D kg/m² (mm), accumulation exactement 24 h vérifiés dans GRIB.

## Mutualisation et budget

AROME : deux emprises continent/Corse, grille native 0,025°. ARPEGE : une emprise, grille native 0,1°. IFS : index et HTTP Range sur les champs globaux 0,25°, cache partagé. Aucun téléchargement par PRA. Intersections propres aux trois grilles, géométries officielles inchangées, aire EPSG:3035. Les recouvrements de tuiles ont une propriété canonique par cellule pour éviter de mélanger des encodages GRIB distincts.

Budget arrêté avant national : 128 MiB de source, 512 appels, 1320 secondes, 4 GiB RAM, 448 MiB de checkpoints ; une requête/seconde WCS. Mesuré : **413 appels, 95182413 octets, 694,65 secondes (11 min 35), RSS maximale 889516 KiB**. Aucun achat ni dépendance reversionnée. Les secrets modèles distincts sont utilisés exclusivement dans Actions ; aucune clé Observations pour les modèles.

## Résultat et conservation

713 identifiants PRA, 49910 lignes sources (AROME10695, ARPEGE14260, IFS24955), 32085 lignes sélectionnées, neuf journées UTC du 5 au 13 novembre. Températures moyennes/minima/maxima exploitables sur 713 PRA chaque jour. Voir les NULL RH/pluie dans J_MINUS_1_AND_FORECASTS.md ; la présence de 713 identifiants ne vaut pas couverture scientifique complète.

Archive PRA privée : 562843 octets, SHA256 `62ab191f162a076003ffba79994858fcef0692b3e1f52e1abef1652f2d3c6066`. Toutes les 49910 lignes restaurées à l'identique avant publication du catalogue. Les grilles brutes ne sont pas dans Supabase.

Checkpoint GitHub existant : artifact13489348195, 95622719 octets, rétention initiale sept jours. Preuves : artifact13488884931 et national-evidence/. **Ne pas relancer l'acquisition nationale** : lire l'archive publiée ou reprendre uniquement les champs manquants depuis le checkpoint existant. La reprise vérifie les empreintes et le run ; un cache du 5 novembre ne remplace pas un champ du 6.

La qualification indépendante des réductions natives et des sommes pondérées figure dans national-evidence/audits/. Le contrôle compare 24955 lignes MF et 24955 IFS. Les conventions source et le décodage GRIB sont communs ; les formules de vérification ne rappellent pas les agrégateurs de production. Ce contrôle arithmétique ne mesure pas la justesse prévisionnelle.

Le checkpoint original a également été sauvegardé sans réacquisition dans le workspace :`work/task26c/national-weather-checkpoint-42189132229.zip`,95622719octets,SHA480127264af1bf950fa6fabc07759ce0659a728e0d45aafa459e7b5287c2abda. Il n’est pas ajouté au dépôt ni à Supabase. Preuve :operational-evidence/task26c-checkpoint-preservation.json.
