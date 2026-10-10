# AgriclimaX — Brand Guidelines

## Positionnement
Scientifique, rigoureux, moderne, sobre, précis et accessible. International sans perdre son ancrage agricole.

Éviter : imagerie agricole décorative (épis, ferme, feuilles, vert omniprésent) et clichés IA (cerveaux, robots, circuits néon).

## Marque
- Nom : **AgriclimaX**
- Signature : **Observer. Comprendre. Anticiper.**
- Descripteur : **L'observatoire des risques climatiques agricoles.**

## Concept du symbole
Combiner de manière abstraite :
1. une courbe de signal climatique ;
2. une ligne d'horizon ;
3. un point d'observation géographique.

Le symbole ne doit pas être un triangle d'alerte. Il doit rester lisible à 16–24 px.

## Tokens couleur de référence
- `brand.primary` `#123D38`
- `brand.secondary` `#287E88`
- `brand.accent` `#BDE1CF`
- `surface.base` `#F6F7F3`
- `text.primary` `#263A43`
- `accent.amber` `#D99545`

Risque :
- `risk.low` `#66A98E`
- `risk.moderate` `#E7C75C`
- `risk.high` `#E68F4D`
- `risk.critical` `#C65358`
- `risk.unavailable` `#718C85`

Ces valeurs sont des **tokens de présentation**, jamais des seuils scientifiques.

## Typographie
- Marque/titres : Manrope avec fallback système.
- Interface/texte : Inter avec fallback système.
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

## Actifs livrés — Task 05

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
