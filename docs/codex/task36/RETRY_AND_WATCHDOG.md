# Reprises et supervision indépendante

`editorial_acquisitions` : pending, running, success, no_new_data,
retryable_failure, permanent_failure, degraded, expired. Clé `(jour Paris,source)`.
Réclamation sous verrou SQL, jeton UUID, bail 25 minutes ; sous-processus total
22 minutes ; 8 tentatives maximum ; 30 minutes au minimum entre tentatives.
Les sources déjà réussies sont conservées. Forecast peut sonder un cycle plus
récent au contrôle suivant, mais ne réacquiert pas un cycle archivé.

429 : respecter Retry-After (secondes/date HTTP), minimum 30 minutes. 5xx et réseau :
reprise bornée. 401/403 : échec permanent. 404/produit non livré : no_new_data.
Checksum/contrat invalide : archive refusée, jamais promue ; pas de téléchargement
massif en réaction. Le rapport fournisseur WCS transmet son code et son cooldown.
Les adaptateurs ont aussi leurs petites reprises HTTP existantes, au plus 3 essais.
Le transport stations ne tronque plus un Retry-After long à 30 secondes : il
remonte le cooldown au registre ; les erreurs d’accès restent permanentes.

`supabase/ops/task36_watchdog.sql` est une opération **séparée** de la migration :
pg_cron appelle toutes les 15 minutes une fonction courte qui filtre la fenêtre
Paris et journalise les workflows absents/bloqués, acquisitions incomplètes,
snapshot absent, archive non promue, édition absente. pg_net peut déclencher
Actions, sans calcul scientifique ni accès OpenAI. Une identité de créneau local
évite les doublons DST ; acquisition dispatchée aux quarts 15/45 uniquement.

À configurer dans Vault : `agriclimax_t36_github_dispatch_token`, jeton fin limité
à Actions:write sur ce dépôt. Aucun jeton en SQL versionné. Une absence de jeton
produit `missing_vault_token`, jamais un faux succès. Vérifier aussi les réponses
`net._http_response` par request_id (durée de conservation limitée), pas seulement
l’état queued. Le watchdog peut rattraper 03:15 après un créneau 02h manqué.

Plan constaté : Supabase Free. Deux extensions absentes lors de l’inspection ;
aucune installation distante effectuée. Cadence <= 1 contrôle/15 min et un job
court ; mesurer temps DB, stockage et consommation Actions avant activation.
La revue automatique a refusé le déploiement groupé (schéma, droits, Cron, Vault
et dispatch externe). Aucun contournement : déploiement et dispatch non démontrés.
