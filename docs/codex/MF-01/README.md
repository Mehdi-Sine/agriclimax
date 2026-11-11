# MF-01 — diagnostic et stabilisation des acquisitions

Statut : **PARTIAL**. Les quatre familles sont accessibles dans GitHub ; acquisitions J-1, observations récentes et cycle national frais jusqu'à J+7 réussis en recette sans publication. La couverture de l'humidité reste partielle et six PRA ont une pluie partielle à J+5 ; la continuité scientifique homogène de sept jours n'est pas acquise. Les données de production restent intactes et la cause exacte du rejet stations historique n'est pas reconstituée. Une CI verte ou un cycle acquis ne suffisent pas pour READY.

Base : `main` actualisée, `bd475ff9f169cdcc73a3f9325e19ab8119f8d34f` (OPS-04 #79 déjà fusionnée). Branche `codex/mf-01-acquisition-reliability`. Audit du 11 novembre 2026 ; les heures techniques des preuves sont UTC, ajouter une heure pour Paris ce jour-là.

## Diagnostic des quatre familles

Origine API : `https://public-api.meteofrance.fr/public/`.

| Famille / endpoint | Authentification attendue et produit requis | HTTP réel dans Actions | Dernière acquisition valide identifiée / validité | Diagnostic et action |
|---|---|---|---|---|
| Climatologie : `DPClim/v1/liste-stations/quotidienne?id-departement=29`, puis commandes quotidiennes | `apikey: METEOFRANCE_CLIMATOLOGY_API_KEY` ; ou OAuth explicitement configuré via `METEOFRANCE_CLIMATOLOGY_APPLICATION_ID`. Souscription DPClim et données quotidiennes | **200**, catalogue compatible | Échantillon réel station 29075001 : six variables reçues pour le 10/11, sans qualification nationale. Le registre nocturne montre un échec `ValueError`, phase validation du 10/11 ; la même fenêtre des cinq stations passe dans la recette actuelle. Ne pas le qualifier de 401 | Accès GitHub valide. Fenêtre 04–10/11 reproduite sans persistance : 210 lignes et zéro rejet. Les évolutions OPS-03 et la disponibilité plus tardive des données empêchent d'attribuer rétrospectivement une cause unique ; aucun seuil assoupli |
| Observations / stations : `DPObs/v1/liste-stations`, `station/horaire` ; sonde séparée DPObs v2 | `apikey: METEOFRANCE_OBSERVATIONS_API_KEY` ; ou OAuth avec `METEOFRANCE_OBSERVATIONS_APPLICATION_ID`. Droits DPObs pour la version demandée | **200 v1** ; **403 v2**, code fournisseur `900908` | Registre : 11/11 à 04:01 UTC, 15/15 mesures sur les cinq stations MVP. Ce sont des échantillons horaires, pas des agrégats nationaux J-1 | Maintenir v1 : compatible avec les droits constatés. Aucune migration automatique v2. Si v2 devient nécessaire, vérifier manuellement le produit/version dans le portail ; aucun abonnement modifié |
| AROME : `arome/1.0/wcs/MF-NWP-HIGHRES-AROME-0025-FRANCE-WCS/` | `apikey: METEOFRANCE_AROME_API_KEY`, produit AROME WCS France 0,025°. Aucun échange OAuth dans cet adaptateur | **200**, 8 676 couvertures annoncées | Dernière archive conservée en production : acquisition globale 09/11 à 19:01:50 UTC ; AROME contient les 08–10/11, cycles 08/11 00Z, 09/11 00Z et 09/11 12Z | Catalogue et champ natif vérifiés : température 2 m, cycle du 11/11 à 09Z, validité 09Z, 25 points. GetCoverage, dates GRIB et calcul national vérifiés dans la recette complète. Ne pas renouveler une clé GitHub fonctionnelle par défaut |
| ARPEGE : `arpege/1.0/wcs/MF-NWP-GLOBAL-ARPEGE-01-EUROPE-WCS/` | `apikey: METEOFRANCE_ARPEGE_API_KEY`, produit ARPEGE WCS Europe 0,1°. Aucun échange OAuth dans cet adaptateur | **200**, 4 824 couvertures annoncées | Même archive en production ; ARPEGE contient les 09–12/11, cycles 09/11 00Z puis 12Z | Champ natif vérifié : température 2 m, cycle du 11/11 à 06Z, validité 06Z, quatre points. Même séparation accès / acquisition / couverture. L'artefact enfant établit un HTTP 404 sur un index IFS, avant OPS-03, sans lien démontré avec les clés Météo-France |

Preuve réelle Actions : [sonde catalogues 43031581415](https://github.com/Mehdi-Sine/agriclimax/actions/runs/43031581415), commit `eab84be`. Zéro écriture en base, zéro appel OpenAI ; job `live` ignoré. Les nombres de couvertures sont des métadonnées, pas des nombres de PRA qualifiées.

Recette réelle supplémentaire : [43031961280](https://github.com/Mehdi-Sine/agriclimax/actions/runs/43031961280), commit `673dd68`, terminée avec succès. [Rapport des échantillons](evidence/github-samples.json) : station 29075001 J-1 (10/11), six champs reçus ; observation du 11/11 à 13Z, trois champs ; AROME cycle/validité 09Z, ARPEGE 06Z. Les deux messages GRIB complets sont décodés par ecCodes, dates, échéance zéro, unités K, niveau 2 m et résolutions 0,025°/0,1° contrôlés. Six requêtes WCS au total, 124 576 octets ; aucun transfert national, zéro écriture distante, zéro appel OpenAI. Cette échéance zéro vérifie le transport natif, pas la disponibilité effective de J+5/J+7 ni les autres variables. Les codes qualité DPClim 1/9 restent conservés ; six valeurs présentes ne constituent pas six observations scientifiquement qualifiées.

Recette de la fenêtre stations : [43033196927](https://github.com/Mehdi-Sine/agriclimax/actions/runs/43033196927), commit `d987d45`, réussie. Le véritable `run_daily` utilise les sources des cinq stations, les validations et calculs existants, avec des sinks locaux remplaçant uniquement les écritures/publications. Fenêtre 04–10/11, 210 lignes, cinq stations acceptées, aucun rejet ; aucune écriture distante. [Preuve](evidence/github-station-window.json).

L'ancien artefact `t36-forecast-logs` du run 42956329780 a finalement été récupéré via le connecteur GitHub (le téléchargement Blob direct renvoyait 403). Il établit un **404 d'index IFS** dans `operational_weather_pilot.py`, avant les changements OPS-03. L'échéance exacte manquante n'est pas enregistrée, donc non inventée. [Diagnostic dérivé sans log brut](evidence/historical-forecast-failure.json). Les index IFS 0 h et 192 h du 11/11 00Z sont maintenant accessibles (HTTP 200, dates/cycle vérifiés) : [preuve](evidence/ifs-readiness.json). Ce n'est ni une erreur de clé Météo-France, ni une preuve de complétude de tous les champs à 04 h UTC.

Les clés de l'environnement Codex donnent au contraire **401 / 900901** sur DPClim, DPObs v1 et v2. Les clés AROME/ARPEGE n'y sont pas liées. Le succès avec les secrets GitHub exclut de généraliser le 401 local au dépôt. Aucune valeur, empreinte ou décodage de secret n'a été produit. L'API de liste des secrets GitHub retourne 403 « Resource not accessible by integration » : inventaire administratif et dates d'expiration non accessibles. Les noms et modes effectifs sont établis par les bindings des workflows et leurs sondes.

## Secrets et renouvellement

| Nom | Usage / durée de vie | Action manuelle nécessaire |
|---|---|---|
| `METEOFRANCE_CLIMATOLOGY_API_KEY` | Header `apikey`, DPClim uniquement. Durée effective inconnue et non inférable d'un 401 | Vérifier la liaison **Codex** qui échoue ; comparer administrativement au produit autorisé. Pas de renouvellement GitHub justifié par la sonde 200 |
| `METEOFRANCE_OBSERVATIONS_API_KEY` | Header `apikey`, DPObs uniquement. La clé GitHub autorise v1, pas v2 dans la sonde | Vérifier la liaison Codex ; vérifier les droits v2 seulement si cette migration est voulue. Ne pas remplacer v1 par v2 dans MF-01 |
| `METEOFRANCE_CLIMATOLOGY_APPLICATION_ID`, `METEOFRANCE_OBSERVATIONS_APPLICATION_ID` | Optionnels. Identifiant d'application encodé fourni par le portail, header Basic vers `https://portail-api.meteofrance.fr/token`, `grant_type=client_credentials` | Aucune création requise : clés GitHub fonctionnelles. Si OAuth est choisi, configurer explicitement le bon identifiant ; ne jamais placer un access token temporaire dans `_API_KEY` |
| `METEOFRANCE_AROME_API_KEY`, `METEOFRANCE_ARPEGE_API_KEY` | Headers séparés, chaque produit WCS. Aucune réutilisation de la clé observations | Aucun renouvellement GitHub établi nécessaire. Pour des tests Codex de ces produits, ajouter leurs liaisons dans les paramètres, jamais dans le chat |

`StationAuth` existant donne priorité à `_APPLICATION_ID` lorsqu'il est renseigné. Il obtient un Bearer temporaire et respecte `expires_in` (contrat borné à 24 h), avec marge `min(30 s, TTL/10)`, cache en mémoire et un seul renouvellement/rejeu après 401. Un 403 ne déclenche aucun renouvellement ; aucune clé API n'est essayée comme Bearer. La durée n'est pas supposée être systématiquement une heure. La valeur effective du TTL n'a pas été sondée, OAuth n'étant pas le mode GitHub observé. Tests synthétiques de renouvellement proactif, expiration, 401, 403, redirection et absence de fuite réexécutés.

`NEXT_PUBLIC_SUPABASE_URL` et `SUPABASE_SECRET_KEY` servent à la persistance, pas à Météo-France ; ils ne sont pas injectés dans les jobs de sondage. `CDSAPI_KEY` concerne ERA5-Land et non ces quatre familles. Aucun secret modifié ou régénéré ; aucun abonnement changé.

## Corrections et responsabilités

- Sonde unique des quatre familles et des deux versions DPObs, isolée de l'ingestion et de la publication. Résumé Actions et rapport JSON à diagnostics fixes. L'ancien paramètre `observations_version` reste accepté pour compatibilité ; les deux versions sont désormais testées.
- Recette optionnelle bornée : une station, une journée J-1, un relevé récent, un petit champ de température par modèle. Dates/cycles/unités/niveau/grille vérifiés dans le GRIB natif. Aucun calcul de couverture nationale n'est revendiqué à partir de ces champs.
- Réponses stations tronquées : réessai borné sans conserver de corps partiel ; un corps d'erreur tronqué ne masque plus le statut 401/403 d'origine.
- Reçu quotidien : préservation du statut HTTP, de la phase, de la raison et du code fournisseur autorisé pour les erreurs d'accès. Le booléen d'échec permanent seul masquait la distinction 401/403.
- WCS : diagnostics fixes pour 401, 403, 404, 429, 5xx ; séparation explicite des formats invalides (sans retry) et des transports interrompus (retry borné) ; suppression des messages arbitraires d'exception fournisseur, codes OGC conservés uniquement dans une liste autorisée. Un 404 générique devient un échec réessayable différé, au lieu d'être annoncé automatiquement comme une ressource simplement pas encore disponible. Le 204 explicite reste `no_new_data`.
- Les libellés figés de comparaison nationale qui affirmaient encore un 401 observations ou une date ERA5 au 30 octobre sont remplacés par `not_executed_in_this_run` : une comparaison non réalisée ne justifie aucune cause d'accès actuelle.
- Le contrôle des bindings nocturnes affiche aussi les noms OAuth optionnels. Il s'agit d'un inventaire, pas d'un test de souscription.

Les réessais existants sont conservés : trois tentatives au maximum pour réseau/408/429/5xx, délais exponentiels et prise en compte de `Retry-After`. Un délai supérieur à 30 s ou au format date n'est pas raccourci : le job rend la main au cooldown d'ordonnancement (au moins 30 min). Pas de retry systématique sur 401/403 ni de téléchargement national dans la sonde. Les archives qualifiées et la dernière publication sont préservées par les adaptateurs existants ; MF-01 ne crée pas de copie fraîche d'une archive ancienne.

## Vérification scientifique de l'archive conservée

Lecture Storage **GET uniquement**, checksum vérifié et contrat national revalidé avec les 713 identités officielles. Archive `6d8255cb738799d0434c9ae4ded8e045d993e80561b724625683acb532cc1e43`, run déclaré `2026-11-09T12:00:00+00:00`, acquisition globale `2026-11-09T19:01:50.884027Z` : 49 910 lignes sources, 32 085 sélectionnées. [Audit détaillé](evidence/archive-audit.json).

Les dates sélectionnées sont les 08–16 novembre. AROME est sélectionné jusqu'au 10, ARPEGE les 11–12, IFS les 13–16. Les champs IFS proviennent du cycle du **9 novembre 00Z**, même si le cycle commun de l'archive est 12Z : conserver `model_run_at` par ligne. Les 713 identités ne prouvent pas 713 valeurs complètes pour toutes les variables : le 11/11, humidité disponible sur **452/713**, le 12/11 **331/713** ; les autres lignes restent partielles ou indisponibles.

Pour cette archive conservée en production, le 16/11 correspond à J+5 par rapport à l'audit du 11/11, provenant d'un ancien cycle IFS. Le 18/11 (J+7 de l'audit) est absent. Cette archive ne prouve pas une prévision fraîche à J+7 ; pas de continuité homogène sept jours validée pour les indicateurs AGRO, pas d'observations nationales J-1 établies par les cinq stations. Les estimations AROME passées conservent leur nature de prévision rétrospective, jamais d'observation ou d'analyse. La réanalyse ERA5 disponible jusqu'au 4/11 ne devient pas une observation J-1.

## Cycle national frais : recette complète sans publication

[Run 43033573529](https://github.com/Mehdi-Sine/agriclimax/actions/runs/43033573529), commit `7a6daa1`, **réussi**. Découverte du cycle commun du 11/11 à 06Z, acquisition native, réduction PRA, audits indépendants, sélection et restauration exacte de la nouvelle archive locale. Durée 669,8 s ; **442 requêtes**, **94 971 201 octets** (90,6 Mio), RSS max 880 892 Kio : budgets 512 requêtes / 128 Mio respectés. Aucun binding de persistance/IA dans ce job, `publication.published=false`, aucun objet de production remplacé.

Nouvelle archive de test : `4374cae4cbf88a0a41e264656aab21a1f375d554480169e35fdd5f06a060f510`, 564 015 octets, 49 910 lignes natives réduites et 32 085 lignes sélectionnées, 713 identités à chaque date des **10–18 novembre**. Les 10–12 sont sélectionnés dans AROME, 13–14 dans ARPEGE, 15–18 dans IFS. Les cycles par ligne sont conservés : AROME rétrospectif du 10/11 00Z, AROME courant 11/11 00Z puis 06Z, ARPEGE 11/11 06Z, IFS **11/11 00Z**. Le cycle commun 06Z ne rebaptise pas IFS 06Z.

| Vérification | Résultat réel |
|---|---|
| Température moyenne/min/max | 713/713 valeurs disponibles sur chacune des neuf dates selon la méthode exploratoire existante ; extrema échantillonnés, pas continus |
| Humidité aujourd'hui 11/11 | **232/713** disponibles ; 481 supports non disponibles au sens de la règle |
| Pluie J+5, 16/11 | **707/713** disponibles ; six supports partiels, flag `nonmonotonic_source_accumulation_invalid_null` conservé |
| J+7, 18/11 | Données IFS réellement reçues : température/pluie 713/713, humidité **616/713** ; pas une prévision AROME/ARPEGE à J+7 |
| Vérification numérique indépendante | 24 955 lignes Météo-France : écart max 0 ; 24 955 IFS : écart max 4,27e-14 (tolérance 1e-10), sans appeler l'agrégateur de production |
| Publication / production | **Aucune** ; archive conservée uniquement dans le workspace et l'artefact de recette |

[Rapport complet](evidence/github-national.json) et [résumé indépendant](evidence/national-independent-summary.json). Les audits Météo-France relèvent notamment des échantillons RH hors des bornes **de la règle actuelle** (0–100 %), conservés comme anomalies et exclus du calcul concerné. Le comptage porte sur des échantillons de grille/temps, pas des PRA. La pertinence physique de cette borne, la supersaturation éventuelle et l'encodage doivent être qualifiés avant toute modification scientifique : aucun écrêtage automatique ni seuil assoupli dans MF-01. Les supports côtiers et les masques restent explicitement limités. L'accord arithmétique indépendant ne certifie pas ces hypothèses physiques ni une homogénéité de modèles sur sept jours.

La recette démontre que les acquisitions actuelles peuvent aller jusqu'à J+7 avec le code issu du socle OPS-03, sans publier ni renouveler les clés GitHub. **PARTIAL** décrit les limites de couverture et de qualification restantes, et non un échec de téléchargement du cycle actuel. Le Journal de production n'est pas artificiellement rafraîchi à partir de cette archive locale.

## Stabilisation et intégration des PR

État GitHub et branches relus avant finalisation. Simulations Git `merge-tree` sans changement de ref ni fusion de PR : aucun conflit textuel de MF-01 avec les têtes consultées de #77 (`0f4dccce`) et #63 (`ec7927d7`). Ce résultat n'est pas une recette fonctionnelle combinée.

| PR | État réel / dépendances | Réutilisation et risques |
|---|---|---|
| AGRO-02 #76 | Fusionnée, commit `b61ce89`, présente dans main | Calculs/contrats/partiels conservés ; les tests des consommateurs doivent continuer à refuser THI sans T/RH et les fenêtres hétérogènes. Aucun moteur recopié |
| OPS-03 #78 | Fusionnée, `5d5e486`, présente | Réutilisation des fenêtres stations indépendantes, découverte des cycles avec IFS, repli et archives immuables. Le `ValueError` n'est pas reproduit aujourd'hui ; MF-01 établit désormais le 404 IFS historique via l'artefact enfant. La découverte latest-run/IFS d'OPS-03 déjà présente est conservée. Anciennes modifications d'auth/reprise déjà présentes non réimplémentées |
| OPS-04 #79 | Fusionnée, `bd475ff`, base directe | Commande de test du Journal et préparation partagée conservées. Ancienne limitation « workflow pas encore enregistré sur main » obsolète depuis fusion ; ce n'est plus une explication générale d'un 404 d'API. MF-01 utilise un workflow d'acquisition distinct, sans OpenAI ni mutation éditoriale |
| UX-01 #77 | Ouverte, draft, ancienne base `b61ce89` | Aucun fichier modifié en commun avec MF-01. Risques sémantiques : dates de cartes archivées, état retardé et nouvelles routes après OPS-03/04. Rebaser et refaire recette desktop/mobile Journal/cartes/archives. Aucun composant UX repris |
| COUV-01 #63 | Ouverte, draft, base plus ancienne `0e7bcba` | Aucun fichier modifié en commun avec MF-01. SAFRAN et continuité IFS sont des pistes séparées, opt-in, non qualifiées 713/713 dans la PR. Pas de substitution automatique à DPClim/ERA, pas de raccordement des journées SIM 06UTC aux journées UTC. Aucun nouveau contrat, archive gelée, dépendance SAFRAN ou moteur de sélection repris |

Les PR de dépendances #70 et #46 sont aussi ouvertes : ne pas les intégrer en même temps que la recette MF-01 ; changements de bibliothèques et navigateur peuvent brouiller la comparaison. Aucun cherry-pick d'une PR ouverte.

Ordre recommandé : acquis #76 → #78 → #79 déjà dans main ; revue puis MF-01 pour stabiliser l'observabilité et la recette ; UX-01 après rebase et validation des pages sur ce socle ; COUV-01 après sa qualification scientifique distincte et rebase, sans activation implicite de ses sources. UX-01 n'est pas une dépendance technique de COUV-01 : l'ordre limite les changements simultanés, il ne valide pas la science de COUV-01.

## Vérification après fusion manuelle

1. Relever le SHA de main et les empreintes catalogue/snapshots/publications avant recette. Ne pas modifier les contrôles de publication ou l'activation IA.
2. Lancer uniquement la sonde : `gh workflow run meteofrance-ingestion.yml --ref main -f probe_only=true`. Lire chaque résultat (DPObs v2 reste informatif), pas seulement la conclusion du workflow.
3. Recette des échantillons, sans base ni IA : `gh workflow run meteofrance-ingestion.yml --ref main -f probe_only=true -f sample_data=true`. Consulter les deux rapports et les dates natives ; une commande d'archive DPClim peut rester en préparation. Un échantillon valide ne garantit ni toutes les variables ni la couverture nationale. Ajouter `-f station_window=true` pour rejouer la véritable fenêtre de sept jours avec cinq stations et sorties strictement locales.
4. Pour qualifier un cycle national dans Actions, utiliser `gh workflow run meteofrance-ingestion.yml --ref main -f probe_only=true -f national_qualification=true` : ce job n'a aucun binding Supabase/OpenAI et ne reçoit jamais `--publish-dev`. Équivalent dans un workspace vide/isolé : `PYTHONPATH=engine/src:scripts python scripts/national_weather.py --mode national --latest-available --execute --national-authorized --root work/mf01-national`. **Ne pas ajouter `--publish-dev`**. Cette étape peut consommer le budget national existant (128 Mio, 512 requêtes), elle n'est pas automatiquement lancée par la sonde. Conserver rapport, reçus enfants, audit indépendant, dates/cycles et disponibilité par variable/PRA. En cas d'échec, aucune publication n'est remplacée.
5. Vérifier J-1 et J+5/J+7 relativement au jour de recette, et non à la date du cycle retenu. Refuser READY si manque une date, si la continuité de modèles/supports requise par AGRO manque, ou si la couverture de l'humidité n'est pas qualifiée.
6. Recette éditoriale séparée OPS-04 si nécessaire : `mode=dry-run`, `refresh_sources=false`, `force_ai_regeneration=false`, `reuse_ai=true`. Aucun `publish` ni appel OpenAI nécessaire pour MF-01. Comparer les empreintes de production après recette ; les données/snapshots figés doivent rester identiques.

## Non-régression réalisée

- **150 tests Python** ciblés : ingestion, authentification API Key/OAuth et renouvellement, transport, pipeline quotidien, WCS, budgets/reprises, archives nationales et échantillons natifs. Vingt tests MF-01 couvrent notamment HTTP 200 incompatible, absence de clé dédiée, non-exposition du texte fournisseur et refus de dates/cycles/unités/grilles erronés. Deux tests supplémentaires valident les reçus distincts 401/403 du quotidien.
- **110 tests TypeScript** : suites nightly/OPS-03/OPS-04 (reprise, snapshots, immutabilité, modes manuels, intégration), codec d'archive et consommateurs agroclimatiques. Aucun appel réel OpenAI dans ces tests.
- Douze tests d'ordonnancement T36 et trois tests qualité des commandes Actions ; Ruff des fichiers touchés, Mypy strict des deux nouvelles commandes, contrôles contrats, YAML/automatisation et garde des secrets réussis.
- Quatre exécutions GitHub Actions réelles, catalogues, acquisition minimale, fenêtre stations locale puis cycle national complet, sans base ni publication ; validation du checksum/contrat et des dates de l'archive nationale existante ; lecture RPC stable des cinq stations, **aucun batch DPClim persisté retrouvé dans la fenêtre 29/10–10/11** ([preuve](evidence/persisted-station-audit.json)). Ceci n'affirme pas une absence sur toute l'histoire.
- Simulations de fusion textuelle avec les têtes ouvertes #77/#63 sans conflit et sans changement de branche/main. Aucune recette navigateur combinée UX-01/COUV-01 revendiquée ; aucune fusion effectuée. Le cycle national frais et J+7 ont été testés ; les limites scientifiques et la couverture partielle détaillées ci-dessus maintiennent **PARTIAL**.

## Retour arrière

Avant fusion, fermer la PR suffit ; main et les données sont inchangées. Après fusion autorisée, créer une PR de revert du commit de fusion MF-01 (ou du squash), la faire revoir puis fusionner manuellement. Aucun rollback SQL, rotation de secret ou restauration d'archive n'est nécessaire : MF-01 n'en modifie aucun. Ne jamais réécrire les archives historiques pour revenir en arrière. Si seule la sonde pose problème, cesser ses déclenchements manuels ; aucun cron n'a été ajouté. Conserver les rapports d'incident et vérifier ensuite le mode d'authentification, les cooldowns et le maintien de la dernière archive qualifiée.

Exécution du retour arrière par le mainteneur : partir de main actualisée dans une branche dédiée, `git revert <SHA-squash-MF-01>` (ou `git revert -m 1 <SHA-merge-MF-01>` pour un vrai commit de fusion), pousser cette branche et ouvrir une PR de revert. Exécuter les tests transports/quotidien/T36 et les contrôles de non-publication avant revue. Aucune commande de réinitialisation de base ou de suppression Storage ne fait partie du retour arrière.
