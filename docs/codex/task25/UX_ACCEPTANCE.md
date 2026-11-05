# Recette UX Task25

La refonte Task24 est conservée : trois espaces, une carte persistante, contexte territorial et URL partageables. La même instance MapLibre reçoit les PRA, départements ou régions. Les couleurs utilisent les tokens ; mobile, tablette et desktop conservent leurs mises en page.

Les recettes réelles locales et Preview passent à 1440×1000, 768×1000 et 390×844. Résultats : `browser-real.json`, `preview/browser-real.json`, captures dans `screenshots/` et `preview/screenshots/`. Chaque environnement comporte douze vues des espaces alimentés et une vue régionale volailles supplémentaire. Aucun mock ni jeu fictif.

Productions : sélection Production → Variable → Année → Maille publiée ; recherche, clic, zoom, légende numérique, unités, valeur et fiche cohérentes. Les 713 PRA sont renseignées nationalement par le RPG2025. Le panneau donne surface, part dans les déclarations PAC et principales cultures ; un seul millésime RPG ne produit pas d’historique inventé. Les NULL, zéros observés et secrets statistiques restent distincts.

La SAA affiche de vrais polygones départementaux/régionaux. La fiche dit « non disponible à la PRA » et ne répartit pas une valeur départementale entre PRA. Les volailles restent régionales et en milliers de têtes. Les courbes et tables accessibles restituent les seize années natives ; 2025 provisoire et historiques révisés sont explicités. Un rechargement d’URL 2010 conserve sa sélection.

Analyse blé : A. aléa climatique inchangé ; B. surface/part RPG2025 ; C. lecture descriptive avec les années 2025/2026 explicites. Aucun stade, vulnérabilité, rendement perdu ou surface touchée déduit. Les 68 couvertures climatiques manquantes restent indépendantes de l’agriculture. Le THI reste stationnel, avec son parcours historique accessible.

La recette vérifie le même élément canvas lors des passages entre les trois espaces, le contexte PRA, la fermeture du panneau et les URL. Elle exige treize régions, une couverture nationale, aucun statut partiel résiduel, et une empreinte identique entre carte, API et fiche.

Preview validée : https://agriclimax-4rscsoh29-mehdi-sines-projects.vercel.app (commit fonctionnel `60090e83e3b06133db5d8d318fece3a15326b96d`). Le navigateur accède à une passerelle locale en lecture seule ; celle-ci relaie exactement la Preview et vérifie normalement son certificat HTTPS avec les CA système. Aucun contournement TLS, fixture ou changement du magasin NSS personnel. La passerelle est un outil de recette temporaire, pas une fonctionnalité produit.
