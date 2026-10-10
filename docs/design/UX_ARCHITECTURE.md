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
