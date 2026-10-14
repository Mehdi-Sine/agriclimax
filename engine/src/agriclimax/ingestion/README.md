# Ingestion météo

Task 11 ajoute le provider Météo-France et le mode `live_meteofrance`, séparés de
la démo : [stations, auth, backfill, persistance et limites](METEOFRANCE.md).
Le provider générique France ci-dessous reste désactivé ; le provider Météo-France
utilise les points d'accès et formats réellement vérifiés.

Depuis la racine avec le moteur installé (`pip install -e 'engine[dev]'`) :

```sh
python scripts/ingest_weather.py --from 2025-01-01 --to 2025-01-02
python scripts/ingest_weather.py --daily
python scripts/ingest_weather.py --from 2025-01-01 --to 2025-01-02 --dry-run
python scripts/ingest_weather.py --from 2025-01-01 --to 2025-01-02 --climatology
```

Le stockage par défaut est `work/weather/` (ignoré Git). `--daily` traite hier UTC.
Le backfill est inclusif, maximum 36601 dates. Un run en échec/invalidité sort avec
code 1, poursuit les autres dates et peut être rejoué avec la même plage. Le
manifest de chaque run garde un état par date et les timestamps de début/fin.
Les lots missing/partial ne font pas échouer l'acquisition ; ils restent visibles.
Dry-run télécharge/valide et émet des logs, sans cache, DB ou manifest sur disque.

## Modèle interne et validation

`WeatherProvider.download` retourne octets + retrieved_at ; `decode` décrit le
format source confirmé. L'enveloppe interne possède exactement `published_at`,
`expected_count` (entier >0), `rows`. `expected_count` vient d'une définition de
couverture provider, ne doit pas être déduit du nombre reçu. Un adapter réel doit
expliciter grille, fréquence et variables attendues avant confirmation.

Chaque observation exige cellule, variable, timestamp avec offset, timezone IANA,
valeur nullable finie et unité. Les timestamps stockés sont UTC ; leur date UTC
est la partition demandée. L'offset doit correspondre au fuseau IANA à cet instant.
Aucun timestamp naïf, changement implicite de date, arrondi ou interpolation.
Le parsing Pydantic autorise les représentations numériques JSON compatibles ;
les unités et les timestamps subissent ensuite les contrôles explicites.

Conversions centralisées : K → degC par -273.15 ; m → mm par ×1000 ; humidité en %.
Unités inconnues rejetées. Valeurs sous zéro absolu, pluie négative, humidité hors
[0,100] rejetées, jamais clippées. Aucune borne météorologique scientifique ajoutée.

`missing` : aucune ligne. `partial` : nombre inférieur à la couverture attendue
ou valeur null. `invalid` : ligne invalide, doublon, couverture excédée/enveloppe
invalide. Les rejets portent l'index de ligne, jamais son contenu dans les logs ;
le fichier source est disponible pour inspection autorisée. Un lot avec lignes
rejetées reste intégralement invalidé et mis en quarantaine.

La fraîcheur est indépendante de la complétude : `stale` quand la publication a
plus de `--max-age-hours` (48 par défaut), sinon `fresh`. Les publications/récupérations
futures ou naïves sont invalides. L'âge d'observation historique n'est pas confondu
avec l'âge de publication. UTC et provenance présentes sur chaque observation.

## Persistance et reprise

Les sources sont adressées par SHA-256 (cache fichiers), avec vérification du
contenu existant. Ceci détecte une corruption locale, pas l'authenticité fournisseur.
La DB locale remplace atomiquement une partition source/date. Un changement de
retrieved_at seul ne réécrit pas ; un changement de fraîcheur peut mettre à jour
la partition. Les manifests gardent chaque nouvel essai. Une révision publiée
plus ancienne que celle persistée échoue. Une révision valide de même publication
avec nouveau checksum remplace explicitement la précédente ; source brute conservée.
Les lots invalides ont une clé source/date/checksum de quarantaine.

Une panne après persistance et avant manifest est récupérable par rejeu idempotent.
Les erreurs de persistance d'un manifest arrêtent le run ; le rejeu reste sûr.
France n'est pas activé : l'appelant doit fournir format_id, URL HTTPS confirmée,
decodeur et éventuels headers issus des variables d'environnement. Retries limités
aux erreurs réseau/timeouts, HTTP 408/429/500/502/503/504 ; backoff borné. Les erreurs
HTTP permanentes ne sont pas rejouées. Ne pas inclure de secret dans l'URL/payload.

## Climatologie séparée

`percentiles` est une fonction pure ; l'étape CLI est optionnelle et suit l'ingestion.
Seules les partitions `complete` sont incluses (les archives stale restent utilisables).
Pas de mélange entre fournisseurs, cellules, variables ou unités. Baseline UTC
explicite et percentiles par interpolation linéaire des rangs `(n-1)*p`, méthode
`descriptive-linear-1`, sample_count et checksums conservés. Cette interpolation
statistique ne crée aucune donnée source. Les lots exclus sont comptés ; aucune
imputation. Les résultats sont exploratoires, sans classification du risque.
