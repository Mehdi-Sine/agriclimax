# Recette scientifique, technique et bilan des ressources

## Archives réelles et calcul indépendant

Le rejeu lit les archives déjà présentes dans Storage et la série historique héritée. Trois fenêtres testées couvrent les 24–30 octobre, 10–16 novembre et 1ᵉʳ–30 octobre 2026. Le calcul de référence indépendant relit les lignes météorologiques natives et applique séparément les formules sur les PRA complètes. **19 350 comparaisons** sur dix indicateurs, dont les abstentions de SDII sur support complet sans jour humide, concordent avec la réponse applicative à moins de 10⁻⁹ dans l’unité du calcul.

| Période | PRA entières | Portions qualifiées | Absences |
| --- | ---: | ---: | --- |
| 24–30 octobre, neuf indicateurs | 645 | 67 | Crozon |
| 24–30 octobre, pluie moyenne des jours humides | 598 | 55 | Crozon et 59 supports complets ou partiels dépourvus de jour humide |
| 10–16 novembre, dix indicateurs | 645 | 67 | Crozon |
| 1ᵉʳ–30 octobre, dix indicateurs | 645 | 0 | 68 abstentions. Les portions ne satisfont pas la qualification sur l’ensemble du mois hérité. |

Le [rapport de rejeu](evidence/rejeu.json) détaille Beauce, Charollais, Côtes du Bordelais, Comtat, Crozon, Littoral et Alpes niçoises, Maurienne, Littoral corse et Montagne corse. La fenêtre du 10–16 novembre donne par exemple une pluie moyenne des jours humides de 7,27 mm en Beauce et 14,00 mm dans les Alpes niçoises. Le Littoral niçois et le Littoral corse affichent respectivement 13,80 et 12,40 mm/j humide sur portion. La série de novembre donne zéro pour les vues de Tmin > 20 °C et de Tmax < 0 °C. Les archives inspectées n’offrent ni été ni hiver complet. Un test **synthétique** exerce ces deux phénomènes avec des valeurs non nulles et les seuils stricts à 20 °C et 0 °C. Il couvre également 0,99 et 1 mm, 10 mm, pluie négative, jours manquants, support partiel et rupture de support.

Le navigateur vérifie les deux dispositions à 1440 et 390 px, les filtres de filière, les unités, la synthèse accessible et la sélection de Crozon. Le compte du rendu est vérifié à partir du calque de contours. Le rendu conserve 681 contours entièrement colorés selon la règle visuelle, 31 colorés sur leur portion vérifiée et Crozon grisée. Les effectifs éditoriaux restent distincts des classes de rendu. [Rapport et captures](evidence/browser)

## Contrôles du dépôt

- Vitest, 849 tests réussis et 16 ignorés par la configuration sans accès courant aux services. Lint et vérification TypeScript réussis.
- Python, 536 tests réussis au premier passage. Les deux tests d’échange HTTP local ont réussi après exécution avec le réseau local autorisé, soit 538 tests vérifiés.
- Les contrats et les gardes de sources, migrations et automatisation ont été exécutés. Les 15 synthèses historiques AGRO-05 et les 10 nouveaux exports AGRO-06 valident le même contrat d’export versionné.
- Le build de production réussit. Turbopack signale l’accès fichier dynamique existant du module d’archives éditoriales. Aucun fichier AGRO-06 ne figure dans les traces des fonctions du build.

## Ressources supplémentaires

| Mesure | Rejeu local |
| --- | --- |
| Écritures ou stockage persistant ajouté | **0** octet dans Supabase. Les résultats dérivent des archives existantes en lecture seule. |
| Sources et planification | Mêmes blobs météo, masques et fond officiel. Aucune copie d’archive ou de forme géographique dans cette livraison. Aucun nouveau workflow. |
| Lectures des masques et de leurs géométries | **144 → 15** téléchargements sur le même rejeu, **5 758 294 → 1 165 855** octets annoncés. La borne du cache est 32 documents de support et deux entrées de géométrie par processus. Les promesses partagées dédupliquent les accès concurrents. Les fichiers sont adressés par SHA-256. |
| Autres lectures Storage | 23 lectures d’entrées ERA5, une lecture du catalogue, une du manifeste courant. Le rejeu inclut les lectures de l’oracle indépendant et les fenêtres précédentes des comparaisons éditoriales. |
| Transfert Storage total annoncé | **11 476 416 → 6 883 977 octets** avec le cache. Deux réponses ne déclaraient pas leur longueur. Comparaison locale, sur un seul processus. |
| Calcul national de la règle seule | 29–299 ms, toutes fenêtres. Lecture et qualification de l’API complète dans le rejeu de 43 à 4 786 ms. Export de la synthèse sur cache chaud de 7 à 231 ms. |
| Carte, corps JSON calculé | 2,17–4,03 Mo avant compression, 161–370 ko en gzip local. |
| Synthèse manuelle seule | 5,7–26,4 ko avant compression, 1,8–5,4 ko en gzip local. Les références et les exemples sélectionnés entrent dans ce volume. |
| Coût OpenAI | Zéro appel. |

Les volumes gzip proviennent d’une compression locale du JSON, les octets Storage des en-têtes HTTP. Les temps incluent l’environnement du rejeu et varient avec l’accès aux archives. Le cache est local à chaque instance. Ces mesures ne quantifient pas un transfert facturé ou un temps serveur Vercel en production.

## Reproduction

```sh
PRA_NATIONAL_ENABLED=1 NODE_OPTIONS=--conditions=react-server \
  apps/web/node_modules/.bin/tsx scripts/agro06_replay.ts
```

Pour le test navigateur, démarrer `pnpm dev` avec `PRA_NATIONAL_ENABLED=1` et les accès serveur habituels, puis lancer `node tests/e2e/agro06.mjs` avec `AGRO06_ORIGIN` pointant vers ce serveur. Le script de préparation du dépôt fournit les géométries et les actifs cartographiques. Les preuves de rejeu restent dans la documentation et ne sont pas embarquées dans Vercel.
