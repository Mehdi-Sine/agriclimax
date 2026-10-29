# Jeu de données pour AgrometInfo

Ce jeux de données sert de référence pour les normales dans l'application AgroMetInfo (https://www.agrometinfo.fr/).
Il contient un fichier géospatial (format Shapefile) avec les petites régions agricoles françaises (PRA), ainsi qu'un champ associant chaque maille de la grille SAFRAN à une PRA.

Il contient également trois fichiers CSV contenant les normales journalières calculées entre 1991 et 2020 pour les indicateurs agroclimatiques décrits dans AgrometInfo. Pour chaque jour et chaque maille de la grille
SAFRAN, les quantiles 0.05, 0.5 (Médiane) et 0.95 sont calculés.

Les trois fichiers couvrent trois périodes.
- normales_été comprend les normales entre le 1er avril et le 15 octobre
- normales_hiver comprend les normales entre le 31 octobre et le 31 aout de l'année suivante
- normales_annuelles comprends les normales entre le 1er janvier et le 31 décembre.
