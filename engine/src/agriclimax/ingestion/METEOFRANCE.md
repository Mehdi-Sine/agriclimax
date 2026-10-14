# Météo-France live — stations MVP

Le provider `meteofrance` conserve le protocole `WeatherProvider` Task 03. Deux
sources distinctes : `meteofrance-climatology` (DPClim/v1) et
`meteofrance-observations` (DPObs/v1). Aucun fallback vers les fixtures ou ERA5-Land.
Les fixtures et la CLI `--mode demo` restent disponibles sans cloud.

## Exécution

Variables serveur : `METEOFRANCE_CLIMATOLOGY_API_KEY`,
`METEOFRANCE_OBSERVATIONS_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SECRET_KEY`. Les clés vont exclusivement dans le header `apikey`, jamais
dans les URLs, fichiers sources, manifests, logs ou navigateur. HTTPS, proxy et
CA hérités ; aucune redirection de credential. DPObs/v2 n'est pas activée : la
subscription présente autorise v1, mais v2 a répondu 403 lors de la vérification.
Les 401/403 sont fatals et indiquent la variable et la subscription requises.

Depuis la racine, moteur installé ou `PYTHONPATH=engine/src` :

```sh
python scripts/ingest_weather.py --mode live_meteofrance --from 2026-09-01 --to 2026-09-30 --dry-run
python scripts/ingest_weather.py --mode live_meteofrance --from 2026-09-01 --to 2026-09-30 --root work/meteofrance
python scripts/ingest_weather.py --mode live_meteofrance --daily --root work/meteofrance
python scripts/ingest_weather.py --mode live_meteofrance --product observations --daily --root work/meteofrance
```

Backfill inclusif de 1 à 366 dates passées par appel. Une commande par station et
plage, puis découpage des dates en lots Task 03, sans commande quotidienne répétée.
`--daily` archive recontrôle hier et les six jours précédents ; les corrections
plus anciennes nécessitent un backfill explicite. `--daily --product observations`
capture le dernier échantillon horaire du jour UTC courant, pas les 24 heures.
Une absence d'observation du jour est explicite, jamais une valeur inventée.
Une station peut être hors service et une variable absente ; valeurs `null`,
flags et statuts restent conservés. Une panne archive est isolée par station.
Une panne station fait échouer le run (code 1) après traitement des autres dates ;
une variable source légitimement absente reste un lot partial/missing sans erreur technique.
Format inattendu, station/date incohérente ou doublon : lot rejeté, pas de correction
silencieuse. Les sources sont conservées en SHA-256 ; un dry-run n'écrit aucun cache,
manifest ou stockage local/distant.

Sélection `--stations` : 1–10 IDs uniques de huit chiffres, présents au catalogue
du produit. MVP par défaut : Brest-Guipavas `29075001` (océanique),
Strasbourg-Entzheim `67124001` (Est), Toulouse-Blagnac `31069001` (Sud-Ouest),
Marignane `13054001` (méditerranéen), Embrun `05046001` (altitude).
Ce sont des points de mesure avec métadonnées réelles, pas un échantillonnage
statistiquement représentatif ni une couverture de la France. Aucune cellule
polygonale artificielle ni interpolation spatiale n'est créée.
Le champ interne Task 03 `cell_id` transporte ici l'ID de station ; la persistance
station le traite comme tel et ne l'associe jamais à une cellule de grille.

## Variables et temps

| Champ source quotidien | Variable interne | Unité |
|---|---|---|
| TN | temperature_min | degC |
| TX | temperature_max | degC |
| TM | temperature | degC |
| UM | humidity | % |
| RR | precipitation | mm |
| ETPMON | etp_monteith | mm |

`TM` est la moyenne fournie, pas `(TN+TX)/2` ni `TMNX`. `ETPMON` est conservée
sous son identité source. La documentation Météo-France décrit la transition de
méthode ETP vers FAO-56 en 2026 et des recalculs d'archives ; aucun identifiant de
méthode/version par valeur ne figure dans ce CSV. L'équivalence automatique avec
`WeatherDay.et0_mm` n'est donc pas affirmée (`et0_equivalence_not_asserted`). Si
ETPMON est absente : `null`, `missing`/`variable_not_available`. Le bilan P-ET0
n'est pas calculé dans cette tâche. Pas de confusion avec `ETPGRILLE`, pas de
calcul ET0 à partir de variables insuffisantes.

DPObs horaire : `t` en K → degC via le convertisseur centralisé, `u` en %,
`rr1` en mm sur son intervalle source. Les extrema horaires ne sont pas renommés
Tmin/Tmax quotidiens ; aucune moyenne/cumul sur échantillonnage incomplet.

La `DATE` climatologique est une étiquette de journée fournisseur. Son stockage
à 00:00 UTC est un repère de partition, signalé `daily_source_date_label`, pas
l'instant de mesure ni l'affirmation que tous les paramètres couvrent la même
journée civile UTC. Les fenêtres d'observation restent définies par la source.
Les échantillons horaires conservent `validity_time` UTC exact.

