# Climacta — Brand Guidelines

## Positionnement
Scientifique, rigoureux, moderne, sobre, précis et accessible. International sans perdre son ancrage agricole.

Éviter : imagerie agricole décorative (épis, ferme, feuilles, vert omniprésent) et clichés IA (cerveaux, robots, circuits néon).

## Marque
- Nom : **Climacta**
- Signature : **Le climat des territoires agricoles.**
- Descripteur : **Le climat des territoires agricoles.**

## Concept du symbole
Le carré Climate Stripes reprend le PNG original de la maquette, centré et
recadré comme sa marque graphique. Le bandeau utilise toute sa largeur, sans
réordonner les bandes ni fabriquer de couleurs intermédiaires.

## Tokens couleur de référence
- `brand.primary` `#182b40`
- `brand.secondary` `#235b87`
- `brand.accent` `#c75159`
- `surface.base` `#f8fafb`
- `text.primary` `#182b40`
- `accent.amber` `#D99545`

Risque :
- `risk.low` `#66A98E`
- `risk.moderate` `#E7C75C`
- `risk.high` `#E68F4D`
- `risk.critical` `#C65358`
- `risk.unavailable` `#718C85`

Ces valeurs sont des **tokens de présentation**, jamais des seuils scientifiques.

## Typographie
- Marque/titres éditoriaux : Georgia avec fallback serif.
- Interface/texte : system-ui, -apple-system, Segoe UI, sans-serif.
- Indicateurs : chiffres tabulaires.
- Ne jamais committer de fichier de police propriétaire/non redistribuable.

## Accessibilité
- WCAG AA au minimum.
- Ne jamais coder un niveau de risque par la couleur seule : ajouter label, motif/icône/texte.
- Thèmes clair et sombre.
- Focus visible.
- Respect de `prefers-reduced-motion`.

## Actifs attendus
`logo-wordmark.svg`, `symbol.svg`, `app-icon.svg`, variantes monochromes et dark. Les SVG doivent être maintenables et sans ressource non licenciée.

## Actifs livrés — Task 05 (historique)

`apps/web/lib/brand.ts` centralise nom, signature, descripteur et chemin du symbole.
`public/brand/` contient `logo-wordmark.svg`, `symbol.svg`, `app-icon.svg`,
`favicon.svg`, `logo-monochrome.svg`, `logo-dark.svg`, `symbol-monochrome.svg`
et `symbol-dark.svg`. Les traits originaux représentent signal, horizon et point,
sans alerte triangulaire, imagerie agricole décorative ou motif IA.

Le symbole utilise un viewBox 48×48 ; icône/favicon 64×64 avec marge interne.
Le logo utilise un viewBox 260×48. Les couleurs fallback des SVG autonomes sont
limitées aux actifs de marque, avec des variables CSS pour les intégrations.
La variante monochrome utilise `currentColor`. Employer la variante dark sur
fond sombre. Maintenir le ratio et une zone libre d'au moins 8 px à taille 48 px.
Le symbole reste lisible en petit format ; le wordmark privilégie les grands
formats. Le texte SVG utilise Manrope avec fallback système : pour un export
imprimé figé, charger la police ou convertir le texte en contours dans l'outil
éditorial. Aucun asset propriétaire.

Le manifest fournit le nom et l'icône ; aucun service worker ni promesse de
fonctionnement hors ligne PWA n'est ajouté. Les polices et fixtures restent
locales. L'identité interactive utilise le symbole inline et le nom de `BRAND`.

## Rebranding Climacta — novembre 2026

Climacta est le nom public, y compris pour le Journal, les métadonnées, le manifest
et les actifs SVG. Les identifiants techniques `agriclimax` (packages, stockage,
variables d'environnement, préférences locales) restent stables. Les archives et
prompts versionnés gardent leur contenu historique et leurs empreintes.

## UX-02B — référence graphique fournie

La maquette HTML propriétaire fixe le logo Georgia 36 px « Climacta. », point
corail `#c75159`, sa signature et le symbole carré Climate Stripes. Le PNG
original est conservé dans `public/brand/climate-stripes.png`, sans transformation.
Bandeau 10 px pleine largeur ; enveloppe 1220 px, marges 30 px desktop / 18 px
mobile ; titres Georgia jusqu’à 58 px, texte système. Marine `#182b40`, bleu
`#235b87`, fond `#f8fafb`, séparateurs `#e4eaf0`. Ces valeurs remplacent les
anciennes couleurs de marque de Task 05 ; toutes les palettes scientifiques
restent indépendantes et inchangées. Les encadrés restent blancs, rayon 12 px.
