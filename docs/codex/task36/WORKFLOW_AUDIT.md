# État courant — premier texte OpenAI reçu

Voir [FIRST_REAL_AI_EDITION.md](FIRST_REAL_AI_EDITION.md) et [ACCEPTANCE.md](ACCEPTANCE.md).
Les contrôles comptables antérieurs ne s’appliquent plus à T36. Le texte réel du
9 novembre est archivé pour inspection privée, avec rejet scientifique visible et
publication interdite. Aucune activation quotidienne ni fusion effectuée.

<details><summary>Conception et constats antérieurs (supplantés par l’état courant)</summary>

# État actualisé — recette DEV du 9 novembre

Qualification GitHub réelle 42609550528 : Supabase, OpenAI, MF obs/clim/AROME/ARPEGE et CDS présents. VERCEL_AUTOMATION_BYPASS_SECRET absent du runner. NIGHTLY_ENABLED=false, KILL_SWITCH=false, LEGACY_PRA_ENABLED=true, LEGACY_DAILY_ENABLED=true. GET environnement editorial-ai-dev : protection_rules=[], aucun approbateur obligatoire ni restriction de branche. API de liste secrets/variables HTTP403, compensée uniquement pour les bindings observés par présence booléenne. Workflow opérationnel absent de main donc dispatch par nom indisponible ; le workflow manuel existant a été réutilisé sur la branche pour qualifier puis effectuer l'essai unique. Ne pas merger pour contourner ce constat. Aucune concurrence nocturne réelle mesurée ; activer NIGHTLY après fusion fera céder les anciens writers.

Voir [ACCEPTANCE.md](ACCEPTANCE.md) pour les blocages et preuves actuels.

<details>
<summary>Conception et constat historique avant déploiement (supplantés par l’état ci-dessus)</summary>

# Audit d’exploitation — 9 novembre 2026

Base : `513ddd0` (PR #72 fusionnée). Propriétaire de la nouvelle chaîne :
`operational-journal.yml` + RPC `agriclimax_editorial`. Fuseau : Europe/Paris.

| Étape / propriétaire existant | Déclencheur avant T36 | Sources / variables | Dernière disponibilité observée | Durée connue / limite | Dépendances, reprise et publication | Risque / décision T36 |
|---|---|---|---|---|---|---|
| pra-climate / national-weather | 08:20 UTC, condition `PRA_CLIMATE_DAILY_DEV_ENABLED`, kill switch séparé | AROME, ARPEGE, IFS ; température/min/max, pluie, humidité | cycle 8/11 06:00 UTC, acquis 15:28 UTC | jobs manuels observés 0,5–0,7 min **non représentatifs d’une collecte nationale** ; plafond 23 min | catalogue privé, empreintes, checkpoints Actions ; promotion DEV explicite | trop tard ; calendrier de compatibilité 02:15 Paris ; cède tout accès d’écriture au propriétaire T36 lorsqu’activé |
| pra-climate / era5-archive + resume-1/2 | séquentiel après national-weather | ERA5-Land ; T/Tmin/Tmax/pluie historiques | 2/11/2026 ; 15 journées d’archives consommées, 10 695 lignes réelles | 3 × 23 min maximales, durée réelle de collecte non mesurée ici | source/cache et compact tiles vérifiés ; pointeur après archive | ne pas attendre J−1 ; un seul adaptateur existant, reprise bornée T36 |
| daily-live | 07:40 UTC, `AGRICLIMAX_DAILY_ENABLED` ; manuel | climatologie stations ; chaîne quotidienne/blé existante | 24/10/2026, acquis 25/10 12:44 UTC (250 lots) | dernier schedule observé en échec après 0,4 min ; plafond job 30 min | sept jours de correction, RPC d’idempotence, snapshot et reçu | déplacé à 02:45 Paris en compatibilité ; cède les écritures à T36 |
| meteofrance-ingestion | manuel uniquement | observations horaires et climatologie stations | observations : 16/10/2026, acquises 16/10 11:26 UTC (10 lots) | plafonds 20 / 5 min | ingest_weather, manifests et cache ; aucune collecte PRA concurrente | désactivé comme écrivain quand T36 est propriétaire ; probe lecture conservé |
| data-ingestion | 06:20 UTC + manuel | **fixtures fictives** | sans valeur scientifique | dernier schedule observé 0,3 min | artefacts locaux ; aucune clé Supabase | **cron supprimé**, jamais dépendance du Journal |
| editorial-ai-manual | manuel, propriétaire, branche principale, environnement editorial-ai-dev | vérification modèles OpenAI ; generate-once interdit sur runner éphémère T35B | vérification modèle réussie observée | 0,4 min ; plafond 5 min | aucun appel payant de test | conservé ; T36 autorise des runners éphémères seulement avec réservation SQL durable |
| task34_news | manuel avant T36 | sources documentaires du registre T34 | non collectées à nouveau ici | timeout opérationnel partagé 22 min | archive locale immuable ; lot désormais conservé dans checkpoint Supabase | étape nocturne dédiée ; indisponibilité documentaire explicite et non bloquante |
| T33 / calculateurs nationaux | scripts et lecture serveur | archives nationales qualifiées, Almanach versionné | dossier réel du 9/11, cycle du 8/11 | préparation réelle : voir preparation-metrics.json | réutilise détecteurs, comparaisons et épisodes existants | aucun nouveau calcul scientifique ; lecture par empreinte, données gelées |
| OPS-01 / OPS-01B / DATA-01 | weather-health dépend des jobs du même workflow | reçus, continuité d’archives, frais et écritures | rapports historiques du dépôt | plafond health 5 min | reprend les diagnostics existants | ne détecte pas seul un workflow jamais lancé ; ajout watchdog SQL indépendant |
| agriculture-annual | calendrier annuel / manuel | RPG et statistiques agricoles | index existant inchangé | non mesurée ici | sources/index versionnés | aucune collecte nocturne concurrente |
| task12-era5-real-validation | manuel | pilote réel borné, ne constitue pas le service quotidien | preuves historiques existantes | non mesurée ici | validation explicite | conservé hors exploitation |
| quality / security | PR, push, manuel | tests et scans | voir logs T36 | dernier Quality observé 6,9–8 min | aucun déclenchement du workflow opérationnel | aucune clé OpenAI consommée par CI de tests |

GitHub déclare les anciens workflows `active`, ce qui **ne démontre pas** que leurs
jobs conditionnés sont activés. Lecture des variables et noms de secrets refusée
HTTP 403 (`Resource not accessible by integration`). Valeurs effectives des
variables : **inconnues**, jamais déduites des expressions YAML. Aucun secret lu.
Métadonnées non secrètes : `evidence/workflow-runs.json` (échantillon 60 runs).

</details>

</details>
