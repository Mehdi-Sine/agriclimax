# Audit d’intégration et stabilisation

État lu le 11 novembre 2026 ; base `origin/main` = `bd475ff9f169cdcc73a3f9325e19ab8119f8d34f`. Aucune dépendance à MF-01, aucune PR GitHub fusionnée. La branche d’intégration conserve les commits UX-01 par merge Git local ; ce n’est pas une fusion de la PR distante.

| Travaux | État vérifié | Réutilisation / décision |
|---|---|---|
| AGRO-02 #76, `codex/AGRO-02-multiproduction-indicators`, `e1f727e` | Fusionnée, merge `b61ce89` présent dans main | Moteur, catalogue, couverture, contributeurs et preuves réutilisés sans réécriture. |
| OPS-03 #78, `codex/ops-03-journal-recovery`, `c9d8271` | Fusionnée, merge `5d5e48` présent dans main | Lecteur d’archives et tri des révisions, reprise sans IA, garde-fous conservés. Aucune réapplication de la migration déjà appliquée. |
| OPS-04 #79 | Fusionnée, main `bd475ff` | Recalcul, captures, preview isolée, cartes et rejeu réutilisés. Les instructions de sa documentation indiquant « après fusion » sont historiques et devenues obsolètes ; le workflow est maintenant enregistré. |
| UX-01 #77, `codex/UX-01-product-redesign`, `0f4dccce` | Ouverte draft ; 6 commits / 21 fichiers propres | Six commits intégrés avec leur historique, merge local sans conflit avec main. Accueil Journal, cinq rubriques, archives, carrousel, productions, aide et style conservés. Corrections complémentaires limitées à la présentation. |
| COUV-01 #63, `codex/COUV-01-national-climate-foundation`, `ec7927d` | Ouverte draft ; fondation SAFRAN/SIM opt-in, NOT_READY national | Auditée sans l’intégrer. Aucun nouveau fournisseur ni remplacement ERA5/SIM. 675 supports SIM complets et 38 partiels ne signifient pas 713 PRA qualifiées. |
| CORE-01 #64, DATA-01 #65, AGRO-01 #62 | Présents dans l’ascendance de main | Contrat de couverture, historique, méthodes et géométries existants préservés. |
| Dépendances #70 et Playwright #46 | Ouvertes | Non reprises : elles changent le socle technique et doivent suivre une recette distincte. Aucun lockfile modifié ici. |

## Chevauchements et conflits

UX-01 touche `app/journal/page.tsx`, `features/editorial-ai/preview.tsx`, le workspace unifié et les styles. OPS-03 touche notamment la lecture et la qualification éditoriale ; OPS-04 branche la preview et les cartes locales. Le merge Git avec main est propre mais ne démontre pas la compatibilité fonctionnelle : les tests d’archives, de lecture expérimentale, de navigation et la preview réelle sont nécessaires.

Deux corrections fonctionnelles : les liens de cartes de preview restaient dirigés vers `/cartes-du-jour`, qui lit les archives de production ; ils restent désormais dans la preview. Les palettes des extensions GDD, chaleur >30 et fréquence de pluie sont rattachées à leur phénomène. Les libellés des productions viennent du catalogue AGRO-02. La recette a également révélé et corrigé une collision des zones CSS historiques avec le titre UX-01, le logo séparé sur deux lignes et la légende des cartes de test. Les 713 géométries et les moteurs sont inchangés.

COUV-01 ajoute 195 fichiers sur sa base ancienne. Intersection de chemins modifiés avec l’intégration UX : aucune. `git merge-tree --write-tree HEAD ec7927d` (avant compléments non commités) réussit sans conflit textuel. Aucun contenu COUV-01 n’a été ajouté à la branche. Son chevauchement est scientifique et opérationnel : restauration historique ERA déjà traitée dans DATA-01, fenêtres et archives désormais exploitées par OPS-03/04, et futur choix des sources/cartes. Ses extrema horaires SIM et journées de pluie 06 UTC ne remplacent pas les extrema ou journées ERA actuels. Son candidat IFS homogène ne qualifie pas automatiquement la surface terrestre ni l’humidité. Réexaminer les exports historiques et les responsabilités des scripts avant toute intégration, sans dupliquer les writers ou raccorder les séries.

Le pack HTML original / les captures source de la maquette validée ne sont pas versionnés dans les fichiers du dépôt ni dans le diff UX-01. La fidélité est fondée sur l’implémentation UX-01 conservée ; une comparaison à la référence originale et l’accord visuel restent à obtenir. Les captures de cette PR ne remplacent pas cette référence.

## Risques et statut

**PARTIAL** pour une mise en production. Le chemin d’intégration et la recette locale sont disponibles. Une CI verte ne qualifie ni une couverture nationale complète ni la validation agronomique. Restent : revue sémantique humaine de l’édition, comparaison visuelle à la référence, téléchargement/vérification du ZIP exact Actions, qualification côtière et support des 68 PRA historiques, humidité absente pour THI. Voir VALIDATION.md et INDICATORS.md. La page de cartes archivées n’invente pas les cartes manquantes et les images pré-rendues restent hors périmètre.

## Ordre de fusion recommandé (à décider humainement)

1. Conserver AGRO-02 → OPS-03 → OPS-04, déjà fusionnées ; aucune nouvelle migration ou activation nécessaire pour cette intégration.
2. Revoir UX-01 et cette PR comme un ensemble. Option recommandée : fusionner uniquement cette PR après recette et approbation, puisqu’elle contient déjà tous les commits #77 ; fermer ensuite #77 comme reprise, sans la refusionner. Alternative : fusionner #77 d’abord puis actualiser et retester cette PR. Ne pas effectuer les deux par squash indépendants sans vérifier les doublons.
3. Traiter COUV-01 séparément après qualification scientifique, revue des recouvrements DATA-01 et rebase sur le main du moment. L’UI n’en dépend pas. Aucune bascule source implicite lors de sa fusion.
4. Les mises à jour #70/#46 suivent leur analyse de sécurité et leur propre recette ; si elles passent avant, retester build, cartes et navigateur ici sur le nouveau main.

## Retour arrière

Avant toute fusion humaine : noter SHA main, SHA de déploiement et URL des éditions existantes. Cette PR ne modifie ni schéma ni données, donc aucun rollback SQL ni réécriture d’archives.

En cas de régression après fusion : redéployer le déploiement précédent, puis créer une branche de correction depuis main et un revert du commit de fusion de cette PR (`git revert -m 1 <merge_sha>`). Si fusion par squash, `git revert <squash_sha>`. Faire revoir la PR de retour arrière et rejouer accueil, archives, carte et routes historiques. Ne pas utiliser reset/force-push sur main. Si #77 a été fusionnée séparément, le revert de cette PR garde UX-01 : définir explicitement si le défaut exige aussi un revert UX distinct. Conserver les archives, checksums et contrôles de publication ; ne relancer ni IA ni publication pour corriger un problème d’interface.
