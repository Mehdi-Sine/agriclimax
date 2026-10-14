# Task 11 — exploitation et préparation d'activation

La fonctionnalité est validée. Cette reprise ne modifie que le workflow et la
documentation d'exploitation. Aucune règle scientifique, normalisation, migration,
table métier ou configuration `spatial_ref_sys` modifiée. Aucun backfill distant
supplémentaire, secret copié, activation du cron ou merge effectué.

## Fréquence et prérequis

Workflow `.github/workflows/meteofrance-ingestion.yml` : `40 7 * * *`, quotidien
à 07:40 UTC, soit **09:40 Europe/Paris en été, 08:40 en hiver**. GitHub peut retarder
ou perdre un déclenchement sous charge ; ce n'est pas une garantie d'heure exacte.
Le cron s'exécute sur la branche par défaut, après intégration du fichier sur main.
Il requiert `METEOFRANCE_LIVE_ENABLED` exactement égal à la chaîne `true`.
Le déclenchement manuel contourne ce seul verrou d'activation ; les secrets restent
obligatoires. Timeout 20 minutes, un groupe de concurrence, sans annulation d'un
run déjà engagé. La concurrence GitHub peut remplacer un run encore en attente :
ce n'est pas une file garantissant tous les backfills ; vérifier chaque exécution.

| Type / nom exact | Usage |
|---|---|
| Variable repo `METEOFRANCE_LIVE_ENABLED` | `true` autorise le job lors du cron ; absente/autre valeur = job skipped. |
| Secret repo `NEXT_PUBLIC_SUPABASE_URL` | URL HTTPS de la base cible DEV pour la persistance. Malgré son préfixe, le workflow le lit depuis `secrets`. |
| Secret repo `SUPABASE_SECRET_KEY` | Écriture serveur via les RPC d'ingestion ; jamais une clé publishable/anon. |
| Secret repo `METEOFRANCE_CLIMATOLOGY_API_KEY` | Auth DPClim/v1 : catalogue, commande et téléchargement quotidien. |
| Secret repo `METEOFRANCE_OBSERVATIONS_API_KEY` | Auth DPObs/v1 : catalogue et dernier échantillon horaire. |

