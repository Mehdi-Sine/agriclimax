# Bovins — THI synthétique territorial

Formule et seuil initial 72 de `config/cattle/thi-v1.json` conservés. Le calcul réutilise `features/cattle/thi.ts`, déjà comparé au moteur Python sur les cas partagés. Trois vues : maximum des synthèses journalières de la période, nombre de jours THI > seuil, séquence maximale au-dessus du seuil ; fréquence des épisodes disponible pour les fenêtres complètes. Ce n'est ni un maximum horaire, ni une mesure d'heures d'exposition.

La disponibilité des trois vues THI est identique car elles exigent les mêmes paires température/humidité :

| Journée UTC | PRA avec paire exploitable | Autres PRA (THI NULL) |
|---|---:|---:|
| 6 novembre, estimation récente | 178 | 535 |
| 7 novembre, prévision | 216 | 497 |
| 8 novembre | 601 | 112 |
| 9 novembre | 592 | 121 |
| 10 novembre | 456 | 257 |
| 11 novembre | 556 | 157 |
| 12 novembre | 499 | 214 |
| 13 novembre | 478 | 235 |

Historique 25–31 octobre : zéro THI calculable, car le contrat historique ne comporte pas l'humidité. Les 645 supports avec température et les 68 autres restent explicitement qualifiés, jamais complétés par une humidité supposée. Sur 7–13 novembre, les changements de source/run interdisent un agrégat complet pour les 713 PRA ; les journées valides restent consultables.

La vue indépendante « Jours de chaleur météorologique » dispose de 645 PRA historiques et 713 par journée prévisionnelle. Ce n'est pas un substitut au THI. Une PRA sans THI reste sélectionnable et le contexte de présence d'animaux n'est jamais inféré du RPG ou de la couverture météo.

Référence existante Bohmanova et al. (2005), seuil assumé dans l'étude sur Holstein américaines, exploratoire ici. Comparaison Institut de l'Élevage non achevée : site renvoyant un écran de vérification de connexion. Aucun changement silencieux de seuil. Les races, âge, production, bâtiments, ventilation, rayonnement, eau et microclimat limitent l'interprétation. Aucun diagnostic zootechnique, clinique ou de bien-être animal.
