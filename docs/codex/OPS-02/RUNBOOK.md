# OPS-02 — exploitation quotidienne

Responsabilités : GitHub exécute les cinq acquisitions et les moteurs T33–T36 ;
Supabase décide des admissions, conserve les archives et réveille le même workflow ;
Vercel ne fait que lire le Journal. Aucune méthode scientifique modifiée.

## Horaires et identité

Europe/Paris : acquire 02:15/02:45/03:15/03:45/04:15/04:45/05:15,
prepare 05:40, run 06:05, report 06:30/06:45/07:00.
`github.event.schedule` (dans le payload de l’événement) choisit le stage via
`scripts/task36_schedule.py`. L’heure réelle ne choisit jamais le stage.
GitHub prend bien en charge `timezone` :
https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onschedule
La date/heure initiale du run est relue par l’API : un rerun conserve son identité.
GitHub ne fournit pas le timestamp exact du créneau manqué : `scheduled_at` est
**inféré** du cron et de `run.created_at`, avec `scheduled_at_basis` explicite.
Les dispatchs Supabase fournissent date, créneau UTC et identifiant exacts.
Les heures réelles de début et fin sont distinctes, en UTC dans Supabase.
Le cutoff 05:40 Paris reste unique lors des deux changements d’heure.

Une acquisition tardive après cutoff ou snapshot gelé est un no-op explicite.
Les archives nouvelles ne modifient jamais le snapshot existant. Une génération
tardive de la même journée reste admise avec un dossier qualifié. Le watchdog
rattrape jusqu’à midi Paris, y compris après les contrôles de 07:00.

## Autorités des paramètres

| Paramètre | Autorité |
|---|---|
| Arrêt global | `editorial_control.emergency_stop` Supabase |
| IA quotidienne | `editorial_control.ai_enabled` Supabase |
| Acquisition | `editorial_control.acquisition_enabled` conservé pour compatibilité |
| Certification/promotion historique | `publication_enabled`, indépendant de la consultation expérimentale |
| Modèle | paramètre existant du workflow, modèles existants seulement |

`AGRICLIMAX_NIGHTLY_ENABLED`, `AGRICLIMAX_NIGHTLY_KILL_SWITCH`,
`AGRICLIMAX_AI_ENABLED` et `AGRICLIMAX_PUBLICATION_ENABLED` ne décident plus des
exécutions T36. Les anciens workflows manuels conservent leurs paramètres de
transition ; leurs deux crons météo/stations ont été retirés. Les crons de sécurité
et d’agriculture annuelle ont un autre rôle et restent présents.
L’environnement `editorial-ai-dev` n’avait aucune règle d’approbation lors de l’audit.

```sql
-- Un seul arrêt d’urgence pour GitHub et Supabase ; aucun dispatch utile admis.
update agriclimax_private.editorial_control set emergency_stop=true where singleton;
-- Suspendre seulement l’IA (les acquisitions continuent).
update agriclimax_private.editorial_control set ai_enabled=false where singleton;
```

L’arrêt bloque les nouvelles admissions ; il n’annule pas une requête fournisseur
déjà partie. Pour reprendre après un 401/403, corriger d’abord la configuration,
puis réinitialiser uniquement les acquisitions de la source concernée
(`state='pending', attempts=0, next_attempt_at=now(), lease_until=null`).
Une autorisation manuelle de retry ne contourne ni le verrou ni une archive réelle.
Un résultat OpenAI ambigu reste bloqué ; une réponse déjà persistée est rejouée
par le même validateur/archiveur, sans second appel fournisseur.

## Mise en service et recette propriétaire

1. Examiner/fusionner manuellement la PR et attendre les CI. Déployer le même commit
   sur Vercel. La migration OPS-02 est déjà appliquée au projet DEV existant ;
   elle n’active ni l’IA ni le cron. Aucun nouveau serveur/projet n’est nécessaire.
2. Créer un jeton GitHub fin sur **ce seul dépôt**, permission **Actions:write**.
   Dans le Dashboard Supabase → Vault → ajouter un secret nommé
   `agriclimax_t36_github_dispatch_token`. Ne jamais transmettre la valeur au chat,
   dans un fichier SQL, un artefact ou une variable publique. Ne pas réutiliser le
   jeton temporaire du runtime. Les secrets GitHub existants restent en place.
3. Une fois le workflow corrigé sur `main`, faire une recette sans IA : garder
   `ai_enabled=false`, simuler l’absence d’un créneau en attendant 02:30 sans
   acquisition, puis appeler `select agriclimax_private.editorial_watchdog();`.
   Relire après commit la ligne `watchdog-*` dans `editorial_diagnostics` :
   `queued` → `accepted` (204) → `started` → `finished`, et `outcome`.
   Vérifier le run GitHub identifié dans les checkpoints et les cinq résultats.
   Un second passage doit afficher `dispatch_pending`, `cooldown` ou aucun manque.
   Un 401/403 devient `refused`, jamais un succès. Un jeton absent devient
   `missing_vault_token`. Les réponses HTTP sont observées au passage suivant.
4. Après cette preuve réelle, activer le cron existant uniquement :
   `select cron.alter_job(job_id:=jobid,active:=true) from cron.job where jobname='agriclimax-t36-watchdog';`.
   Ne pas activer le cron avant la preuve du dispatch et du démarrage réels.
5. Pour la prochaine journée, fixer dans Supabase `emergency_stop=false`,
   `acquisition_enabled=true`, `ai_enabled=true`. Cela autorise durablement une
   seule tentative quotidienne sans approbation par édition ; OpenAI gère le budget.
   Aucune nouvelle génération d’essai n’est nécessaire pour le 10 novembre.

## Première nuit

Les checkpoints d’acquisition contiennent créneau, début, fin, durée, run GitHub,
dispatch Supabase, résultat et rapport du moteur. Les diagnostics `stage-DATE-*`
contiennent lease, début, fin et résultat de préparation/génération/contrôle.
Les diagnostics fournisseur conservent début de requête et réception de réponse ;
les archives conservent le reçu ; `editorial_archives.created_at` date l’archivage.
Le contrôle conserve checksum, date servie, disponibilité et date d’observation.
Compter les diagnostics `provider_request` par run/date pour les appels IA.
Mesurer chaque nuit les retards et l’heure du premier contrôle vérifié. Ne pas
promettre 06:30 avant l’observation réelle ; aucun rattrapage ne fabrique des données.
