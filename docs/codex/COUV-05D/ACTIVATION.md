# Flags et décision d'activation

Aucune activation de production dans COUV-05D. Pas d'activation AGRO-03, publication d'archive, changement de pointeur ou fusion automatique.

| Flag | Périmètre exact | Recette locale | Production dans cette tâche |
| --- | --- | --- | --- |
| `COUV05_CAPTURE_NATIVE_MASKS` | Capture native facultative du pipeline ; n'active pas le rendu | `true` uniquement dans le rejeu hors ligne, réseau interdit | Inchangée |
| `COUV05_RENDER_ENABLED` | Lecteurs de preuves prévisionnelles, API météo et agroclimat, pièces des aperçus d'édition | `true` puis `false` pour le retour arrière | Inchangée |
| `COUV05_INDEX_SHA256` | Index immuable lié à une archive numérique exacte ; aucune sélection implicite d'un autre cycle | `df8d1c4abc3a3427cee3df3daf200dc7058f408fa22be274bff84e476fbd9145` pour le 14 novembre ; `e1da3cfb5e17a85cd6193661ed01d119421796a34a664c79c98e167cdd935347` pour le 15 novembre | Inchangé |
| `NEXT_PUBLIC_COUV04_RENDER_ENABLED` | Moteur commun de présentation exhaustive ; flag de build client | `true` | Inchangé |
| `PRA_NATIONAL_ENABLED` | Disponibilité et données historiques nationales existantes, nécessaires aux parcours Explorer | `1` | Inchangé |
| `AGRICLIMAX_MAP_PREVIEW_ENABLED` | Lecture de bundles locaux candidats, visiblement non publiés | `true` | Inchangé |
| `AGRICLIMAX_MAP_PREVIEW_DIR` | Répertoire local des cartes et de l'édition de recette | `work/couv05d-preview` en chemin absolu | Inchangé |

Le pin sélectionne **une seule archive par processus** : l'index `df8d…9145` est lié à `ed93…a398`, l'index `e1da…5347` à `884d…c7fd`. Un cycle d'une autre archive reçoit un refus explicite ; aucune sélection de masque par simple proximité de date. Les tests passent d'un pin à l'autre uniquement dans le serveur local.

Les éditions publiées refusent volontairement les nouvelles pièces de rendu : `editionForecastRendering(map,'published')` retourne `undefined`. COUV-05D conserve cette protection. Un GO éventuel ne recolore donc pas rétroactivement le Journal ni ses miniatures publiées.

## Retour arrière

Remettre `COUV05_RENDER_ENABLED=false` et retirer éventuellement le pin ; aucune lecture des masques ne doit avoir lieu. Le flag de build COUV-04 reste indépendant. Arrêter séparément la capture facultative. Désactiver les flags de prévisualisation locale après recette. Conserver les objets, les preuves numériques et les archives ; aucune suppression ni migration inverse.

## Progression envisageable après levée des blocages du bilan

1. Recette d'un seul couple archive/index exact sur Explorer ; contrôler les 713 PRA, Corse incluse, et les trois états de peinture.
2. Contrôler le cycle suivant et la reprise après interruption avec conservation de l'index précédent. Même archive demandée = mêmes données, jamais un masque d'un autre cycle.
3. Ouvrir les aperçus non publiés Cartes du jour / Journal / miniatures. Les valeurs et hashes de l'édition doivent rester identiques.
4. Décider séparément de l'ouverture de nouveaux rendus publiés après revue. Les archives déjà publiées ne sont ni réécrites ni republiées.

Ce scénario est une proposition, pas une autorisation d'activation. Les deux fichiers Vercel bloquent le déploiement automatique de la branche COUV-05D.
