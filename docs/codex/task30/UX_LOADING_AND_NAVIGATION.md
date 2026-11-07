# Navigation et chargement

`/veille` préserve phénomène, région, production, situation et PRA dans l’URL. Les liens vers Analyse fixent le cycle et la période ; le paramètre de retour est limité à une URL locale `/veille?…`. Les événements sélectionnent leurs PRA et la fiche ; les contours restent interrogeables et la sélection territoriale est zoomable.

`MapPresentation` conserve le dernier ensemble titre/valeurs/légende pendant la requête suivante. `NationalMap` conserve son instance, affiche une animation discrète en haut à droite et attend l’événement MapLibre `idle` après mise à jour avant d’enlever l’état de rendu. Aucun pourcentage fictif. La navigation reste disponible. Erreurs visibles avec reprise ; aucune donnée de remplacement inventée.

Les requêtes annulées sont ignorées après résolution et parsing, y compris lorsque deux sélections se suivent rapidement. Les requêtes anciennes ne remplacent plus les sélections actuelles. `prefers-reduced-motion` coupe la rotation et les états utilisent `role=status`.

Desktop : trois résumés, carte et fiche, situations en deux colonnes. Tablette/mobile : cartes de synthèse et événements empilés, fiche adaptée par les styles existants, filtres et détails accessibles. Les preuves de parcours sont dans ACCEPTANCE.md.

Les cartes de veille proposent un sélecteur PRA utilisable au clavier, y compris dans la lecture historique. La sélection d’une situation zoome sur l’ensemble de ses PRA ; le bouton « Voir ce territoire » permet ensuite de cadrer une seule PRA. Les bordures de contrôle utilisent le token de contraste dédié. Contrôles de contrastes et simulations de protanopie, deutéranopie et tritanopie : `python scripts/quality/task30_cartography.py`, avec résultats dans `evidence/accessibility.json`. Ce contrôle ciblé ne constitue pas une certification WCAG complète.
