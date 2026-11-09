# Production d'une édition

1. Préparer et valider T33, y compris contributions et collecte T34 déjà qualifiée.
2. Choisir un modèle disponible et configurer explicitement ses tarifs en euros, datés et versionnés.
3. Exécuter la simulation locale ; l'activation réelle exige `--live-authorized` ET `AGRICLIMAX_AI_ENABLED=true` et une clé serveur.
4. Réserver le coût maximal sous verrou global et inscrire `reserved`, puis `running`, sur disque synchronisé.
5. Un unique POST Responses demande sélection du sujet, arbitrages succincts et rédaction structurée de toutes les rubriques.
6. Contrôler chaque bloc et chaque référence. Archiver le diagnostic original en cas de rejet ; rendre le repli sans seconde génération.
7. Conserver l'édition et ses preuves, puis consulter la Preview. Une nuance sémantique nouvelle exige toujours une revue éditoriale.

Les états de publication `draft`, `validated_automatically`, `needs_editorial_review`, `rejected`, `approved`, `published` sont identifiés ; T35 interdit les deux derniers dans le lecteur d'archives. Une validation automatique n'est pas une approbation de publication.

Les états d'exécution sont distincts. `outcome_unknown` bloque toute nouvelle dépense, y compris sur un autre modèle, jusqu'à réconciliation externe documentée. Le même dossier peut continuer à être relu depuis son repli archivé. Aucun effacement automatique du verrou après crash.
