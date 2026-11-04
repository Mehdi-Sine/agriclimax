# Recette UX Task25

La structure Task24, la carte commune et les trois espaces sont conservés. La même composante cartographique reçoit les PRA, départements ou régions ; les couleurs utilisent les tokens. Le THI reste un parcours stationnel, aucun THI territorial n'est créé.

Productions : Production → Variable → Année → Maille publiée. Le catalogue n'affiche que les indicateurs alimentés. Recherche, survol, clic, légende numérique, unités, valeurs et historiques annuels sont reliés aux vrais agrégats. La sélection est partageable dans `agri_production`, `agri_variable`, `annee`, `echelle`, `territoire` ; le contexte `pra`/période Task24 est conservé.

La SAA colore de vrais polygones départementaux/régionaux. La fiche dit explicitement « non disponible à la PRA ». Les volailles sont régionales et en milliers de têtes ; une valeur départementale n'est pas inventée. Les historiques affichent les années natives avec ruptures sur NULL et table accessible. Le millésime 2025 provisoire et les séries historiques révisées sont distingués.

Le RPG colore des PRA par des intersections réelles ; les lots manquants restent gris. Les valeurs partielles portent une bordure renforcée et une bannière de couverture. La fiche donne la répartition, le dénominateur des surfaces RPG acquises et les limites PAC, jamais « toutes les surfaces agricoles ».

Analyse : A. aléa climatique inchangé ; B. contexte agricole blé RPG2025 ; C. lecture descriptive avec année agricole et période climatique explicites. Un aléa reste consultable si le RPG manque, et les données agricoles ne dépendent pas des 68 PRA climatiques indisponibles. Aucun stade, dommage ou hectare touché n'est inféré.

La recette réelle est exécutée à 1440, 768 et 390px ; captures dans `screenshots/` et résultats dans `browser-real.json`. Les preuves simulées de Task24 ne sont pas réutilisées comme preuve Task25.
