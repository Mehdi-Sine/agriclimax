# Validation Climacta

Base synchronisée avant modification : `4892c1a` (main, PR #83 et #84).
PR de validation visuelle : https://github.com/Mehdi-Sine/agriclimax/pull/85

Preview contrôlée :
https://agriclimax-git-codex-climacta-journ-d50f65-mehdi-sines-projects.vercel.app/journal

## Périmètre

Nom public, métadonnées, manifest, SVG et documentation de marque : Climacta.
Identifiants techniques et préférences locales conservés. Aucun changement aux
workflows OPS-06, migrations, prompts, archives, règles, composants cartographiques,
palettes ou légendes. Le seul changement dans le rendu éditorial archivé est le
nom du pied de page. Tous les avertissements restent présents.

La lecture des archives utilise au plus six lecteurs concurrents, déduplique les
identifiants et partage uniquement la requête en cours. Chaque requête ultérieure
relit la publication ; aucun TTL ne retarde une nouvelle édition. Les contrôles
de contenu et de commit des cartes immuables précèdent toujours sa visibilité.
Le chargement initial affiche désormais la navigation Climacta.

## Vérifications

- Build de production et lint : réussis.
- Suite complète : 685 tests réussis, 8 ignorés. Les tests CLI nécessitent les
  sockets locales IPC de tsx ; suite exécutée hors du bac à sable réseau.
- Tests ciblés publication/chargement/cartographie : 34 réussis. Parallélisme
  borné, déduplication, requêtes simultanées, reprise après panne, blocage sur
  cartes absentes ou corrompues puis admission après commit vérifié.
- Première lecture en processus Node neuf sur cet environnement : environ
  4 966 ms avant, 1 934 ms après. Mesure ponctuelle, pas un engagement de latence.
- Entrée directe `/journal` sur la Preview : titre réel affiché en 3 936 ms
  desktop et 1 410 ms mobile lors de la recette ; état de préparation résolu.
- Navigation profonde vers une carte de prévision et date d'archive absente :
  vérifiées dans les deux formats. Aucun débordement horizontal de page.
- Édition, catalogue et dix réponses cartographiques comparés intégralement à
  la production : identiques. Chaque carte possède 713 identités PRA distinctes.
- Dix indicateurs ouverts sur desktop 1440×1000 et mobile 390×844. Bandeau
  expérimental, réserves scientifiques, légendes, périodes et provenance présents.
  Aucune erreur JavaScript ni requête OpenAI observée.

Édition réelle du **12 novembre 2026** :
`650ff674f40a90648b3e326b85c58e9bf7312e550c109e66ccea1e5a253597ee`.
Bundle : `71f9fa54c213f6d776a2ed23050d3c6b79ca9ca468459917387be564ecd08261`.

Cinq cartes de réanalyse du 30 octobre au 5 novembre et cinq cartes de prévision
du 13 au 14 novembre. Ces périodes propres sont conservées, sans substitution
de données actuelles ni nouvelle publication.

## Captures et reproduction

- [Journal desktop](evidence/journal-desktop.png)
- [Journal mobile](evidence/journal-mobile.png)
- [Cartes desktop](evidence/cartes-desktop.png)
- [Cartes mobile](evidence/cartes-mobile.png)
- [Rapport navigateur et identités des dix cartes](evidence/browser-report.json)

`tests/e2e/climacta.mjs` accepte `BASE_URL`, `REFERENCE_URL`, `EVIDENCE_DIR` et
`CHROMIUM_EXECUTABLE`. Il utilise le secret de bypass déjà configuré sans
l'inscrire dans les preuves. Les réponses de données ne sont jamais modifiées.

La PR reste en brouillon, sans fusion automatique, pour validation du propriétaire.
