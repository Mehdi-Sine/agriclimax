# OPS-08B · Fiabilisation opérationnelle du Journal

Base de travail `989605992670f34622a815397eed04a6f7bd0882`, fusion de la PR #103. Périmètre couvert par les changements : déclenchement GitHub/Supabase, admission et reprise éditoriales, collecte privée SIM, dépendances CI et Next.js.

## Audit du 12 au 19 novembre 2026

Fenêtre de sept jours à partir du 12 novembre à 07 h 30 UTC. Échantillon GitHub extrait le 19 à 07 h 30 UTC, toutes branches et tous événements. L’unité « runner » est la somme des durées `completed_at - started_at` de chaque job affecté à un runner, y compris les tentatives relancées. Les jobs ignorés et le temps en file sont exclus. L’estimation après changement utilise les durées des jobs historiques et conserve les contrôles de CI.

| Workflow | Avant et résultat observé | Minutes runner sur 7 j | Après |
| --- | --- | ---: | --- |
| T36 Journal | 42 horaires et 62 dispatchs. 60 succès, 44 échecs. Jusqu’à 12 créneaux GitHub prévus par jour, hors watchdog. | 438,8 | Génération à 05 h 50 et vérification à 06 h 45 Paris. Acquisitions déclenchées par le watchdog uniquement s’il reste une source admissible. Une reprise automatique de génération au plus entre 06 h 15 et 06 h 45. Dispatchs manuels conservés. |
| SAFRAN/SIM | Job du Journal lié à chaque acquisition quand la collecte privée est activée. 10 exécutions, toutes en échec. | 7,2 déjà incluses dans T36 | Workflow privé quotidien à 03 h 07 Paris. Une admission effective par date, partagée avec son déclencheur manuel. |
| Quality | 38 PR et 20 push sur main. 38 succès, 8 échecs, 11 annulations et 1 exécution en cours à la collecte. | 656,3 | Mêmes déclencheurs et contrôles. Clé du cache Python basée sur tous les fichiers verrouillés installés. |
| Security audits | 38 PR, 20 push sur main et 1 audit hebdomadaire. 56 succès et 3 échecs. | 87,6 | Mêmes audits et déclencheurs. Une nouvelle révision de PR annule uniquement l’audit PR devenu obsolète. |
| Agriculture annual source check | Contrôle du catalogue le 15 juillet et le 15 novembre, ou à la demande. 1 succès. | 0,3 | Identique. |
| Dependabot npm | Mise à jour dynamique. 1 succès. | 3,2 | Identique. |
| Daily live / Météo-France live station ingestion | Dispatch manuel pour les acquisitions stationnaires. 0 exécution. | 0 | Conservés pour les interventions explicites. |
| Fixture weather ingestion | Dispatch manuel de données de démonstration. 0 exécution. | 0 | Identique. |
| INT-01 prepare edition maps | Préparation manuelle de cartes en lecture seule. 0 exécution. | 0 | Identique. |
| Manual editorial AI verification | Qualification manuelle séparée de la production quotidienne. 0 exécution. | 0 | Identique. |
| Produire / tester le Journal | Reprise et test manuels. 0 exécution. | 0 | Lecture du contexte ciblée par date. |
| Bounded PRA climate batch / Task12 ERA5 real validation | Lots climatiques et validation manuelle ERA5. 0 exécution. | 0 | Identiques. |

Les huit échecs Quality comprennent cinq échecs de smoke navigateur, un de vérification des cartes INT-01, un mypy et un Ruff. Les trois échecs Security sont au niveau de Gitleaks. Les checkouts d’historique nécessaires à Gitleaks et au contrôle des migrations sont conservés. Les filtres de chemins resteraient risqués pour ces contrôles transversaux. Les jobs de workflow opérationnel gardent un checkout superficiel et sans credentials persistants. Les artefacts compacts Forecast/ERA5 sont utilisés par la reprise, ceux de diagnostic par l’exploitation. Les jobs filtrés ne créent plus d’artefacts. Les installs pnpm de l’éditorial et Python des acquisitions utilisent les caches verrouillés. La vérification éditoriale n’installe plus Python. La matrice des sources légères n’installe plus les dépendances géospatiales et climatiques.

Le watchdog Supabase `agriclimax-t36-watchdog` a exécuté 672 ticks avec succès SQL à la cadence de 15 min. Cela mesure l’exécution SQL. Les diagnostics enregistrent séparément le résultat du dispatch GitHub. Ils donnent 23 acquisitions terminées (14 en échec), 12 préparations (5), 13 vérifications (9) et 14 générations (9 en échec, 1 en attente). Avant OPS-08B, une préparation manquante pouvait retenir le watchdog dans une boucle jusqu’à midi. Les retards GitHub ont aussi poussé des créneaux matinaux en journée. Le watchdog utilise maintenant le même état d’éligibilité que le plan GitHub et ferme les reprises avant le rapport de 07 h 30. La branche d’envoi OPS-08 reste indépendante.

