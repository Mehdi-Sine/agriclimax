# Audit des familles de cartes

| Famille / point d'entrée | Adaptation COUV-04 | Limite / conservation |
| --- | --- | --- |
| Explorer climat, `unified/workspace` | Qualité propagée ; masques ERA communs à la période transmis même avec CORE-01 | Pas de masque : gris, sans perte du contour |
| Cartes agroclimatiques, `agroclimatic/workspace` | Même moteur et support observé stable | Multi-variable à supports différents bloqué en amont ; humidité non inventée |
| Prévisions/récent, `operational/workspace` | Toutes les identités de référence conservées ; qualité transmise | Masques partiels par cycle non archivés : NO-GO pour la couverture colorée exhaustive |
| Veille prévisionnelle, `national-watch/workspace` | Qualité `watchMapReading` conservée | Même limite sur les masques ; faits éditoriaux non changés |
| Veille historique, `history-panel` | Qualification des anomalies validées, référence 30 années exigée | Aucune normale/anomalie sur la seule portion observée |
| Journal dynamique, `journal/ui/pra-map` | Qualité transmise au moteur commun | Les lectures avec URL d'archive gardent le rendu antérieur |
| Cartes du jour/édition, `edition-maps/view` | Preview : contrat commun + support historique vérifié | Éditions publiées exclues du changement, conformément au TASK |
| Miniatures/carrousel, `map-thumbnail` | Même contrat pur, palette CSS, surfaces et contours séparés ; cache distinct | Activation uniquement pour preview non publiée ; anciennes URL/version conservées |
| Cartes manuelles de test, `nightly/manual-maps` | Rendu gelé explicitement conservé | Pas de réécriture des résultats de test archivés |
| Diagnostic national, `national/workspace` | Contours de référence conservés | Carte de disponibilité sans valeur quantitative ; pas de masque climatique à inférer |
| Productions agricoles RPG/SAA | Switch exclu de ces couches | Une absence climatique ne doit pas modifier la donnée agricole |
| Futures cartes / AGRO-03 | Contrat pur + rejeu des 28 recettes | Elles doivent fournir la qualité et le masque exact, pas seulement une fraction |

Les 713 PRA sont contrôlées par identité dans chaque cas de la matrice. Cela
inclut les PRA de Bretagne, Normandie, façade atlantique, Méditerranée et les six
corses ; il ne s'agit pas d'une sélection de quelques littoraux favorables.
Les effectifs `unavailable` du rendu peuvent signifier « masque absent » et sont
accompagnés de leur raison ; ils ne prouvent pas une absence de données source.

Le rendu utilise un fond gris clair dédié et les palettes scientifiques existantes.
Les surfaces partielles n'ajoutent aucun trait de bord. Le trait complet PRA reste
uniforme ; l'ombre littorale épaisse est désactivée dans le nouveau rendu.
