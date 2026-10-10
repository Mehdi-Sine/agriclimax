# Architecture UX — AgriclimaX

## Navigation primaire
Desktop : rail/header léger avec **Observation | Veille | Diagnostic**. Le contexte courant (production, indicateur, territoire, date) est partagé entre les espaces via URL/state canonique.

Mobile : deux entrées primaires **Carte** et **Veille** ; Diagnostic s'ouvre depuis une sélection ou un signal sous forme de vue dédiée/bottom sheet plein écran.

## Desktop >= 1280 px
- carte dominante 60–75 % ;
- panneau latéral redimensionnable ;
- filtres persistants mais compacts ;
- diagnostic en drawer ou panneau secondaire sans perdre la carte ;
- densité experte assumée.

## Tablette 768–1279 px
- split view lorsque l'espace le permet ;
- panneau recouvrant/repliable ;
- mêmes capacités que desktop, réorganisées.

## Mobile < 768 px
- aucune réduction mécanique du desktop ;
- carte plein espace avec barre de contexte compacte ;
- filtres dans sheet ;
- switch Carte/Veille explicite ;
- détails dans bottom sheet puis écran complet ;
- cibles tactiles >= 44 px ;
- métriques prioritaires seulement au premier niveau.

## Parcours 1 — Observer
Sélectionner production → risque → date → voir distribution → sélectionner zone → voir résumé local → ouvrir diagnostic.

## Parcours 2 — Veiller
Ouvrir veille → filtrer → lire signal → vérifier fraîcheur/source → centrer la carte sur le territoire → ouvrir diagnostic.

## Parcours 3 — Comprendre
Depuis carte/signal → série temporelle → seuil/version → provenance → limites/confidence → retourner au contexte sans perte.

## États obligatoires
`loading`, `processing`, `missing`, `insufficient`, `stale`, `no-risk`, `risk`, `calculation-error`, `source-error`, `demo`.

## Principes cartographiques
- légende toujours liée à l'indicateur courant ;
- unité, date de validité et date de mise à jour visibles ;
- couleur stable pour une classe d'un même indicateur ;
- éviter la comparaison de cartes utilisant des classes incompatibles sans avertissement ;
- localisation/zoom stockés dans l'URL lorsque partageable.

## Shell de démonstration Task 05

Le shell à `/` consomme `DemoRiskRepository`, sans service cloud. Les filtres
production/indicateur/territoire/date et compare existant passent par
`parseContext`/`serializeContext`. Le paramètre UI additionnel `view` sélectionne
observation/watch/diagnostic ; il ne change aucun contrat partagé. Navigation et
retour navigateur conservent le contexte canonique. Un contexte sans fixture
montre missing ; aucun signal hors contexte n'est affiché.

- Desktop : header, filtres sur une ligne, zone d'observation dominante et veille
  latérale. Diagnostic modal latéral avec contexte conservé derrière.
- Tablette : filtres sur deux colonnes, split view plus compacte et commande de
  repli/affichage de la veille. Le diagnostic recouvre le contexte temporairement.
- Mobile : contexte compact, filtres en bottom sheet, navigation fixe Carte/Veille,
  un espace visible à la fois. Diagnostic dans un drawer occupant toute la largeur.
  Deux métriques prioritaires, troisième carte masquée au premier niveau.

La grille d'observation est un emplacement explicitement sans carte réelle.
La veille est une composition de fixture, le diagnostic une fiche de composants.
Pas de carte Task 06, moteur Task 07 ni diagnostic/séries métier Task 08.
L'intégration ultérieure remplacera les emplacements par des slots fonctionnels
sans modifier les palettes ou la signification des états.

### Compatibilité main Tasks 02–04

Le shell démo reste local par défaut. Le paramètre explicite `mode=live` utilise
le repository serveur Task 04 avec production/indicateur/règle/version/date/bbox
fournis, sans défaut scientifique. Une collection vide est missing, une erreur
reste source-error sans fallback démo. Le contexte live est conservé dans les
filtres et la navigation. Les résultats non vides sont seulement comptés, en
attente de Task 06 ; aucun signal ou diagnostic fictif n'est ajouté aux données live.
Les API, migrations et moteurs existants sont inchangés.