Sur 185 jobs de sources, 49 ont une tentative effective corrélée au registre Supabase (11 ERA5, 7 prévisions, 10 stations, 14 observations, 7 actualités). Le plan omet les succès, le cooldown, les baux actifs, les erreurs permanentes et les éditions gelées. Les deux sources climatiques se partagent le même verrou et le plan privilégie la moins tentée. Les indisponibilités temporaires restent visibles, respectent le délai fournisseur et ont au plus trois tentatives automatiques par date. Une absence de nouvelle donnée secondaire ne justifie plus un nouveau runner la même nuit. Les erreurs d’accès et de configuration restent terminales. Une réponse 404 d’une ressource climatique du jour peut signaler une disponibilité tardive et reste bornée par ces règles.

### Budget runner

| Périmètre | Avant, mesuré | Après, estimation |
| --- | ---: | ---: |
| Journal et SIM | 62,7 min/j | 42–48 min/j |
| Ensemble des workflows | 169,5 min/j | 149–155 min/j à activité PR comparable |

Les 49 jobs d’acquisition corrélés totalisent 262,0 minutes, soit 37,4 min/j. La projection ajoute 1 à 2 min/j pour les plans, 2 à 6 min/j pour l’éditorial et sa vérification, et 1 à 3 min/j pour SIM. Les caches et le plafond de relance peuvent réduire ces durées. Le gain projeté est d’environ **440 à 620 minutes runner par mois de 30 jours** (23 à 33 % du Journal et de SIM). Le temps réel après mise en production reste à mesurer sur sept jours avec l’API Actions. L’arrondi par job de la fenêtre avant changement donne 614 minutes pour le Journal/SIM et 1 675 minutes pour tout le dépôt. Ces sommes ne sont pas des relevés de facturation GitHub.

Pour reproduire, paginer `gh api repos/Mehdi-Sine/agriclimax/actions/runs` avec le filtre `created`, puis `actions/runs/<id>/jobs?filter=all&per_page=100`. Croiser les jobs `acquire (<source>)` et les diagnostics `acquire-result-%` sur le run et la source. L’indicateur déjà présent dans le mail reste le cumul des traitements mesurés à partir des reçus. Il exclut notamment les installations, la file et les jobs terminés sans reçu. L’audit GitHub mesure séparément le temps des runners.

## Incidents du Journal

