# État courant — premier texte OpenAI reçu

Voir [FIRST_REAL_AI_EDITION.md](FIRST_REAL_AI_EDITION.md) et [ACCEPTANCE.md](ACCEPTANCE.md).
Les contrôles comptables antérieurs ne s’appliquent plus à T36. Le texte réel du
9 novembre est archivé pour inspection privée, avec rejet scientifique visible et
publication interdite. Aucune activation quotidienne ni fusion effectuée.

<details><summary>Conception et constats antérieurs (supplantés par l’état courant)</summary>

# Décision propriétaire — budget géré dans OpenAI

Les réservations, plafonds applicatifs et rapprochements financiers ne conditionnent
plus T36. Le parcours actif utilise `generateOperational` et un verrou par date :
tentatives distinctes, reprise manuelle après erreur pour la même date, aucune
relance automatique, aucune régénération d’une édition techniquement validée.
L’ancien HTTP 400 et ses montants historiques restent inchangés. Les tokens et
coûts sont des métadonnées facultatives ; le coût calculé est une estimation,
jamais une facture prétendument retournée par Responses.

Migration ciblée `20261109152744_editorial_operational_attempts.sql` appliquée en DEV :
contrainte financière retirée, index unique sur les tentatives actives par date et
RPC invoker service-only dédiée. Aucun nouveau tableau, aucune activation quotidienne
ni publication publique. Tests : 558 tests locaux passés, recette SQL et deux vraies
connexions concurrentes locales (une seule admission), contrôle DEV avec rollback.
Le dossier réel du 9 novembre conserve son snapshot et sa date pour l’essai autorisé.

Les consignes comptables ci-dessous sont historiques et ne s’appliquent plus.

<details><summary>Historique antérieur à la décision propriétaire</summary>

# État actualisé — recette DEV du 9 novembre

Extensions installées séparément : pg_cron 1.6.4 (migration distante 20261109112047), pg_net 0.20.4 (20261109112115). Vault 0.3.1 était présent. Watchdog installé séparément (20261109112139), job */15 UTC inactif avec filtre Europe/Paris ; probe outside_window, aucun dispatch. Vault ne contient aucun secret. Le contrôle 06:30 porte sur le brouillon privé techniquement valide ; une relecture en attente n'est pas une promotion défaillante. Installer séparément le token propriétaire limité Actions:write avant toute activation. Cadence 30 minutes et contrôles 06:30/06:45/07:00 testés en code, non mesurés sur une nuit. outcome_unknown interdit toute reprise payante automatique.

Voir [ACCEPTANCE.md](ACCEPTANCE.md) pour les blocages et preuves actuels.

<details>
<summary>Conception et constat historique avant déploiement (supplantés par l’état ci-dessus)</summary>

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

</details>

</details>

</details>
