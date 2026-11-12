# UX-02B — Climacta : alignement visuel sur la maquette de référence

## Contexte

La tâche UX-02 a déjà été réalisée et a permis d'intégrer la nouvelle identité Climacta dans AgriClimaX.

Cependant, deux références graphiques essentielles n'avaient pas été jointes à cette première tâche :

1. **La maquette HTML Climacta**, qui constitue notre référence principale pour l'identité visuelle, la composition et la hiérarchie éditoriale.
2. **L'image Climate Stripes**, qui doit être utilisée comme élément graphique de signature en haut de l'application.

Ces deux fichiers sont joints à cette nouvelle tâche.

**L'objectif n'est pas de refaire UX-02, mais d'améliorer son rendu pour atteindre une fidélité visuelle élevée à la maquette.**

## 1. Commencer par un audit visuel comparatif

Examiner attentivement :
- La maquette HTML fournie, y compris ses styles CSS, ses dimensions, sa typographie, ses espacements et ses composants.
- L'image Climate Stripes jointe.
- L'interface Climacta actuellement développée dans UX-02.
- Les pages réelles de l'application, en particulier le Journal et ses cartes PRA.

Identifier les différences significatives entre la maquette et l'implémentation.

**La maquette HTML est la référence graphique prioritaire.** L'application actuelle reste la référence fonctionnelle.

Ne pas réinterpréter librement le design si la maquette donne déjà une réponse claire.

## 2. Reproduire fidèlement l'identité graphique

### Bandeau Climate Stripes

Utiliser l'image jointe comme véritable ressource graphique du projet.

- Bandeau horizontal fin, sur toute la largeur de la fenêtre.
- Respecter la succession et les proportions des bandes verticales de l'image.
- Conserver la transition des bleus vers les blancs puis les rouges.
- Ne pas introduire de vert ou de jaune dans l'identité de marque.
- Ne pas recréer approximativement les stripes en CSS si l'image peut être utilisée directement.
- Veiller à un affichage net sur ordinateur et mobile, sans déformation visuelle.

### Logo et identité

Respecter le traitement typographique de la maquette :

**Climacta.**

Avec le point final, sa typographie, ses proportions et son positionnement.

Signature :

**Le climat des territoires agricoles.**

Respecter l'équilibre entre le logo, la signature, le bandeau Climate Stripes et la navigation.

Ne pas ajouter d'éléments décoratifs absents de la maquette.

### Palette graphique

Reprendre les couleurs exactes de la maquette lorsqu'elles sont définies :

- Bleu marine profond pour les titres et la navigation.
- Fond blanc cassé ou ivoire très clair.
- Bleu ardoise pour les informations secondaires.
- Corail pour les accents et les éléments interactifs.
- Filets et séparateurs discrets.

Reprendre les valeurs CSS de référence plutôt que choisir des couleurs seulement approchantes.

**Important : ne pas modifier les palettes scientifiques des cartes climatiques et leurs légendes.** Les couleurs de l'identité Climacta et les couleurs des indicateurs météorologiques répondent à deux logiques différentes.

## 3. Retrouver la composition éditoriale de la maquette

La page d'accueil doit rester le **Journal agroclimatique du jour**.

Reproduire aussi fidèlement que possible :

- Les proportions de l'en-tête.
- Les marges et la largeur maximale du contenu.
- La typographie et la taille du titre principal.
- Les espacements entre les blocs.
- La présentation de la date et des informations de mise à jour.
- Le traitement du chapeau éditorial.
- Les séparateurs et les encadrés.
- Les cartes d'accès aux contenus.
- La sobriété générale de l'interface.

L'objectif est un rendu proche d'un **journal scientifique et territorial contemporain**, plutôt que d'un tableau de bord technique ou d'un portail institutionnel.

Préserver une bonne densité d'information sans multiplier les cartes, badges, boutons ou encadrés.

## 4. Préserver les fonctionnalités opérationnelles

L'interface actuelle contient des fonctionnalités réelles qui n'existaient pas nécessairement dans la maquette.

Elles doivent être conservées :

- Journal quotidien généré par IA.
- Publication automatique issue d'OPS-06 / PR #84.
- Avertissement éditorial des éditions expérimentales.
- Cartes PRA interactives.
- Les 10 cartes publiées lors de l'édition du 12 novembre.
- Sélection des dates et navigation dans les archives.
- Accès aux cartes climatiques et agricoles.
- Rubrique « Aide et documentation ».
- Indicateurs et légendes scientifiques.
- Affichage des données manquantes.
- États de chargement, erreurs et fallbacks.

Lorsque la maquette et les fonctionnalités réelles diffèrent, **adapter les fonctionnalités au langage visuel de la maquette, sans les supprimer**.

La page `/` doit afficher directement le Journal, sans transition visible depuis une autre page.

## 5. Travail attendu

Effectuer directement les modifications nécessaires dans le code existant.

Privilégier :
- La réutilisation des composants actuels.
- Une feuille de style et des tokens graphiques cohérents.
- Des modifications ciblées plutôt qu'une refonte structurelle.
- Le responsive desktop, tablette et mobile.
- L'accessibilité et les contrastes.

Ne pas modifier les workflows d'acquisition, les sources météo, les calculs PRA, Supabase, les prompts IA, les archives ou les mécanismes de publication.

Ne pas modifier les identifiants techniques `agriclimax`.

## 6. Validation visuelle obligatoire

Créer une Preview Vercel.

Comparer visuellement la maquette de référence et la nouvelle implémentation, en particulier sur :

1. En-tête, logo et Climate Stripes.
2. Page d'accueil / Journal.
3. Cartes du jour.
4. Navigation.
5. Version mobile.

Fournir des captures avant/après sur desktop et mobile.

Corriger les écarts visuels importants avant de terminer la tâche.

Exécuter les tests nécessaires : lint, typecheck, build et contrôles de non-régression pertinents.

## 7. Livrable

Créer une nouvelle PR intitulée :

**UX-02B — Alignement Climacta sur la maquette graphique**

Dans le compte rendu :

- Résumer les principaux écarts identifiés et corrigés.
- Indiquer les éléments reproduits fidèlement.
- Signaler les éventuels écarts conservés pour des raisons fonctionnelles.
- Fournir l'URL de Preview Vercel.
- Fournir les captures desktop/mobile.
- Confirmer que les workflows et les données scientifiques sont inchangés.

Ne pas fusionner automatiquement.

**Critère de réussite : lorsque j'ouvre la nouvelle Preview, je dois retrouver immédiatement l'identité et l'atmosphère de la maquette HTML fournie, mais avec les véritables données et fonctionnalités de Climacta.**