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