`PYTHONPATH=engine/src` est fixé dans le workflow ; aucune variable GitHub à créer
pour ce paramètre. `DATE_FROM`/`DATE_TO` sont des inputs manuels, pas des secrets.
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` n'est pas nécessaire au job. Le job n'utilise
pas de GitHub Environment nommé : ses secrets doivent être disponibles au niveau
repo ou via une organisation autorisant ce repo, pas seulement dans un Environment.

## Inventaire distant du 14 octobre 2026

Les lectures des noms via `GET /repos/Mehdi-Sine/agriclimax/actions/secrets` et
`actions/variables` ont toutes deux répondu **403 Resource not accessible by
integration**. Leur présence, absence et, pour la variable, sa valeur sont donc
**non vérifiées**, pas déclarées manquantes. Aucun contenu de secret n'a été lu.
Les variables prêtes dans le cloud de travail ne prouvent pas la configuration
d'un runner GitHub Actions.

L'inventaire workflows accessible ne liste pas encore le workflow live ; main
ne contient pas ce fichier de la PR draft. Il n'est pas encore dispatchable par
son nom de fichier depuis GitHub. Les tests CI Quality/Security fonctionnent,
mais ne constituent pas une exécution authentifiée de l'ingestion live sur runner.

Pour lever l'incertitude : un accès GitHub de lecture **Secrets** et **Variables**
sur ce repo, ou une vérification par un administrateur dans Settings → Secrets
and variables → Actions. Aucun élargissement d'accès ni login interactif réalisé.
Il faut confirmer les quatre secrets ci-dessus et la variable d'activation ;
ne jamais publier leurs valeurs dans un commentaire, fichier ou capture.

## Échecs, reprise et logs

Contrôle préalable des quatre bindings : tout nom absent/vide est imprimé sans sa
valeur, exit 1, aucune API métier appelée. Une présence ne prouve pas l'autorisation
API ; 401/403 à l'acquisition restent fatals et nomment la clé/subscription requise.
Les échecs transitoires Météo-France ont trois essais maximum, backoff et polling
bornés ; une réponse source invalide n'est pas corrigée ou imputée.

Les erreurs par date et les pannes station font échouer le run après les autres
dates. Les absences fournisseur légitimes restent missing/partial. Pas de rollback
des dates déjà committées en cas d'échec ultérieur : la relance est idempotente.
Si l'étape archive échoue, l'étape récent n'est pas exécutée. Pas de
`continue-on-error`, ni de relance automatique GitHub ajoutée.

`set -euo pipefail` garantit que `tee` ne masque pas l'exit code de la CLI.
Logs console et fichiers `configuration.log`, `archive.log`, `recent.log` ; les
événements JSON gardent source/run/date, état, stage, type d'erreur, checksum,
couverture et flags, sans valeurs de secrets ou corps d'erreur upstream.
L'artefact `meteofrance-station-manifests` inclut logs et manifests, `if: always()`,
rétention 30 jours. Auth fatale avant génération de manifest : log disponible,
manifest éventuellement absent. Un runner brutalement arrêté peut ne pas uploader
d'artefact ; le journal Actions et la dernière transaction DB restent les repères.
Les sources brutes sont adressées par SHA-256 dans un cache distinct de la démo ;
le cache GitHub peut être évincé, il ne remplace pas un archivage durable garanti.

## Idempotence et absence de doublons

Preuves existantes : `replay.log` = trente partitions rejouées, toutes `changed=false`.
`supabase-verification.json` = 190 lots, zéro doublon, 1 125 valeurs disponibles.
Ce sont les contrôles réels du 14 octobre, pas un nouveau contrôle DB dans cette
reprise. La clé primaire `(station_id,source_id,valid_date)` empêche les doublons
de lots. La clé de contenu des reçus ignore `retrieved_at` ; les upserts atomiques
conservent les versions courantes et refusent une récupération plus ancienne.
Un lot archive plus incomplet n'efface pas une valeur connue.

Une source corrigée ou une provenance modifiée peut créer un nouveau reçu et
mettre à jour le même lot, sans doubler les observations. Le récent conserve le
dernier échantillon du jour, pas une série complète horaire. La concurrence protège
ce workflow ; un opérateur doit éviter des workers externes parallèles partageant
la même subscription Météo-France (budget environ 92 req/min par worker).

## Procédure d'activation après revue, sans merge par cette tâche

1. Confirmer les quatre secrets Actions et la cible DEV. Garder la variable
   d'activation absente ou `false` pendant la préparation.
2. Après intégration autorisée sur main par un responsable, ouvrir Actions →
   Météo-France live station ingestion → Run workflow. Laisser les dates vides
   pour recontrôler hier et les six jours précédents, puis le récent du jour UTC.
3. Vérifier job success, logs, manifests et lots réels. Relancer la même période
   pour confirmer les clés d'idempotence ; le récent peut évoluer entre les runs.
4. Configurer `METEOFRANCE_LIVE_ENABLED=true` seulement après ce smoke authentifié.
   Vérifier le premier run scheduled ; `false` suspend les prochains crons sans
   arrêter un run déjà actif. Le lancement manuel reste possible.

Après enregistrement du workflow sur main, commandes de relance :

```sh
gh workflow run meteofrance-ingestion.yml --ref main
gh workflow run meteofrance-ingestion.yml --ref main -f from=2026-09-01 -f to=2026-09-30
gh run list --workflow meteofrance-ingestion.yml --limit 10
gh run view RUN_ID --log-failed
gh run rerun RUN_ID --failed
```

Les deux dates sont requises ensemble et la plage est inclusive, au plus 366
dates passées. Un rerun réexécute le job : si les inputs sont vides, la CLI recalcule
la fenêtre d'après la date UTC du rerun. Pour reprendre **exactement** une ancienne
période après changement de jour, créer un dispatch avec dates explicites.
La relance avec dates archive lance aussi le récent du jour courant, conformément
au workflow. Permissions GitHub nécessaires pour dispatch/rerun : Actions write.

## Décision de disponibilité

Workflow préparé et contrôlé localement ; **configuration GitHub non attestée** à
cause de l'inventaire inaccessible. L'absence du workflow sur main est normale
avant merge et ne bloque pas en soi une mise en revue ; elle empêche seulement
un smoke `workflow_dispatch` distant à ce stade.
PR #27 conservée en draft : le critère « tout est prêt » n'est pas démontré.
Ni Ready for review, ni merge, ni activation forcée dans cette reprise.

Contrôles : actionlint 1.7.7, guard YAML/JSON, secret guard et tests exécutant les
vrais snippets shell avec bindings/CLI synthétiques isolés (`operations-tests.json`
et `tests/quality/test_meteofrance_operations.py`). Ils vérifient l'exit 1 si les
bindings manquent, l'absence de valeurs dans les logs, la préservation d'un exit
CLI non nul par tee et les arguments de plage manuelle. Aucune API ni DB appelée.

Références : [déclenchement manuel](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow),
[concurrence](https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency),
[événements / schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).
