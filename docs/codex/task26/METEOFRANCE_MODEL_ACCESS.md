# Contrôle des souscriptions AROME et ARPEGE — 6 novembre 2026

Les modèles utilisent exclusivement `METEOFRANCE_AROME_API_KEY` et `METEOFRANCE_ARPEGE_API_KEY`, chacun pour son API. La clé Observations reste réservée aux catalogues Observations ; aucun repli entre produits. Les anciens401 obtenus sur les modèles avec la clé Observations ne testaient pas les nouvelles souscriptions.

## Résultat réel

[Run42179450077](https://github.com/Mehdi-Sine/agriclimax/actions/runs/42179450077), commit `e54f2e4`, branche existante `codex/26-national-daily-climate`. Déclenchement `workflow_dispatch`, **`probe_only=true`**, job `live` **skipped**. Contrôle terminé le 06/11/2026 à 08:13:53 (Europe/Paris).

| Produit WCS | GetCapabilities | Couvertures annoncées | DescribeCoverage | GetCoverage natif | Champ reçu |
|---|---:|---:|---:|---:|---|
| AROME 0,025° France |200|8194|200|200|T2m, 25 points (5×5),229 octets|
| ARPEGE 0,1° Europe |200|4556|200|200|T2m, 4 points (2×2),185 octets|

Les comptes de couvertures comprennent variables et cycles retenus ; ce ne sont pas autant de variables distinctes et ils évoluent avec la rétention. Les catalogues annoncent notamment les cinq variables utiles communes :

- `TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND` : température en hauteur ; lecture à 2 m réussie.
- `DEW_POINT_TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND` : point de rosée.
- `RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND` : humidité relative.
- `TOTAL_PRECIPITATION__GROUND_OR_WATER_SURFACE` : précipitations totales.
- `WIND_SPEED__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND` : vitesse du vent.

Seule la température à 2 m a été téléchargée. Les quatre autres variables sont **annoncées par les catalogues**, sans acquisition de champs supplémentaire. Les vingt premières entrées littérales figurent dans le rapport JSON.

Décodage indépendant hors réseau avec ecCodes 2.50.0 déjà installé : chaque réponse est un unique GRIB2 `2t`, unité K, niveau `heightAboveGround=2`. AROME : run du 6 novembre à 03 UTC, H+0 ; ARPEGE : run du 6 novembre à 00 UTC, H+0. Les deux messages portent `typeOfGeneratingProcess=2` (**prévision**). Ce succès ne transforme pas H+0 en observation ou analyse J−1 et ne valide pas une série quotidienne ni une chaîne multi-modèles.

## Bornes et preuves

Une seule variable, un seul instant et une seule hauteur par produit, emprise 1,4–1,5° E / 48–48,1° N. Les axes, la hauteur de 2 m et la période doivent être annoncés par DescribeCoverage. Plafonds : 256 Kio/champ et100 points/champ ; 16 Mio/XML WCS décompressé (2 Mio compressés si gzip), 1,5 Mo/catalogue station, 20 s/requête. Aucun retry automatique ni redirection. Ce run a effectué dix requêtes logiques : six modèles et quatre catalogues historiques. 118003octets de corps reçus pour les six réponses modèles, avant décompression, dont **414 octets de champs** ; horsen-têtes et petits corps d’erreur des catalogues401.

Les catalogues DPObs/v1, DPObs/v2, PackageObs/v2 et DPClim/v1 restent **401** avec leurs clés respectives. Aucun changement de souscription Observations n’est supposé.

Preuves durables : `operational-evidence/meteofrance-models-native-probe.json` (HTTP, URLs sans clés, variables, bornes, SHA256) et `meteofrance-native-field-metadata.json` (décodage indépendant). Artefact Actions **13485006289**,taille ZIP de 66164 octets, SHA256 `e50f290da06b68212010cec8c3558e305cd166b64e480c924b846de3e462106d`, rétention 7 jours. Les champs complets et XML sont également conservés dans le workspace `work/task26b/model-access-success/` ; aucune restitution plus fine que la PRA n’a été ajoutée à l’interface.

TLS normal, clés dans l’en-tête uniquement, aucun secret DB lié au job probe. Aucune clé ni réponse d’erreur brute imprimée ; détection des échos de clé, XML sans DTD/entités. Les diagnostics d’erreur sont limités aux codes et textes WCS structurés, bornés et contrôlés contre la clé.

## Corrections et reprise sans recalcul

Le premier dispatch 42117900963 avait confirmé 200 pour les deux produits mais arrêté les catalogues dépassant 1,5 Mo. Compression gzip et plafond XML distinct des champs ont résolu ce point. Les XML réels utilisent `EnvelopeWithTimePeriod` avec trois coordonnées spatiales et begin/endPosition séparés : les fixtures réelles couvrent cette convention.

Le run42119199723 a reçu 404 en TIFF. Le run42179095223 a précisé 404 `InvalidSubsetting` en GRIB : le temps ISO entouré de guillemets était rejeté. Le correctif `e54f2e4` envoie `time(2026-11-06T03:00:00Z)` sans guillemets ; le run final reçoit 200 pour les deux champs. Les preuves des tentatives précédentes restent conservées ; elles ne sont pas comptées comme des lectures réussies. Le run42119650544 avait été bloqué par des timeouts AROME et n’avait pas demandé de champ.

Après expiration du jeton CLI le 5 novembre, deux continuations ont utilisé un déclencheur push ponctuel, limité à cette branche et à un marqueur de commit. Ce déclencheur est **retiré** depuis `a27c175` : le workflow final est de nouveau manuel. Le run final du 6 novembre utilise bien l’entrée `probe_only=true`. Aucun workflow national n’a été exécuté par ces probes, aucune publication ou écriture DB n’y est implémentée.

Vérifications : **13 tests ciblés**, Ruff, mypy strict et structure du workflow réussis. CI complète verte sur le correctif `e54f2e4` : [Quality42179431670](https://github.com/Mehdi-Sine/agriclimax/actions/runs/42179431670),301tests Python,261tests TypeScript,SQL public/extensions,guards,lint/typage/build et navigateur ; [Security42179431763](https://github.com/Mehdi-Sine/agriclimax/actions/runs/42179431763) réussie. Le smoke ERA5 est [skipped42179431930](https://github.com/Mehdi-Sine/agriclimax/actions/runs/42179431930). Un champ GRIB incomplet, multiple, trop grand ou de plus de 100 points est refusé. Aucun changement d’interface, de dépendance ou de version de modèle scientifique.

## Incident du workflow ERA5 hérité

Contrairement à la consigne d’absence de nouveau traitement ERA5, les mises à jour de PR ont déclenché le workflow préexistant `task12-era5-real-validation.yml`, que j’avais pris à tort pour un contrôle hors acquisition. Cinq exécutions ont ajouté **300 révisions immuables** à la table legacy `climate_references` (60 par exécution, puis rejeu à 0), pour l’emprise−1,8/48,0/−1,4/48,3 et les 1–3 septembre 1991. Runs42117887437,42118667143,42118861954,42119208330 et42119659452. Il ne s’agissait pas du traitement national713PRA, mais ces acquisitions/persistances restent un effet non demandé, explicitement conservé dans l’audit.

Audit Supabase **en lecture seule** du 5 novembre22:17 UTC : les300 révisions ont toutes les mêmes tuples variable/valeur/unité qu’une révision antérieure ; 0 valeur scientifique sans correspondance. La fonction déployée ajoute des révisions sans modifier/supprimer les anciennes ; elle n’écrit pas les tables PRA. Comptages PRA inchangés :32136 lignes quotidiennes,6072 lots,521916 normales, dernière date30 octobre. Aucun DELETE ni réécriture corrective n’a été effectué.

Le garde-fou `a27c175` exclut ce smoke automatique pour les PR de `codex/26-national-daily-climate`, sans changer les autres PR ni les dispatchs manuels. Run42120011741 **skipped**, confirmé également après le correctif du 6 novembre. Aucune acquisition ERA5 n’a été relancée à la reprise. Audit durable : `operational-evidence/meteofrance-followup-legacy-ci-audit.json`.
