# Décision de livraison Task 28

PR draft unique : https://github.com/Mehdi-Sine/agriclimax/pull/56

L'implémentation locale sur données nationales réelles est réalisée : catalogue et contrat versionnés, moteur partagé, 13 indicateurs, carte et fiche nationales, contexte RPG existant, temporalités et URL, contours homogènes et ombre nationale. Tous les résultats restent scientifiques exploratoires, sans stade biologique, dommage ni diagnostic animal inféré.

| Verdict demandé | Décision | Motif |
|---|---|---|
| READY_FOR_WHEAT_V1 | NON ACCORDÉ | Calcul et API réels validés ; recette Preview protégée en attente |
| READY_FOR_CATTLE_THI_V1 | NON ACCORDÉ | Calcul et refus RH validés localement ; Preview et comparaison Institut de l'Élevage non achevées |
| READY_FOR_AGROCLIMATIC_UX | NON ACCORDÉ | Trois formats locaux validés ; Preview en attente |
| READY_FOR_NATIONAL_MAP_VISUAL_REVIEW | NON ACCORDÉ | Contours/ombre/captures locales validés ; revue Preview non effectuée |

Les couvertures sont décrites par règle et journée dans `evidence/coverage.json`. Repères : blé historique 645/713 sur 25–31 octobre ; chaque journée blé J+1..J+7 713/713 ; THI prévisionnel 216 à 601/713 selon la journée. Le THI historique est indisponible faute de RH. Les cumuls de semaine multi-sources/runs sont refusés, même lorsqu'une valeur quotidienne existe partout. Aucun signal climatique n'est qualifié de risque de dommage.

La comparaison Python indépendante et les tests n'exonèrent pas de la validation Preview exigée par la Task. La revue automatique a rejeté la passerelle utilisant le secret de protection sans accord explicite ; ce blocage reste une limite extérieure documentée. Aucune fusion, production, infrastructure payante, réingestion ou modification de l'automatisation n'a été effectuée.

Travaux précis restants : autoriser et terminer la recette Preview du dernier commit ; consulter et comparer les références Institut de l'Élevage ; suivre les lacunes RH existantes sans inventer de données ; valider scientifiquement les paramètres par population/stade avant toute lecture de sensibilité ou de dommage. Une agrégation prévisionnelle multi-modèles nécessiterait une règle scientifique et un contrat de compatibilité explicitement validés : cette V1 ne la simule pas. Le contexte bovin local ne comporte pas de cheptel PRA inféré ; toute future source cheptel doit garder son échelle officielle.

Les métriques, captures et commandes de reprise sont conservées dans ce dossier. Les sources immuables existantes permettent la reprise sans nouvelle acquisition.
