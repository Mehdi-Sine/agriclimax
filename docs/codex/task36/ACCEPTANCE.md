| Critère | Verdict |
|---|---|
| Acquisition nocturne reprogrammée | OUI |
| Reprises toutes les 30 minutes opérationnelles | NON |
| Supervision indépendante GitHub/Supabase | NON |
| Utilisation qualifiée des prévisions antérieures | OUI |
| Dossier éditorial quotidien gelé | OUI |
| Premier véritable article OpenAI produit | NON |
| Budget OpenAI persistant dans Supabase | NON |
| Archivage Supabase vérifié | NON |
| Publication d’une vraie édition | NON |
| Chaîne complète exécutée réellement | NON |
| Nouvelle édition disponible entre 6 h 30 et 7 h | NON ENCORE MESURÉ |
| Mode dégradé opérationnel | NON |
| Supervision pour 14–21 jours préparée | OUI |

# Portée des verdicts

Les OUI « reprogrammée » et « gelé » décrivent le code livré et un snapshot local
vérifié par empreinte, **pas** une activation distante. Le repli est démontré en
lecture seule sur des archives réelles DEV. Le mode dégradé est implémenté/testé
localement, mais n’est pas déclaré opérationnel sans nuit distante.

| Niveau | Résultat constaté |
|---|---|
| Implémenté | propriétaire nocturne, baux et cooldown, contrôle DB, sélection, gel, store SQL, archive/promotion, lecture Journal datée, verdicts et protocole |
| Testé localement | 193 tests TypeScript, 4 tests Python de reprise, 47 tests station/daily, 24 tests qualité ; PostgreSQL 17 et deux connexions concurrentes ; build, typecheck, lint, actionlint, contrats, guards ; navigateur 6 combinaisons |
| DEV distant en lecture seule | catalogue réel, 4 cycles accessibles ; sélection du 8/11 pour édition 9/11 ; 15 jours ERA5, 10 695 lignes, 713 identités ; 12 faits T33 |
| Vercel Preview distant | GET /journal/preview : HTTP 200, simulation explicitement marquée, aucune génération déclenchée ; ne valide pas le backend opérationnel |
| DEV distant modifié | **aucun** : migration refusée par revue automatique ; aucun Cron/pg_net/Vault/dispatch installé |
| Production activée | **aucune** ; aucune publication publique, aucun merge |
| Exploitation nocturne démontrée | **aucune** ; recette 14–21 jours à commencer après qualification |

# Causes exactes des NON et actions

- Reprises / superviseur / budget / archivage partagé : migration non appliquée.
  La revue automatique a refusé l’opération regroupant changements de schéma et
  droits, Cron/pg_net, Vault et déclenchement externe GitHub. Les fichiers sont
  maintenant séparés pour revue, mais **aucune nouvelle tentative distante** n’a
  été faite. Accord explicite sur les fichiers livrés, puis déploiement et recette
  DEV nécessaires. Ne pas confondre tests locaux et preuve Supabase distante.
- Premier article : `OPENAI_API_KEY` absent de cet environnement et autorité SQL
  distante non installée. Injecter la clé côté serveur dans les paramètres protégés,
  qualifier le registre, puis effectuer l’appel unique déjà autorisé (<= 0,15 €).
- Publication réelle : aucun article réel à promouvoir ; la relecture sémantique
  T35 reste nécessaire pour une nouvelle prose. Examiner le texte, promouvoir par
  checksum en DEV ; obtenir l’accord avant publication publique.
- Chaîne réelle / mode dégradé / disponibilité : pas de déploiement ni de nuit
  opérationnelle exécutée. Les variables et secrets Actions sont illisibles avec
  les droits présents (HTTP 403) ; les workflows active ne prouvent pas l’activation
  des jobs. Qualifier l’environnement et mesurer les nuits après fusion/activation
  autorisées. Aucune promesse de disponibilité absolue GitHub n’est faite.

# Mesures

Preuve `evidence/preparation-metrics.json` : préparation réelle en lecture seule
14,279 s, RSS maximal observé du processus 708,45 Mio, 12 faits, 10 695 lignes
historiques. Ces mesures sont celles d’une reconstruction tardive du dossier du
9 novembre (cutoff 05:40 Paris, gel local après 10h Paris), **pas** d’une nuit réussie.
Les dates de gel exactes figurent dans le snapshot compressé.

