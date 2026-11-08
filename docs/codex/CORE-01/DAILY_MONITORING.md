# Supervision préparée, sans activation

Commande locale/offline :

```bash
python scripts/core01_monitor.py docs/codex/CORE-01/evidence/validation.json --baseline docs/codex/CORE-01/evidence/validation.json
```

La comparaison associe usage, indicateur, nature et longueur de fenêtre ; elle
fonctionne donc entre deux dates/cycles distincts. Elle contrôle dénominateur
713, chute de supports complets/estimés/descriptifs, discontinuité calendaire et
régressions numériques. Sortie JSON légère : identité de cycle, date des preuves,
motifs et objectif éditorial 06:30 Europe/Paris. Code de sortie non nul en alerte.

Le runner opt-in CORE01_REAL vérifie les 713 identités, la continuité des périodes,
les sources/grilles/poids, les raisons d'indisponibilité et l'égalité carte/API du
Journal ; il enregistre les dates réellement accessibles et les fenêtres refusées.
Le runner CORE01_RUNTIME mesure séparément le coût d'une lecture froide, calculs,
rejeu mémoïsé et tailles de réponse. Aucun remplacement par fixture en cas d'échec.

À raccorder ultérieurement aux workflows existants : conserver un petit rapport
par cycle, comparer au précédent, alerter avant publication si archive journalière
absente, rupture de support ou chute d'éligibilité. Une réponse HTTP valide seule
ne prouve pas une acquisition complète. Les dénominateurs de publication restent
propres à chaque famille. La recette navigateur contrôle le nombre de géométries,
les parcours API et l'affichage ; elle reste séparée d'une supervision quotidienne.

Limites : aucune nouvelle tâche cron, aucun workflow quotidien activé ; ce script
n'est pas un service d'alertes en production. Le seuil de chute est conservateur
(toute baisse) ; les évolutions légitimes doivent être revues avant adoption d'une
nouvelle référence. Le protocole stationnel indépendant reste à établir.
