# UX-02B — comparaison visuelle

[Preview Vercel](https://agriclimax-git-codex-ux-02b-climact-64c310-mehdi-sines-projects.vercel.app/)
· [PR #86](https://github.com/Mehdi-Sine/agriclimax/pull/86)

| Vue | Maquette | Avant UX-02B | Après UX-02B sur Vercel |
| --- | --- | --- | --- |
| Journal desktop 1440 px | [Référence](evidence/reference-desktop.png) | [Avant](evidence/before-journal-desktop.png) | [Après](evidence/after-journal-desktop.png) |
| Journal mobile 390 px | [Référence](evidence/reference-mobile.png) | [Avant](evidence/before-journal-mobile.png) | [Après](evidence/after-journal-mobile.png) |
| Cartes desktop 1440 px | Même identité | [Avant](evidence/before-cartes-desktop.png) | [Après](evidence/after-cartes-desktop.png) |
| Cartes mobile 390 px | Même identité | [Avant](evidence/before-cartes-mobile.png) | [Après](evidence/after-cartes-mobile.png) |
| Tablette 768 px | Composition à une colonne | — | [Journal](evidence/after-journal-tablet.png) · [Cartes](evidence/after-cartes-tablet.png) |

## Éléments reproduits

PNG original Climate Stripes conservé sans modification, bandeau 10 px sur toute
la fenêtre, carré 46 px arrondi à 8 px, logo Georgia 36 px avec point corail,
signature « Le climat des territoires agricoles. ». En-tête compact 95 px sur
desktop ; navigation qui revient à la ligne sur petit écran.

Conteneur 1220 px et marges 30/18 px ; titres Georgia 34–58 px, chapeau sans-serif
17 px ; marine `#182b40`, fond `#f8fafb`, bleu `#235b87`, corail `#c75159`, filets
`#e4eaf0` ; encadrés blancs arrondis à 12 px. Composition en deux colonnes sur
desktop, une colonne sur mobile. Encadrés « L’essentiel » et « Dans cette édition ».

## Adaptations fonctionnelles conservées

- Le titre et les textes sont ceux de l’archive réelle du 12 novembre, donc leur
  longueur diffère des exemples de la maquette.
- Les avertissements et réserves restent visibles avant l’article ; aucune
  information n’est masquée pour rapprocher artificiellement les captures.
- L’essentiel affiche 713 PRA du référentiel, dix cartes de l’édition et deux
  éclairages régionaux, plutôt que les exemples « 13 indicateurs » et « J+7 ».
- La navigation conserve Productions ; les cartes gardent leurs sélecteurs PRA,
  sources, qualité, données absentes, légendes et traçabilité. Leurs figures sont
  donc plus hautes que le simple emplacement illustratif de la maquette.
- Les éditions, sélecteurs de date, sources et rubriques réelles restent présents.
- Le texte secondaire utilise `#596e82` pour un contraste suffisant sur le fond
  clair ; plusieurs gris de la maquette ne respectaient pas le contraste AA.

Les palettes scientifiques et leurs classes ne sont pas remplacées par la palette
de marque. Aucun workflow ou contenu scientifique n’est modifié. `/` sert le
Journal directement, sans montage préalable de l’explorateur ni redirection.
