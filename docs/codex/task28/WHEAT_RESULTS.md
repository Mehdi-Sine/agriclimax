# Blé tendre — résultats réels

Les neuf indicateurs blé du catalogue sont calculés nationalement : GDD, jours chauds, séquence chaude maximale, jours de gel, séquence de gel maximale, pluie cumulée, jours de pluie importante, jours secs, séquence sèche maximale. Les résultats incluent fréquence et durée maximale des épisodes lorsque la fenêtre est complète. Les seuils sont explicites et modifiables. Statut scientifique : exploratoire pour tous.

Sur le 25–31 octobre 2026, chaque indicateur blé dispose de 645/713 PRA complètes et 68 valeurs NULL. Les extrêmes et la pluie utilisent les agrégats existants, sans nouvelles acquisitions. La fenêtre 2–31 octobre (30 jours) donne également 645 résultats GDD complets ; réponse 2 925 635 octets avec 30 journées détaillées pour une seule PRA. Voir `evidence/30days.json`.

Sur chacune des journées J+1 à J+7 du cycle national 6 novembre 06 UTC (7–13 novembre), les indicateurs blé sont disponibles sur 713 PRA. Cela décrit le support météo, pas une validation des extrêmes terrestres locaux ni de la sensibilité du blé. Les comptes et séquences portant sur une seule journée ont naturellement une durée maximale de 0 ou 1 jour.

Les cumuls sur la semaine entière restent NULL lorsqu'un changement de source/run intervient dans la sélection nationale. La série quotidienne montre les sources et échéances ; le contrôle des dates permet des fenêtres homogènes. Aucun raccordement arbitraire n'est réalisé. Les fenêtres historiques 7/30 jours et les fenêtres personnalisées de 1 à 30 jours suivent la même politique de complétude.

Exemple réel Beauce dunoise (pra:28341), 25–31 octobre : 73,535799 °C·j, affiché 73,54 °C·j, base 0 °C. Ce résultat ne prédit pas un stade. Le contexte RPG 2025 montre 14 242,28 ha déclarés et 22,43 % des surfaces RPG acquises, indépendamment de l'aléa. Aucun hectare touché n'est estimé.

Les signaux de journées chaudes, gelées, sèches ou fortement pluvieuses expliquent date, PRA, variable, valeur, seuil strict, source et run. Il s'agit de conditions climatiques à surveiller, pas d'alertes officielles ni de prescriptions.

Preuves : `evidence/coverage.json` (130 cas nationaux), `evidence/independent-local.json` (comparaisons Python indépendantes), `evidence/local/acceptance.json` (API/fiche sur trois formats). Ces preuves sont locales sur données cloud réelles, pas des preuves Preview.