Source brute et checksum, colonne source, résolution temporelle et codes Q sont
conservés. Les codes Q sont des codes fournisseur opaques, pas une confiance
scientifique inventée. Valeurs non finies, pluie/ETP négatives, RH hors [0,100],
Tmin > Tmax ou doublons sont invalides ; pas de clipping ni imputation.
Les lots invalides ne passent pas la RPC, leurs sources/manifests restent locaux.

Le fournisseur ne fournit pas de date de publication fiable pour ces exports.
`publication_time_known=false`, flag `publication_time_unknown`, `published_at=null`.
Aucune date source ou récupération n'est présentée comme date de publication.
La fraîcheur affichée par l'API est recalculée à la lecture (48 h depuis la date
source quotidienne ou instant horaire), séparée de l'âge de récupération ;
`publication_freshness=unknown`.
Les archives anciennes restent stale même téléchargées aujourd'hui.

## Persistance et reprise

Migration additive Task 11 : stations Point EPSG:4326 et lots privés par
station/source/date, sans lien artificiel à `grid_cells`. RLS forcée, trois RPC
SECURITY INVOKER accessibles uniquement à `service_role`, aucun grant client.
La RPC persiste atomiquement source, stations, manifest et lots du jour.
Une clé de contenu stable exclut `retrieved_at` ; replay de la même acquisition
sans doublons et sans nouveau manifest DB. Les nouveaux essais locaux sont tracés.
Une correction valide remplace la version courante ; sources brutes et manifests
de chaque contenu sont conservés. Les manifests DB gardent les reçus de contenus,
pas l'historique complet de toutes les valeurs précédentes.

Un lot archive incomplet ne peut effacer une valeur connue. La version précédente
reste lisible avec son ancienne provenance ; le manifest récent trace la tentative
partielle. Une récupération plus ancienne ne remplace pas une plus récente.
Pour DPObs, la table conserve le dernier échantillon du jour par station, pas une
série complète horaire ; un instant plus ancien ne remplace pas un plus récent.
Après un résultat de transport incertain, rejouer la même plage : la transaction
et la clé d'idempotence préviennent les doublons.

Débit séquentiel limité à environ 92 requêtes/minute par worker, incluant retries
et polling, sous les 100 req/min annoncées. Trois essais HTTP maximum pour
408/429/5xx/timeouts ; backoff borné, Retry-After numérique borné à 30 s ; jusqu'à
12 polls pour un fichier en préparation. Un seul workflow live concurrent.
Ne pas lancer plusieurs workers avec la même subscription sans budget partagé.

## Endpoints applicatifs

```text
/api/weather/stations?mode=live_meteofrance
/api/weather/series?mode=live_meteofrance&station=29075001&start=2026-09-01&end=2026-09-30&product=climatology
/api/weather/series?mode=live_meteofrance&station=29075001&start=2026-10-14&end=2026-10-14&product=observations
```

Mode explicite obligatoire, une station, source explicite, 366 dates maximum,
dates réelles, paramètres inconnus/dupliqués refusés. Validation de forme, source,
station, dates, unités, doublons et valeurs avant retour. `no-store`, timeout,
pas de redirection ni de détail d'erreur upstream ; pas de secret dans la réponse.
La liste expose au plus 100 stations stockées ; seul le MVP est ingéré actuellement.
Réponses avec `spatial_support=station_points`, `interpolation=none`,
`risk_computed=false`, attribution Météo-France. Une série vide signifie données
absentes, pas absence de risque.

Ce mode est livré pour la CLI et les endpoints météo. Il n'est pas un nouveau
mode des écrans carte/diagnostic/veille, qui restent les parcours Task 10. Les
RPC risques restent vides tant qu'aucune règle scientifique gouvernée et aucun
support spatial adapté ne sont publiés. Aucun YAML fictif n'est appliqué au live.

## Automatisation

`.github/workflows/meteofrance-ingestion.yml` : exécution manuelle (plage ou daily)
et cron 07:40 UTC, archive puis dernier échantillon. Le cron dépend de la variable
repo `METEOFRANCE_LIVE_ENABLED=true` après review/merge. Quatre secrets GitHub
doivent être configurés séparément : URL Supabase, secret Supabase, clés climatology
et observations. Les variables du cloud de travail ne sont pas copiées sur GitHub.
Manifests uploadés, sources en cache distinct du mode demo. Le cron ne tourne pas
sur une branche draft ; aucune automation distante n'a été activée dans cette tâche.

Tests : `python -m pytest engine/tests/ingestion`, `pnpm test`,
`supabase/tests/run-local.sh public` et `extensions` ; preuves Task 11 dans
`docs/codex/verification/task11/`.