- **18 novembre.** Le premier rattrapage de préparation a échoué à 06 h 01 Paris dans `acquisition_report` avec `TimeoutError`. Les trois suivants ont échoué sur la même lecture avec `EDITORIAL_RPC_FAILED`. Le gel `fallback_valid` a finalement abouti à 08 h 15 Paris. La génération de l’après-midi a échoué en admission avec `TimeoutError`. Aucun run éditorial ni archive pour la date dans le registre. [Première préparation](https://github.com/Mehdi-Sine/agriclimax/actions/runs/44241127776) · [Génération](https://github.com/Mehdi-Sine/agriclimax/actions/runs/44316148986)
- **19 novembre.** Le dossier `fallback_valid` était gelé à 06 h 00 Paris. Le job éditorial a échoué à 06 h 16 Paris en phase `admission`, avant l’insertion d’une tentative OpenAI. L’ancienne lecture RPC `report` agrège 22 dates avec les dossiers, les diagnostics et les reçus. Vérification en lecture seule : 15 436 446 octets en SQL. Le même RPC via REST répond HTTP 500 / PostgreSQL `57014` en 12,68 s, au-delà du délai client de 12 s. `control` et `snapshot_read` ont répondu HTTP 200 en 1,47 s et 0,66 s. Cette lecture était commune aux échecs de préparation, d’admission et de supervision. [Exécution signalée](https://github.com/Mehdi-Sine/agriclimax/actions/runs/44463852102)
- **Correction.** Préparation, admission, reprise manuelle et supervision lisent le contexte de la seule date, avec les diagnostics utiles au rejeu. La projection SQL en lecture seule produit respectivement 313 762 et 314 043 octets pour les 18 et 19 novembre. La génération peut préparer elle-même le dossier si nécessaire. Une archive déjà consultable ou certifiée est réutilisée. Sans clé ou avec l’IA désactivée, le secours factuel s’appuie sur le dossier qualifié, inscrit l’archive et la ligne à zéro coût dans la même transaction, sous le verrou des tentatives. Un résultat OpenAI déjà enregistré est rejoué. En cas d’échec fournisseur ou de tentative interrompue sans réponse exploitable, le secours reprend le verrou et le registre existants. La publication reste soumise aux validations du texte et des cartes, avec l’archive et le manifeste immuables. Une vérification OpenAI de modèle a été supprimée du chemin journalier. Le maximum reste un appel de génération par édition.
- **SIM.** Une différence de valeurs sur un jour existant trop ancien provoquait une exception avant le traitement des dates récentes. La collecte isole désormais les révisions hors fenêtre et celles dépassant le plafond de deux versions. Le reçu indique les dates et le motif. La révision privée conservée est vérifiée avant de poursuivre. Toute erreur de transport, d’intégrité ou de persistance reste un échec. Le checkpoint privé à huit emplacements et la vérification indépendante de la restauration sont conservés. [Échec SIM observé](https://github.com/Mehdi-Sine/agriclimax/actions/runs/44455245079)

## Next.js

L’audit npm de référence signale deux avis Next.js de sévérité modérée pour `16.4.1`, corrigés à partir de `16.4.5`. Le commit isolé passe Next.js et sa configuration ESLint à `16.4.6`. Les deux avis Next.js ont disparu du nouvel audit. Restent `esbuild` (faible) et `minimatch` (modéré). [GHSA-mfr8-8qww-v76h](https://github.com/advisories/GHSA-mfr8-8qww-v76h) · [GHSA-vc7v-qv4w-wrv8](https://github.com/advisories/GHSA-vc7v-qv4w-wrv8)

## Vérification

- PostgreSQL 17 jetable, `bash tests/task36/run-ledger.sh` : migrations OPS-08 et OPS-08B, contrôle d’accès aux RPC, sélection de la matrice, refus après gel, verrou des tentatives, répétition idempotente du secours, reprise unique du watchdog et l’exclusion d’un second collecteur SIM. Les tests de réserve et d’acceptation du mail utilisent un transport simulé.
- Python, `PYTHONPATH=engine/src:scripts python -m pytest -q tests/task36 engine/tests/climate` : 108 tests. Le test SIM conserve la révision de J−4 et enregistre J−1 dans la même passe. La suite couvre aussi les dates Paris au changement d’heure.
- Web : vérification TypeScript, build Next.js 16.4.6 et 805 tests Vitest réussis (16 désactivés par la configuration de suite). Le secours sans clé n’alloue aucune tentative fournisseur. Un échec fournisseur donne un secours validé et un seul appel dans la simulation.
- `actionlint`, contrôle du registre des migrations et contrôle des secrets exécutés localement. La publication avant 07 h et le budget après changement restent à vérifier sur le cycle déployé.

## Mise en production

1. Après revue et fusion manuelle, appliquer dans l’ordre les migrations en attente du projet `agriclimax-dev` : OPS-08 `20261119055621`, puis OPS-08B `20261119073437`. Faire cette opération hors fenêtre 02 h 15–07 h 30 Paris pour que les workflows du nouveau `main` et le watchdog utilisent la même version. La lecture de contrôle a constaté le 19 novembre que la migration OPS-08 était encore en attente. Le Cron était actif et le jeton de dispatch GitHub était déjà présent dans Vault.
2. Vérifier le déploiement Vercel depuis `main`, puis observer le prochain cycle. Vérifier le manifeste et la date sur `/api/journal/availability`, les reçus d’acquisition, le reçu SIM et l’absence de tentative OpenAI additionnelle. Comparer sept jours de minutes avec la méthode ci-dessus. En cas d’incident, consulter la phase et le registre. Le dispatch `run` et l’entrée `edition_date` reprennent d’abord l’archive ou le dossier déjà présents. La récupération de sources pour une date passée exige une demande explicite. Elle reste soumise aux baux et à l’immutabilité du dossier gelé.
3. Après autorisation d’un envoi réel, appliquer le [runbook OPS-08](../OPS-08/RUNBOOK.md). Vérifier le domaine Resend, fournir sa clé d’envoi et les adresses sur Vercel Production, puis distribuer le même nouveau jeton de rapport à Vercel, à l’environnement GitHub `editorial-ai-dev` et à Supabase Vault. Redéployer Vercel après ajout des secrets. Le premier envoi doit être contrôlé par le reçu d’acceptation Resend. Le watchdog couvre 07 h 30 Paris si la publication n’a pas déjà donné lieu au rapport.

L’intervention manuelle consiste à approuver et fusionner la PR, appliquer les migrations avec l’accès au projet, puis autoriser et renseigner les secrets d’envoi pour activer OPS-08. Les secrets de dispatch et d’acquisition déjà présents sont réutilisés. Aucun envoi réel ni rattrapage historique n’a été déclenché pendant la validation.
