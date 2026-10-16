# Pipeline quotidien AgriclimaX

`daily-live.yml` orchestre DPClim v1 → validation → persistance station/jour →
blé → THI bovins quotidien → publication atomique. Stations MVP uniquement ; pas
d'interpolation, pas de nouvelle règle, pas de calcul de risque. Les résultats
conservent provenance, version, fraîcheur et quality_flags. Les anomalies sans
référence homologuée et la récupération nocturne sans données horaires restent
explicitement indisponibles. Aucun baseline ERA5 n'est recalculé quotidiennement.

## Activation après merge

Appliquer la migration `20261016095414_daily_pipeline.sql` via le processus de
migration habituel, puis renseigner les secrets GitHub Actions :
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
`METEOFRANCE_CLIMATOLOGY_API_KEY`. Les variables de cet environnement Codex ne
configurent pas les secrets GitHub. La clé serveur reste dans l'étape live.
Activer la variable de dépôt `AGRICLIMAX_DAILY_ENABLED=true` après un premier
lancement manuel vérifié. Le cron s'exécute depuis la branche par défaut à
07:40 UTC (08:40 Paris en hiver, 09:40 en été), sous réserve des délais GitHub.

La fenêtre automatique couvre les sept jours UTC terminés précédents pour les
corrections tardives. Le lancement manuel accepte `from` et `to` ensemble, ISO
YYYY-MM-DD, au maximum sept jours, jamais aujourd'hui. Exemple local :

```sh
PYTHONPATH=engine/src python scripts/daily_live.py --from 2026-10-08 --to 2026-10-14
```

L'ancien workflow Météo-France reste manuel pour les archives/observations horaires ;
son cron est remplacé. Le groupe concurrency partagé sérialise ces deux workflows,
sans annuler un run actif. GitHub peut remplacer un run en attente par un autre :
les fenêtres manuelles perdues doivent être relancées. Les backfills externes
restent soumis aux RPC atomiques et à leur protection anti-effacement.

## Contrôles et conservation

Toutes les journées et stations sont validées avant la première écriture : TM,
TN, TX, UM et RR doivent être utilisables. Une absence source ne remplace jamais
la dernière donnée valide. Les champs facultatifs peuvent manquer ; le RPC station
existant refuse toute régression de complétude. Une erreur ultérieure peut laisser
des observations déjà persistées : elles sont idempotentes et rejouables. Aucun
nouveau snapshot n'est publié avant le succès des deux calculs. L'instantané et
les portfolios blé sont enregistrés dans une seule transaction. Les instantanés
bovins restent privés ; cette tâche ne modifie pas le chemin de lecture de l'UI.

`agriclimax_private.daily_snapshots` conserve les publications réussies, sans
UPDATE/DELETE autorisés au service. La dernière publication se lit par
`window_end DESC, computed_at DESC` ; une reprise historique ne la remplace pas.
La clé sémantique ignore uniquement les horodatages de récupération et calcul :
source corrigée, configuration, règle, fraîcheur ou fenêtre différente donnent
une nouvelle révision. Les métadonnées de la première publication restent conservées.

Le client source fait trois tentatives pour les erreurs transitoires (30 s par
requête), avec backoff et polling bornés. La publication fait trois tentatives
sur erreurs réseau/408/429/5xx, à 1 puis 2 s, timeout RPC 60 s. Les erreurs
d'authentification/validation ne sont pas retentées. Un échec de persistance
station arrête le run et se reprend avec la même fenêtre. Limites : processus
24 minutes (TERM, puis KILL après 10 s), étape 25 minutes, job 30 minutes.

## Échec et point de reprise

Consulter l'artifact `daily-live-<run_id>-<attempt>`, conservé 30 jours :
`logs/run.json` contient les dates, le dernier stage et `failed_stage` ;
`logs/console.log` contient les étapes. Aucun texte d'exception, header, URL
serveur ou réponse HTTP brute n'est journalisé. Les sources brutes ne sont ni
uploadées ni mises en cache Actions. En cas de timeout, le dernier stage enregistré
est le point de reprise ; le job est en échec même si le rapport est incomplet.

- Échec ingestion/validation : vérifier source et abonnements, relancer **la même
  fenêtre explicite**. Zéro écriture de ce lot avant validation complète.
- Échec persistance/calcul : relancer la même fenêtre. Les observations existantes
  sont conservées ; la dernière publication réussie reste consultable.
- Échec publication ou réponse réseau incertaine : télécharger `snapshot.json`,
  puis rejouer exactement le reçu, avec les credentials serveur :

```sh
PYTHONPATH=engine/src python scripts/daily_live.py --publish-receipt work/reprise/snapshot.json
```

Un reçu déjà accepté retourne sans duplication. Une nouvelle acquisition avec
les mêmes données ne duplique pas la publication. Vérifier la réussite du job,
`successful=true`, et le snapshot privé avant de réactiver le cron. Une relance
sans dates change la fenêtre au passage du jour : privilégier les dates du rapport.
Pour arrêter le pipeline, désactiver `AGRICLIMAX_DAILY_ENABLED` ; ne supprimer
aucune donnée. Une correction de migration doit être forward-only.
