# UX et cartographie

L'espace Analyse réutilise UnifiedWorkspace, NationalMap, les tokens, l'en-tête et les lecteurs nationaux existants. Production, famille, indicateur, temporalité, dates, seuil et recherche PRA sont groupés dans un bandeau unique. Les filtres `production`, `agro`, `temporal`, `agro_start`, `agro_end`, `agro_threshold`, `pra` sont partageables dans l'URL. Les liens vers Climat et Productions agricoles conservent la PRA.

Carte centrale : titre, unité, période, palette, valeurs et légende changent via les feature-states sans reconstruire le canevas MapLibre. La sélection reste active en l'absence de THI. La fiche expose valeur, période, qualité, sources, run, courbe, données quotidiennes accessibles et limites. La synthèse classe les valeurs, compte les supports complets/partiels/absents et permet de parcourir les conditions à surveiller. Les courbes s'interrompent aux lacunes, le cumul GDD s'arrête à la première lacune, et les précipitations utilisent des barres. Un jour isolé dispose d'un point visible. Seuils en pointillé lorsque pertinents.

Les raccourcis J+3/J+7 choisissent une journée. « Prochaine semaine · séries » conserve les 7 journées sans sommer les modèles incompatibles. Les dates peuvent définir une sous-fenêtre homogène. Aucun chiffre futur n'est étiqueté comme déjà observé.

Toutes les limites PRA ont une épaisseur intrinsèque de 0,7 px et une opacité de 0,55. La sélection est une couche de remplissage dédiée ; les supports partiels ont des hachures et des statuts explicites. Les fill-antialias sont désactivés pour éviter les franges de double contour des couches de surfaces. Les contours officiels et les identifiants restent inchangés.

Une silhouette extérieure fusionnée des PRA est mise en cache dans un GeoJSON de 335 751 octets. Elle seule est simplifiée pour l'effet décoratif, sans trous intérieurs ; aucune géométrie de restitution ne l'est. Ombre dédiée sous les PRA : décalage 2/3 px, opacité 0,12, flou 7 px. Ce n'est pas un relief mesuré. La reconstruction offline utilise les dépendances géographiques déjà existantes : `python scripts/agroclimatic_silhouette.py`. Aucun fournisseur ni service cartographique ajouté.

Recette réelle Chromium en formats 1440×1000, 768×1000 et 390×844 : égalité API/fiche, même canevas entre indicateurs/productions, PRA persistante, recharge d'URL, trois espaces, absence de débordement horizontal et d'erreurs JS. Les classes nationales passent en liste sur mobile pour rester lisibles. Cela ne vaut pas une certification sur tous les appareils physiques. Captures et rapports dans `evidence/local/` ; littoraux Crozon, La Hague, Camargue et Corse inclus. La recette Preview reste soumise à l'accès protégé.

La trajectoire GDD possède aussi un graphique séparé de la température moyenne source, avec sa propre unité et la base paramétrée ; les unités ne sont pas mélangées sur un même axe.
