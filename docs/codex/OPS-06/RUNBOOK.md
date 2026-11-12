# Publication expérimentale quotidienne

`operational-journal.yml` conserve ses horaires, verrous persistants et contrôles.
Le stage `run` rend consultable le texte contrôlé et publie les cartes dérivées
exclusivement des entrées gelées. Aucun téléchargement fournisseur depuis ce stage.
Un rejet scientifique du texte produit une nouvelle archive déterministe de secours,
validée par le même validateur. La sortie IA et ses diagnostics restent conservés.
Les erreurs de fournisseur, contrat des entrées, checksum et stockage restent
bloquantes ; aucune relance payante automatique n'est ajoutée.

`manual-journal.yml`, mode `publish`, utilise le même parcours expérimental sans
revue humaine quotidienne ni activation du commutateur de certification.
`int01_maps.ts publish-experimental ID` recalcule depuis les entrées gelées,
vérifie les 713 identités, valeurs absentes, couverture et liens snapshot/édition,
puis inscrit un reçu explicitement automatique via le stockage immuable existant.
Un arrêt d'urgence bloque toujours les écritures. Une publication cartographique
existante est relue et conservée ; une différence reste bloquante.

Pour reprendre uniquement une publication/cartographie interrompue :

```sh
AGRICLIMAX_EDITION_DATE=YYYY-MM-DD pnpm editorial:nightly run
```

Un texte déjà consultable est réutilisé sans appel IA. Pour une nouvelle tentative
payante après rejet, l'autorisation exacte du snapshot reste nécessaire. Les
réserves s'affichent dans le Journal ; elles ne constituent pas une certification.
