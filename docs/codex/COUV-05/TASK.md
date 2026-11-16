# COUV-05 — Masques spatiaux exhaustifs des prévisions

Base obligatoire : main contenant le merge de #96 (commit `874e561ce77421fec34244e676b7dec466e51257`).

## Contrat

COUV-04 reste le **seul** moteur de rendu : ≥90 % de support qualifié = PRA entière colorée ; moins de 90 % = seule la géométrie prouvée colorée ; aucune valeur exploitable ou aucune preuve = gris ; **713 contours, dont les six corses, toujours visibles**.

Ne jamais déduire une géométrie à partir d'une valeur agrégée ou d'une fraction numérique, ni substituer une carte terre/mer à la validité variable/date. Les données SAFRAN/SIM ne sont pas prévisionnelles. Pour une recette multi-variable/multi-jours, prendre l'intersection géométrique des cellules natives communes, jamais l'union ni le minimum de fractions.

## Travaux et critères finaux

1. Contrôler les sources AROME, ARPEGE, IFS, grilles, cycles, échéances, variables et identité des cellules natives.
2. Capturer et persister les seuls supports natifs réellement valides avec provenance et contrôle d'intégrité.
3. Qualifier pour les 713 PRA chaque source × cycle × date × variable ; distinguer **demonstrated / partial / unknown / absent**.
4. Relier les géométries qualifiées au support_id exact des résultats (et des recettes AGRO-03), avec sélection de support stricte et références temporelles compatibles.
5. Brancher le seul moteur COUV-04, jamais une seconde logique de seuil/peinture.
6. Contrôler toutes les cartes climat, agroclimat, cartes du jour, previews, miniatures et Journal, sans modifier les éditions archivées.
7. Obtenir une matrice source/variable/jour/indicateur et captures avant/après réelles : desktop, tablette, mobile, littoraux, îles, cas <90 %, zéro donnée, support inconnu.
8. Mesurer temps, RAM, taille et coûts des supports, contrôle budgétaire et rollback.
9. Pas de fusion, publication, changement de flag, nouveau cron ni exécution du workflow distant sans validation explicite.

## Situation après COUV-05B

La preuve native réelle du cycle étudié est constituée sur 49 910 combinaisons. Les 28 recettes sont examinées spatialement sur 758 632 lignes, avec supports inconnus explicitement conservés. Le lecteur météo candidat est inactif par défaut. La recommandation demeure PARTIAL / NO-GO pour activation ; voir README, VALIDATION et COSTS-LIMITS pour les résultats et blocages restants.
