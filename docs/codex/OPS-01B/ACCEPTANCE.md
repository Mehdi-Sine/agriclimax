# OPS-01B — Supervision selon le type d'exécution

Base `6a9c6f2` (PR #66 fusionnée). Le défaut OPS-01 imposait une acquisition au
contrôle manuel weather-health, puis ajoutait la série d'échecs antérieurs à ses
causes bloquantes. Aucune donnée ni règle scientifique n'est en cause dans ce défaut.

| Mode | Acquisitions attendues | Verdict et historique |
|---|---|---|
| health_only | Aucune, uniquement workflow_dispatch/weather-health | Santé des archives requise ; échecs historiques en warnings avec IDs, sans échec hérité |
| daily_pipeline | national-weather et era5-archive | Étape manquante/ignorée, panne non résolue, publication non saine ou retard >120 min restent bloquants |

Le YAML choisit explicitement health_only seulement pour le contrôle manuel dédié.
Tout schedule et daily-dev-check restent daily_pipeline. Le défaut du script reste
strict ; un mode inconnu est rejeté et health_only sur un schedule échoue. Une
acquisition inattendue en health_only n'est pas silencieusement ignorée.

Le contrôle `pra_weather_health.py` reste inchangé : fraîcheur, décodage/hash,
713 identités, continuité historique, cohérence du pointeur et budget Storage.
Un rapport absent ou non sain reste bloquant dans les deux modes. La vérification
indépendante DATA-01 reste dans le workflow ; ses échecs ne sont pas neutralisés.

## Reprises ERA5

Une continuation verte seule n'est plus une preuve de récupération. Les reçus des
tentatives doivent viser la même date et attester l'échec des tentatives précédentes
(pas un ancien reçu déjà publié restauré depuis un checkpoint) ; le reçu final doit attester publication,
relecture ou réparation vérifiée, 713 lignes restaurées et SHA256 valide ; cette
journée doit être couverte par l'état de santé sain. Un plan, une attente fournisseur,
une autre date ou un reçu absent ne suffit pas. Les deux continuations sont prises
en compte, avec leur chaîne d'échecs antérieurs.

Une reprise ainsi vérifiée produit `era5_recovered=true`, `pipeline_degraded=true`
et un avertissement explicite ; le verdict du superviseur peut réussir si aucune
autre cause n'est bloquante. Les résultats des jobs originaux sont conservés :
GitHub peut toujours afficher le run global en échec à cause du premier job échoué.
Le correctif ne réécrit aucun statut Actions. Une panne météo, une publication
invalide ou un retard anormal continue à faire échouer le verdict même après reprise.

Les avertissements sont distincts des causes dans JSON, résumé et annotations.
`notification_required` conserve son sens d'alerte bloquante ;
`warning_notification_required` signale séparément les avertissements.

## Échecs programmés récents — preuves nouvelles

`RUN_AUDIT.json` est une collecte bornée des métadonnées et annotations GitHub,
sans logs bruts ni secrets. Les horaires sont UTC.

- **#34 / 42508300423, manuel** : acquisition normalement ignorée, contrôle de
  santé réussi ; le verdict échoue à tort. Les logs du verdict sont accessibles.
- **#33 / 42494057685, 8 novembre** : lancement 15:17:33 pour 08:20, retard
  **417,55 min**. Météo nationale réussie. ERA5 échoue avec code **1**, reprise-1
  réussie. L'annotation du verdict confirme `workflow_stage_failed`,
  `schedule_delay_over_120_minutes`, `consecutive_workflow_failures`. Le contrôle
  de santé réussit. Le retard reste une cause bloquante après ce correctif,
  indépendamment de la qualification de la reprise.
- **#32 / 42383862996, 7 novembre** : lancement 14:55:27, retard **395,45 min**.
  Météo nationale échouée (code **1**), ERA5 échouée avec code **124**
  (timeout de commande), reprise-1 réussie. Le job health vert ne prouve pas un
  pipeline réussi. Météo et retard restent bloquants après ce correctif.

Limites : `gh run view --log-failed` retourne zéro octet pour ces deux schedules ;
la lecture directe des logs de jobs est refusée HTTP 403. Les annotations ne
permettent pas d'attribuer le code 1 à une clé fournisseur, ni le timeout à une
attente CDS plutôt qu'au calcul. Les reçus des reprises sont nécessaires pour
certifier leur récupération effective ; le succès du job seul ne la prouve pas.
Aucune panne fournisseur n'est inventée ni masquée. Pour lever cette limite,
un opérateur habilité peut lire les logs des étapes et les artefacts ERA5
initiaux/reprise du même run dans Actions, sans partager de clé.

## Validation

Les tests couvrent les modes, historiques, archives non saines/absentes,
acquisitions primaires ignorées, annulation/état inconnu, les deux reprises,
preuves de reprise invalides, retard malgré récupération et sorties CLI 0/1
avec avertissements séparés. CI Quality et Security complètes et contrôle manuel
de santé sur la branche : liens/résultats consignés dans la description de PR.
