# UX-01 — Recette et limites de la première intégration

**Branche :** `codex/UX-01-product-redesign`, PR draft #77, dérivée de la fusion de OPS-02 (#75).

## Parcours implémentés
- La route racine redirige vers `/journal`, excepté les anciens paramètres d'exploration qu'elle redirige vers `/climat`.
- Journal IA : lecture seule de `operationalEditions()`; éditions datées, archives, contenu et réserves scientifiques conservés. Aucune génération déclenchée à la navigation.
- Navigation principale à cinq rubriques exactes, composant commun partagé par le Journal et l'explorateur.
- `/cartes-du-jour` : cartes issues des illustrations **effectivement archivées**, sans fabrication de données ; une carte interactive active à la fois ; navigation clavier, boutons, repères et toucher ; prise en compte du paramètre `map` lié au Journal.
- `/climat` : moteur cartographique existant avec filtres principaux visibles (indicateur, période, PRA), détails avancés repliables pour l'historique.
- `/productions` : sélection par familles dérivées du catalogue agricole chargé, sans nouveaux calculateurs.
- `/aide-et-documentation` : recherche locale et 15 thèmes documentaires, avec renvoi au référentiel technique préexistant `/aide/cartes`.

## Frontières préservées
Aucun changement aux GitHub Actions, chronographies, secrets, migrations, collectes, Supabase, éditeur OpenAI, catalogue et calculs AGRO-02. Le registre sémantique des cartes et la géométrie des 713 PRA sont conservés.

## Écarts assumés et suites nécessaires
1. **Sélection quotidienne de 5–10 cartes et vues pré-rendues :** pas encore prises en charge par le moteur éditorial actuel. La page montre uniquement les illustrations archivées ; leur représentation est rendue à la demande, sans charger huit instances MapLibre simultanées. À finaliser en JOUR-02 sans cartes fictives.
2. **Documentation détaillée :** l'index UX est consultable mais l'enrichissement des sections avec méthodes exhaustives, preuves et index scientifique devra être alimenté progressivement depuis le code et les fiches versionnées ; `/aide/cartes` constitue le niveau détaillé existant.
3. **Mise en page :** maquette conservée comme intention graphique ; les décryptages et chiffres présents dépendent strictement des éditions réellement archivées, sans valeur ou carte de remplacement.
4. **Comparatif visuel :** captures de la maquette fournies par le propriétaire ; captures navigateur de cette branche à produire et valider à 1440/1280/768/390/360 avant fusion. Ne pas déclarer de fidélité pixel-perfect sans cette preuve.

## Liste de contrôle manuelle
- Édition du jour ou dernière édition datée ; archives et lien profond `?date`/`?id`.
- Carte de une présente seulement si son archive est qualifiée ; archives conservant cycle et période.
- Carte du Journal → carrousel sur le bon ID ; flèches, clavier, tactile, états vides.
- Explorer : recherche PRA et rétablissement de la vue nationale ; historique, météo récente, prévisions, source et qualité.
- Productions : familles, variables et millésimes réels ; disponibilité partielle.
- Documentation : recherche, sommaire, liens et focus.
- Navigation sur desktop/tablette/mobile, contrastes, débordements, activation clavier.
- Compatibilité `/veille`, `/analyse`, `/productions`, `/almanach`, paramètres de l'ancien `/`.

**Interdiction de fusionner avant recette visuelle et CI vertes.**
