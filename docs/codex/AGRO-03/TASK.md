# AGRO-03 — Extension multi-productions des indicateurs agroclimatiques

Mission : auditer les 13 indicateurs annoncés et l'existant sur le dernier main,
construire une matrice blé/maïs/colza, bovins lait et viande, porcins, volailles,
vigne, arboriculture et prairies ; livrer 6 à 10 nouveautés ou variantes utiles,
référencées, testées hors ligne sur archives et PRA contrastées.

Contrat : identités et paramètres explicites, unités, références, périodes,
limites et règles de disponibilité. Préparer les usages cartographiques et
éditoriaux sans inférer stade, dommage, perte de rendement ou effet zootechnique.

Base : origin/main `167adec`. Branche indépendante `feat/agro-03-multi-productions`.
Frontières affectées : opérateurs déterministes additifs du noyau, injection
explicite d'un catalogue dans le service multi-productions, nouveau catalogue
hors production, contrats, tests et documentation.

Frontières préservées : registre actif AGRO-02, interfaces, workflows nocturnes,
acquisitions, adaptateur SAFRAN/SIM, archives publiées, OPS-07, prompts et moteur
éditorial quotidien. Aucun déploiement ni activation automatique.

Livraison : une PR draft « AGRO-03 — Extension multi-productions des indicateurs
agroclimatiques », avec inventaire, matrice priorisée, sélection implémentée,
références/limites, reports et intégration progressive. Ne pas fusionner.
