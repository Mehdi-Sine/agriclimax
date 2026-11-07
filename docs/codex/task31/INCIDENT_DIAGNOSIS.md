# Task 31 — diagnostic de l'incident

Analyse du 7 novembre 2026 ; heures ci-dessous en UTC. Périmètre : transports existants, checkpoints, quotas et supervision. Aucun changement des calculs, acquisitions scientifiques, références, migrations, UX ou historiques validés des Tasks 19–30.

## Références vérifiées

- [Exécution 42383862996](https://github.com/Mehdi-Sine/agriclimax/actions/runs/42383862996), événement `schedule`, commit `f7eebc5aefa06746c9dd572dd5b68565de47c443`, conclusion `failure`.
- API GitHub : `created_at = run_started_at = 2026-11-07T14:55:27Z`. Créneau déclaré : 08:20 UTC. Retard observé : **395 min 27 s** (6 h 35 min 27 s). Ce retard précède la création de l'exécution ; les métadonnées ne montrent pas d'attente du runner à ce stade.
- La [PR #58](https://github.com/Mehdi-Sine/agriclimax/pull/58) est fusionnée. Base Task 31 : `aa58b360844fa078e3205dacad06ebd3afb393d0`, `origin/main`.
- Aucun fichier Task 31 préexistant : la demande utilisateur est la spécification applicable ; `AGENTS.md` est lu.

## Météo nationale

Job `128436981702` : à 15:05:02, échec dans `wcs_models → model_day → native_field → DescribeCoverage`, pour ARPEGE/précipitation. Message : `WCS arpege/DescribeCoverage: HTTP network_unavailable, network_or_response_error`.

`network_unavailable` est une classification du transport local, pas un code HTTP renvoyé par Météo-France. Elle ne permet pas de distinguer DNS, connexion, TLS, timeout ou réponse interrompue. La cause réseau distante précise n'est donc **pas prouvée**. La requête n'avait aucune reprise. Les corps natifs et reçus acquis auparavant sont conservés, mais la restauration du workflow ne s'exécutait qu'avec `checkpoint_run_id`, jamais automatiquement sur `schedule`.

Correction : reprises bornées sur lectures transitoires, sans reprise 401/403 ; restauration automatique bornée ; conservation des checksums et horodatages ; isolation des indices/ranges IFS par cycle ; rapport d'échec conservé même avant validation. Les requêtes restent mutualisées, jamais multipliées par 713 PRA.

## ERA5-Land

Job `128439337405` : sortie 124 à 15:27:38, après la limite externe de 22 minutes. La pile est dans l'agrégation `run_batch`, précisément le `rglob` du contrôle de quota. Cela prouve que la phase source était passée ; cela ne mesure pas à lui seul la part du temps consommée par ce scan. Le code répétait un scan complet pour chaque nouvelle PRA. Export conservé : **628 fichiers, 3 217 185 octets**, sans suppression des originaux.

Job `128444862127`, reprise : démarrage de traitement à 15:28:14 ; publication à 15:28:50 ; durée mesurée **34,8095 s**. Journée **2026-11-01**, **713 lignes**, **0 requête source**, **0 octet source**, **0 nouveau groupe**, **0 nouvelle tuile**, **4 écritures Storage**. SHA-256 : `cbe85befe41c1c92750db41a7d7b65f00c056ad69171b5d5357cf6fd1ee18079`. La reprise native fonctionne ; réacquérir la journée serait injustifié.

Correction : suivi conservateur du quota pendant l'agrégation hors réseau, délai interne 21 minutes pour laisser exporter avant le timeout externe, journée de continuation explicitement verrouillée par `--resume`, sortie non nulle si le quota de groupes impose une continuation. La recherche de checkpoints privilégie désormais `resume-2`, `resume-1`, puis `archive` au sein de l'exécution précédente.

## Publication et workflow

Le job `weather-health` réussi attestait la validité d'une publication antérieure ; il n'annulait pas l'échec réel du workflow. Le nouveau rapport expose les deux verdicts indépendants. La fraîcheur météo utilise désormais l'heure du cycle, pas simplement l'heure récente de téléchargement.

Les lectures réelles Task 31 confirment le cycle publié du **7 novembre 00:00 UTC**, 713 PRA et 49 910 lignes source, ainsi que la journée ERA5 du 1er novembre. Voir `evidence/health-real.json`, `weather-replay-real.json` et `era5-replay-real.json`. Aucun téléchargement météorologique ni aucune écriture distante n'ont été effectués pour cette vérification.
