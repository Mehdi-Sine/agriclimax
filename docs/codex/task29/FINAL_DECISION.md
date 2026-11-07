# Décision Task 29

## Périmètre et état

Les supports natifs du 2 au 31 octobre 2026 sont restaurés. La règle `agroclimatic-1.2.0` conserve les versions 1.0.0 et 1.1.0 et leurs résultats. Les contrôles scientifiques et la recette locale sont validés ; la recette Preview du dernier commit et ses checks GitHub restent à consigner avant verdict final.

| Famille — mêmes effectifs sur 1, 7 et 30 jours | PRA complètes | Qualifiées ≥90 % | Portions seulement | Complément distinct | Indisponibles |
|---|---:|---:|---:|---:|---:|
| Tmoy, degrés-jours, précipitations | 645 | 36 | 31 | 1 | 0 |
| Chaleur, gel, pluie forte, sécheresse et séquences, chaleur bovine | 645 | 0 | 67 | 0 | 1 |
| THI, jours THI, séquences THI | 0 | 0 | 0 | 0 | 713 |

La matrice nominative comprend 29 946 lignes : `evidence/availability-by-pra.csv`. Les indisponibilités sont également isolées dans `evidence/unavailable-by-pra.csv`. Le THI manque d'humidité historique : aucune formule ni aucun seuil THI n'a été modifié. Les extrema littoraux sont des extrema des cellules natives disponibles, limités à ce support ; ils ne sont pas extrapolés à la PRA entière.

## Contrôles

Le contrôle national en lecture seule porte sur 42 combinaisons (14 lectures × 3 périodes), 713 identités et 2 856 comparaisons indépendantes des PRA affectées. Les supports des quatre variables sont vérifiés sur chaque journée et chaque période. Les anciennes règles sont testées séparément. Aucun des 130 anciens cas nationaux non affectés n'a été relancé.

La recette locale réelle comporte 77 cas desktop, tablette et mobile, sans erreur JavaScript : API, carte, fiche, contours officiels, PRA complète, ≥90 %, <90 %, Crozon, 1/7/30 jours et lectures Climat/Analyse. Captures et reçu dans `evidence/local/`. Les tests TypeScript comptent 295 tests passants sur 34 fichiers ; lint, types et build passent. Les tests Python ciblés et le typage strict des nouveaux traitements passent.

## Crozon et limites scientifiques

La valeur native de Crozon reste NULL, avec couverture native nulle et carte grisée. Un complément distinct est proposé uniquement pour Tmoy, degrés-jours et pluie : quatre voisins terrestres, pondération inverse du carré de la distance, rayon 25 km, puis poids PRA originaux. La validation spatiale bloque toutes les cellules de la PRA de référence ; neuf PRA, 270 PRA-jours par variable, avec vérification séparée des 17 nouvelles journées. Les critères fixés avant évaluation sont satisfaits. Le domaine d'extrapolation est borné par les témoins validés.

Ce résultat constitue une reconstruction de champ, pas une validation par station ni une mesure du microclimat de Crozon. Les erreurs corrélées et l'extrapolation littorale restent des limites explicites. Aucun extrema, événement, THI, normale ou anomalie hybride n'est fabriqué. Comparaison SAFRAN et critères : `COMPLEMENT_COMPARISON.md` et `COMPLEMENT_METHOD_PLAN.md`.

## Acquisition et exploitation

Les checkpoints existants ont été récupérés en priorité. Les journées 2–18 octobre manquantes ont été récupérées sur les seules emprises ciblées avec le fournisseur et les caches existants : 55 appels logiques et 8 871 157 octets de corps reçus, trois étapes bornées, aucune écriture DB. Les polls et retries ne sont pas comptabilisés dans ce volume. La dernière étape réussie est le run 42366010270, artefact 13571358993, SHA256 ZIP `36e4ec3b550f65e9bdf3d81a5c7a352c984c336a7dd61afe32b9f1245a233c1e`.

Attention à la conservation : cet artefact expire le 14 novembre 2026 à 11:08:18 UTC ; les archives initiales expirent le 12 novembre. Les archives natives sont présentes dans le workspace et Actions, les restitutions et preuves sont versionnées. Ce n'est pas une sauvegarde native pérenne garantie.

L'archivage incrémental existant calcule les nouveaux supports disponibles ; le complément utilise un certificat scientifique gelé, sans réajustement quotidien. Aucun pipeline quotidien concurrent, aucune réingestion AROME/ARPEGE/IFS et aucune modification du workflow opérationnel. Le cron quotidien non encore observé reste hors de cette Task. PR #57 conservée en draft, aucun merge ni déploiement production. Aucun verdict global de couverture native 713/713.
