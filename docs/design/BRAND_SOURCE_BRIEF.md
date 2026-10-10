# Brief source identité / UX fourni par le porteur du projet

> Note canonique : le nom de marque retenu pour l’implémentation est **AgriclimaX**. Le texte source ci-dessous est conservé comme brief de référence ; toute variante de casse du nom qu’il contient est supplantée par cette règle.


# AGRICLIMAX — BRANDING, UX/UI ET INTÉGRATION PRODUIT

## 1. MISSION

Tu interviens comme lead product designer, architecte frontend et ingénieur logiciel senior sur AgriClimax.

AgriClimax est une plateforme d'observation, de veille et d'anticipation des risques climatiques affectant les productions agricoles, végétales et animales.

La plateforme collecte et traite quotidiennement des données météorologiques, climatiques, satellitaires, agronomiques et de production.

Elle croise ces données avec les caractéristiques des filières agricoles, notamment les stades de développement et les périodes de sensibilité, afin d'identifier des risques territorialisés.

Elle restitue ces informations sous deux formes complémentaires :
- Une interface cartographique interactive.
- Un fil de veille contextualisé, alimenté par des analyses et des synthèses générées avec assistance IA.

Les utilisateurs prioritaires sont les conseillers agricoles, les ingénieurs et experts des instituts techniques agricoles, ainsi que les responsables de filières.

À terme, AgriClimax pourra évoluer vers une plateforme plus large d'intelligence territoriale agricole.

## 2. POSITIONNEMENT ET IDENTITÉ

Nom : AgriClimax

Signature : Observer. Comprendre. Anticiper.

Descripteur : L'observatoire des risques climatiques agricoles.

Promesse : Transformer les données climatiques et agricoles en informations territorialisées, vérifiables et utiles à l'anticipation des risques.

Personnalité :
- Scientifique et rigoureuse.
- Moderne et innovante.
- Sobre, précise et accessible.
- Crédible auprès d'un public d'experts.
- Internationale sans perdre son ancrage agricole.

Ne pas utiliser une esthétique traditionnelle agricole : épis de blé, fermes illustrées, feuilles décoratives ou vert omniprésent.

Ne pas adopter non plus les conventions visuelles artificielles de l'IA : cerveaux électroniques, robots, circuits lumineux, interfaces futuristes.

L'IA doit apparaître comme une technologie au service de l'analyse, et non comme l'identité principale du produit.

## 3. DESIGN SYSTEM

Créer un design system centralisé, réutilisable et documenté.

Palette principale :
- brand.primary : #123D38
- brand.secondary : #287E88
- brand.accent : #BDE1CF
- surface.base : #F6F7F3
- text.primary : #263A43
- accent.amber : #D99545

Palette sémantique indicative :
- risk.low : #66A98E
- risk.moderate : #E7C75C
- risk.high : #E68F4D
- risk.critical : #C65358
- risk.unavailable : #718C85

Ne jamais coder les couleurs directement dans les composants métiers.

Les couleurs de risque sont des tokens de présentation. Les seuils de déclenchement et les catégories de risques doivent provenir d'une configuration scientifique indépendante.

Prévoir des palettes adaptées au thème clair et sombre, et vérifier les contrastes WCAG AA.

Typographie :
- Manrope pour la marque et les titres.
- Inter pour les interfaces et les textes.
- Chiffres tabulaires pour les indicateurs.

Style :
- Interface claire par défaut.
- Densité d'information adaptée aux utilisateurs experts.
- Hiérarchie visuelle rigoureuse.
- Surfaces et séparateurs discrets.
- Utilisation modérée des ombres et effets.
- Grille cohérente, espaces et rayons standardisés.
- Animations sobres et fonctionnelles.

Respecter les préférences de réduction des animations.

## 4. IDENTITÉ DE MARQUE

Créer un système de marque AgriClimax comprenant :
- Un logotype typographique.
- Un symbole indépendant.
- Une icône d'application.
- Un favicon.
- Une version monochrome.
- Une déclinaison pour fond sombre.
- Les métadonnées et la configuration PWA, si applicables.

Concept graphique privilégié :
Combiner une courbe de signal climatique, une ligne d'horizon et un point d'observation géographique.

Le symbole ne doit pas ressembler à un pictogramme d'alerte générique.

L'identité doit fonctionner à différentes échelles, notamment en petit format sur mobile.

Créer des SVG maintenables avec des dimensions et viewBox cohérentes.

Ne pas utiliser de marques, pictogrammes propriétaires ou ressources sans licence appropriée.

Le nom et les actifs de marque doivent être centralisés pour permettre une éventuelle évolution sans refactoring métier.

## 5. ARCHITECTURE DE L'EXPÉRIENCE

Structurer l'application autour de trois espaces complémentaires.

### A. Observation territoriale

Vue cartographique interactive permettant :
- De naviguer de l'échelle nationale à l'échelle locale.
- De sélectionner les territoires.
- De filtrer les espèces, filières et indicateurs.
- D'afficher des couches climatiques, satellitaires et agricoles.
- De visualiser les niveaux et les zones de risque.
- De comparer différentes périodes si les données le permettent.

Veiller à la cohérence des légendes, unités, seuils, dates et échelles.

Les couleurs doivent conserver une signification stable au sein d'un même indicateur.

### B. Fil de veille

Créer ou harmoniser une vue organisée chronologiquement, affichant pour chaque signal :
- Nature du risque.
- Territoire concerné.
- Espèce ou filière.
- Stade de développement si pertinent.
- Période d'observation et de validité.
- Niveau de vigilance.
- Synthèse rédigée.
- Sources et informations permettant de vérifier le signal.

