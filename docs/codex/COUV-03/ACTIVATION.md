# Activation et retour arrière

## État livré

Aucun déclenchement, déploiement, paramètre de production, écriture Storage/DB ou
publication. `AGRICLIMAX_SIM_CANDIDATE_ENABLED` n'est ni créé ni activé à distance par
cette tâche. La condition du workflow exige
la chaîne exacte `true` ; absence et `false` désactivent la collecte. Le lecteur
`complement_window(..., enabled=False)` est également désactivé par défaut.

Le Journal ne lit pas le stockage candidat. Ses mécanismes OPS-07, son secours
factuel, ses sources, son moteur EDIT-04 et ses archives sont inchangés. Le job
éditorial dépend toujours uniquement du plan, pas du succès de la collecte ERA/SIM.

## Canari préparé, à ne pas activer avant revue

1. Revoir et fusionner manuellement cette PR seulement après validation des
   résultats. La fusion n'est pas réalisée par cette tâche.
2. Pour un **canari sans publication** dans le cycle existant, définir la variable
   de dépôt `AGRICLIMAX_SIM_CANDIDATE_ENABLED=true`. Aucun nouveau workflow, cron ou
   source dans le registre OPS ; aucune modification des variables IA/publication.
   Le prochain job ERA normal exécute l'étape SIM indépendante. Ne pas déclencher
   le workflow pendant cette qualification.
3. Vérifier l'artifact `t36-era5-checkpoints/sim-candidate/` : index, empreintes,
   dates réelles, rapport, absence d'écritures distantes et 32 PRA autorisées.
   L'étape est limitée à deux minutes, l'acquisition/calcul à 115 secondes.
   Une erreur est non bloquante. L'export ERA est testé avec une erreur SIM.
4. Observer **au moins sept mises à jour quotidiennes distinctes** : retard au
   créneau réel, arrivée du dernier jour, révisions, coût, reprise du checkpoint,
   indisponibilité du Parquet et absence d'impact Journal. Sept dates contenues
   dans un seul fichier ne satisfont pas ce critère de fiabilité.
5. Conserver une période explicite, un support stable et une source par fenêtre.
   Ne pas faire passer J−2 pour J−1 ; ne jamais recopier la dernière valeur.
   Au créneau matinal, accepter les dates anciennes réellement disponibles, avec
   fraîcheur affichée, ou rester indisponible. Pas de tentative réseau répétée
   après un échec dans cette étape.

## Avant une activation publique réelle

Le flag précédent **ne publie aucune carte**. Il ne suffit pas pour activer la
source dans le Journal. Les étapes suivantes restent bloquantes :

- Démontrer la fiabilité sur plusieurs cycles indépendants et assurer la reprise
  après une interruption dépassant la rétention Actions de trois jours. Le store
  local gère 730 jours ; le transport Actions n'en garantit pas la conservation
  durable en cas d'arrêt prolongé. Réutiliser le stockage privé existant dans un
  préfixe candidat distinct si la conservation durable est retenue, après recette
  d'un transport dédié, sans modifier le catalogue des archives publiées.
- Faire valider les conventions de journées, le datum et les limites littorales.
  Pour des cartes descriptives, rendre source/période/support/fraîcheur explicites
  par PRA avec les composants de qualité existants. Ne pas modifier les légendes
  scientifiques pour faire passer une moyenne d'extrema horaires pour un extrême.
- Qualifier séparément les règles du catalogue et leur compatibilité de référence.
  Tant que cela manque, conserver `indicator_eligible=false` et
  `journal_eligible=false`. Pas de GDD/THI/gel/séquence/anomalie hybride.
- Rejouer le catalogue EDIT-03/04 et les contrôles OPS-07 sur une future intégration
  explicite des cartes admissibles, sans changer les prompts ou la sélection IA.

**Décision de cette PR : PARTIAL ; pas de GO pour la publication en production.**
La collecte de canari est concrètement raccordée et réversible ; les conditions
ci-dessus ne sont pas prétendues résolues par un simple interrupteur.

## Retour arrière

1. Définir `AGRICLIMAX_SIM_CANDIDATE_ENABLED=false` ou supprimer la variable : les
   prochains cycles n'acquièrent plus SIM. Les jobs déjà commencés restent bornés.
2. Désactiver le lecteur candidat (`enabled=False`) si un consommateur de recette
   l'utilise. ERA reste prioritaire et toutes les données publiées restent en place.
3. Pour un diagnostic local, restaurer une copie de l'index candidat vérifiée avec
   ses blobs depuis l'artifact précédent. Ne pas pointer vers un blob absent ;
   `complement_window` renvoie indisponible si la vérification échoue.
4. Conserver les reçus ; ne supprimer ni catalogue Storage existant, ni archives,
   ni éditions du Journal. Aucune migration inverse ou réédition n'est nécessaire.

## Reproduction hors production

```sh
python -m venv work/couv03/venv
work/couv03/venv/bin/pip install -r engine/requirements-dev.lock -r engine/requirements-geo.lock -r engine/requirements-safran.lock -e engine
# Données gelées, aucun réseau ni secret nécessaire :
PYTHONPATH=engine/src:scripts work/couv03/venv/bin/python scripts/couv03_qualification.py --output work/couv03/replay
# Nouvelle qualification autorisée manuellement, n'écrit qu'en local :
PYTHONPATH=engine/src:scripts work/couv03/venv/bin/python scripts/couv03_collect.py --root work/couv03/new-candidate
```

La nouvelle collecte utilise les sept dernières dates demandées jusqu'à J−1,
et signale celles que le fournisseur ne contient pas. Utiliser `--from/--to`
pour une fenêtre explicite de sept jours maximum. `--source-root` permet un
rejeu d'une acquisition existante vérifiée. `--national` est réservé au diagnostic
ponctuel et exige un répertoire séparé de la collecte opérationnelle ciblée.
