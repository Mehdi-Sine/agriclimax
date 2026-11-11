# INT-01 — Dépendances et ordre d’intégration

**PARTIAL, PR draft. Aucune fusion automatique.**

| Travail | État vérifié | Traitement INT-01 |
|---|---|---|
| #80 AGRO-UX-01 | Fusionnée, `4c538492` | Base obligatoire. Interface, navigation, géométries, légendes et moteurs conservés. Aucun redesign, aucun changement CSS. |
| #76 AGRO-02 / #78 OPS-03 / #79 OPS-04 | Déjà dans main | Registre, qualification CORE-01, calculs multi-productions, lectures Storage et reprise réutilisés. Les 40 cartes de dry-run ne sont pas promues. |
| #81 MF-01 | Ouverte, draft, `8c0841658d00f921f4bab44e952d2283fecabf2b` | Auditée, non intégrée et non modifiée. INT-01 fonctionne avec les entrées déjà gelées. Nécessaire à étudier pour la fiabilité et la fraîcheur quotidiennes. |
| #63 COUV-01 | Ouverte, draft, `ec7927d794d1f4986bc4ab1d6df39094834e6a1f` | Aucune reprise. Les réserves scientifiques sur SAFRAN/SIM, journées 06UTC, masques et continuité restent bloquantes pour sa qualification nationale. |
| #77 UX-01 | Absorbée par #80 | Ne pas fusionner séparément. |

## Compatibilité MF-01 après #80

Inspection du diff complet, des preuves de #81 et simulation dans le worktree isolé
`work/int-01/mf01-integration-test` : départ `origin/pr-81`, puis
`git merge --no-commit --no-ff origin/main`. Fusion textuelle sans conflit,
incluant le contrôle navigateur #80 dans `quality.yml`. Aucun commit de #81
cherry-pické dans INT-01 ; aucun push ni rebase de la branche MF-01 existante.

Sur cet arbre combiné : **96 tests Python** station-auth/daily-reliability/MF-01/daily
et **12 tests T36**, puis **trois tests qualité Météo-France** réussis. C’est une
validation ciblée de compatibilité ; cela ne
remplace pas la CI complète et la recette réelle de la future branche MF-01 actualisée.
Les tests complets INT-01 portent sur main + INT-01, indépendamment de #81.

Pour actualiser #81 après revue humaine, conserver ses commits puis intégrer main
sur sa propre branche de travail, relancer CI et recette nationale isolée. Ne pas
copier sa recette fraîche dans le snapshot immuable du 11 novembre.

## Responsabilités

- Acquisition et choix des cycles : moteur Python, propriétaire T36/OPS-03/MF-01.
- Science et couverture : registres AGRO/CORE-01 existants, inchangés.
- Publication des textes : RPC et revue T36 existantes, inchangées.
- INT-01 : fabrication déterministe du complément à partir des entrées gelées,
  persistance immuable préparée, lecture commune et raccordement aux composants #80.
- Qualification : revue explicite du lot exact, distincte de la revue de l’article.

`edition-maps-1` est une enveloppe d’application autour des résultats existants,
pas une nouvelle règle scientifique. Aucun fichier `contracts/`, seuil, palette,
migration déjà appliquée ou contrôle d’abonnement n’est modifié.

## Ordre recommandé

1. #80 déjà acquise ; examiner et intégrer INT-01 après la recette des cartes candidates.
2. Examiner puis actualiser/intégrer #81 séparément pour fiabiliser l’alimentation.
   INT-01 peut être testée et déployée avant #81 ; aucune carte ne sera publiée par le déploiement.
3. Acquérir/persister un cycle récent ; vérifier les dates réelles ; préparer une nouvelle
   révision si les entrées diffèrent, en conservant toutes les anciennes éditions.
4. Revoir et publier séparément le lot cartographique exact ; revue éditoriale puis
   promotion du texte selon le circuit existant si une publication certifiée est souhaitée.
5. #63 seulement après qualification scientifique indépendante. Ne pas l’utiliser pour
   rendre artificiellement complète une couverture manquante.

Le déploiement de code, la publication des cartes et la certification éditoriale
restent trois opérations distinctes. Le retour arrière code conserve les objets
immuables et les archives, voir [RELEASE.md](RELEASE.md).