Prévoir une lecture compacte et une lecture détaillée.

Le contenu généré par IA doit être clairement identifié comme tel et relié à des données vérifiables.

Ne jamais inventer une source, une valeur, une incertitude ou une date absente des données.

### C. Diagnostic détaillé

Permettre de consulter :
- Les indicateurs et leurs valeurs.
- Les séries temporelles disponibles.
- Les seuils et méthodes de calcul.
- Les sources utilisées.
- La couverture et la fraîcheur des données.
- Les incertitudes et limites scientifiques.
- Les éventuels liens vers la documentation des modèles.

Distinguer systématiquement donnée observée, indicateur calculé, prévision et commentaire généré par IA.

## 6. RESPONSIVE DESIGN

Desktop :
- Carte principale dominante.
- Panneau de veille latéral redimensionnable ou repliable.
- Barre de filtres facile d'accès.
- Panneaux de diagnostic consultables sans perdre le contexte territorial.

Tablette :
- Adaptation des panneaux.
- Possibilité d'afficher successivement ou conjointement carte et veille.

Mobile :
- Navigation simple.
- Bascule claire entre Carte et Veille.
- Cartes de signal compactes.
- Filtres accessibles sans occuper tout l'écran.
- Fiches détaillées consultables confortablement au toucher.

Ne jamais se contenter de réduire l'interface desktop pour le mobile.

## 7. EXIGENCES SCIENTIFIQUES ET FONCTIONNELLES

AgriClimax est une plateforme scientifique avant d'être un produit graphique.

Préserver rigoureusement :
- Les pipelines de données.
- Les modèles et algorithmes de calcul.
- Les paramètres agronomiques.
- Les référentiels d'espèces et de filières.
- Les règles d'agrégation spatiale et temporelle.
- Les API et contrats de données.
- Les tâches planifiées.
- Les fonctions de génération de veille.

Ne pas modifier des modèles scientifiques pour satisfaire une contrainte de présentation.

Ne pas mélanger intensité du phénomène, vulnérabilité de la production, niveau de risque et confiance dans l'analyse.

Prévoir des états distincts pour :
- Données absentes.
- Données insuffisantes.
- Analyse en cours.
- Risque non identifié.
- Risque identifié.
- Erreur de calcul ou de récupération.

Toute donnée de démonstration doit être explicitement signalée comme fictive.

## 8. MÉTHODE DE TRAVAIL SUR LE DÉPÔT

Avant de coder :
1. Inspecter la structure du dépôt et les technologies existantes.
2. Lire les instructions projet et la documentation.
3. Identifier les composants et fonctionnalités réutilisables.
4. Repérer les dépendances entre frontend, backend, données, cartographie et génération IA.
5. Proposer un plan de réalisation par étapes.
6. Définir les zones où les changements pourraient introduire des régressions.

Conserver la stack existante lorsqu'elle reste adaptée.

Ne pas introduire une nouvelle bibliothèque UI, cartographique ou graphique simplement pour obtenir un rendu différent.

Privilégier l'évolution incrémentale des composants.

Si le dépôt est vide ou incomplet, proposer une architecture modulaire, robuste et évolutive avant de lancer l'implémentation.

## 9. LIVRABLES ATTENDUS

Créer ou mettre à jour, selon l'organisation existante :
- La configuration de marque.
- Les design tokens.
- Les composants graphiques réutilisables.
- Le logo et ses variantes SVG.
- Les ressources favicon/PWA.
- Les styles et thèmes.
- Les principaux composants cartographiques.
- Les composants du fil de veille.
- Les composants de diagnostic scientifique.
- Les métadonnées de l'application.
- La documentation du design system.

Créer un document BRAND_GUIDELINES.md décrivant :
- Le positionnement d'AgriClimax.
- Les règles d'utilisation de la marque.
- La palette et les typographies.
- Le langage visuel cartographique.
- Les composants et états d'interface.
- Les règles responsive.
- Les bonnes pratiques d'accessibilité.

Créer un document UX_ARCHITECTURE.md présentant :
- La navigation.
- Les parcours principaux.
- Les vues desktop, tablette et mobile.
- Les interactions entre carte, veille et diagnostic.

## 10. VALIDATION

Avant de conclure :
- Exécuter les tests existants.
- Vérifier que les pipelines et API ne sont pas affectés.
- Vérifier les principaux parcours utilisateurs.
- Vérifier le responsive.
- Vérifier l'accessibilité.
- Vérifier les états de chargement, d'erreur et de données manquantes.
- Vérifier les dates, unités et légendes.
- Éliminer les références obsolètes à l'ancien nom dans l'interface et la documentation, sans renommer aveuglément des identifiants techniques ou des ressources persistantes.

Présenter un récapitulatif clair des fichiers modifiés, des tests effectués et des éventuelles limites.

## 11. PRIORITÉS

P0 : Préserver les fonctions existantes et la fiabilité scientifique.
P1 : Intégrer une identité AgriClimax cohérente.
P2 : Améliorer l'articulation entre carte et veille.
P3 : Assurer une expérience mobile et desktop de qualité.
P4 : Structurer le design system pour les développements futurs.

Ne pas entreprendre de réécriture totale du projet si une intégration incrémentale permet d'atteindre ces objectifs.

Commencer par analyser le dépôt et établir le plan de travail, puis mettre en œuvre les changements par lots testables.