Préflight hors ligne gpt-6-luna : 39 894 octets d’entrée, borne 55 837 tokens,
6 000 tokens de sortie maximum, réservation estimée 0,009443 €. État financier
réel non lu/non réservé. Coût OpenAI effectivement engagé par T36 : **0 €**.
Aucun response_id ni token réellement facturé. Source : `evidence/offline-budget.json`.

Limites : archive SQL 2 Mio ; entrées compressées Storage 8 Mio ; baux 25 min,
travail source 22 min, 8 tentatives et cooldown >= 30 min. Plafonds Actions : job
acquisition 26 min / rédaction 25 min ; installation et files GitHub incluses dans
le budget horaire à mesurer. Supabase Free constaté, stockage/quota réels après
activation non mesurés. Les screenshots sont des previews existantes simulées,
visiblement marquées ; ils ne représentent pas un premier article réel.

# Scénarios demandés (numéros TASK)

| Scénarios | Validation livrée / limite |
|---|---|
| 1–5 | sélection fraîche/repli/insuffisance et historique absent testés localement ; vraie sélection fallback_valid en lecture DEV ; acquisitions simultanées réelles non exécutées |
| 6–8 | classes 429/500/401 et Retry-After testées Python, pas injection de pannes chez les fournisseurs |
| 9–10 | cooldown/états et cache dans code ; skip du cycle archivé avant téléchargement ; cadence distante et reprise après 30 min à mesurer |
| 11–12 | watchdog SQL détecte workflow jamais lancé ; Cron/dispatch **non exécutés**, extensions absentes lors de l’inspection |
| 13 | baux et sérialisation catalogue implémentés ; double acquisition distante non démontrée ; deux réservations financières réellement concurrentes testées sur PostgreSQL local |
| 14–15 | détecteurs CORE-01 réutilisés ; trace brute réelle Crozon dans real-coverage.json avec qualifications littorales conservées. Un `available` brut ne signifie pas publication scientifique ; aucune prétention de nouvelle qualification Crozon |
| 16–19 | cutoff/immutabilité/âge/émissions réelles/DST testés ; limitations de repli injectées au dossier ; échec T34 ne fabrique pas de confirmation et n’impose pas une panne IA |
| 20–21 | états calmes/absents testés par suites Journal existantes ; dossier sans faits exploitable => insufficient, zéro appel payant |
| 22–23 | deux connexions SQL : une seule réservation ; outcome_unknown interdit transition vers running ; tests provider T35 existants sans vraie requête payante |
| 24 | promotion SQL désactivée/rejetée et validations T35 ; promotion distante **non effectuée** |
| 25–28 | catalogue de publication immuable, lecture date/carte/ETag testée localement avec manifeste synthétique ; DST printemps/automne testés ; six captures de preview desktop/mobile |
| 29–30 | **NON** pour E2E DEV réel ; atomicité réservation et mutations contrôlées testées SQL local |
| 31–34 | guards secrets/migrations/contrats/actionlint passent ; plafonds SQL et retrait du cron fixtures ; propriétaire unique et absence de génération payante dans CI de tests |
| 35–36 | contrôle absent/delayed et page/empreinte implémentés ; édition réelle 06:30/07:00 **non mesurée** |
| 37–38 | interrupteurs serveur/DB et refus de publication testés localement ; tests de CI n’appellent pas OpenAI ; arrêt distant à exercer après activation |

# Limites fonctionnelles supplémentaires

Pas d’avancement automatique avant 05:40 ni calcul différentiel par PRA : seuls
les cycles/données inchangés sont évités et les méthodes existantes réutilisées.
Pas de révisions distantes multi-versions payantes. Le cache de secours de lecture
est en mémoire : une DB totalement indisponible après cold start peut empêcher la
lecture. Le dispatch pg_net queued doit encore être contrôlé via sa réponse HTTP.
Un appel interrompu après archivage mais avant état completed exige réconciliation
manuelle : aucune relance payante ne contourne ce garde-fou.

La tâche reste une **PR draft à qualifier**, pas une mise en service terminée.

Validation SQL complète locale supplémentaire : limitée par l’espace disque Docker du runtime (image PostGIS + copie du conteneur). Les tests PostgreSQL ciblés passent ; la matrice PostGIS complète est exécutée dans GitHub Actions.
