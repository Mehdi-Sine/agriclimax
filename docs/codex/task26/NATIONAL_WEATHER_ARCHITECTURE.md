# Task26C — architecture nationale

Branche et PR55 conservées, un seul responsable. Aucune production, aucune suppression. Les preuves26B et caches source restent conservés ; les jours ERA5 déjà publiés ne sont pas réingérés.

Frontières : isolation CI/acquisitions et écritures DEV ; transport/index/cache mutualisé par modèle/run/variable/niveau/échéance ; intersections EPSG3035 propres à chaque grille ; réduction UTC et agrégation existantes ; publication compacte atomique ; stockage chaud/froid vérifié ; API/canevas existants. Le contrat `pra-weather-1` conserve nature, run/lead, version, couverture, provenance et fraîcheur. Aucune prévision relabellisée observation.

Avant le national : échantillon réel T2m/RH/pluie, vérification GRIB des unités et de la fenêtre d’accumulation, budget mesuré et sélection des échéances réellement ouvertes. Champs WCS partagés et emprises continent/Corse, jamais713téléchargements. IFS réutilise index/Range et les sources vérifiées d’un même run ; les anciennes valeurs ne sont pas réutilisées pour un nouveau run.

Budget candidat :4GiB mémoire,128Mio de corps source par cycle,448Mio de checkpoints,512requêtes,22min de programme. Les limites doivent être vérifiées sur les premières acquisitions avant publication nationale, sans hausse automatique. Un champ WCS national reste borné à2Mio ; le probe initial garde son plafond256Kio. Deux emprises AROME limitent la mer téléchargée ; ARPEGE conserve une emprise commune, IFS ses champs sélectionnés. IFS26B mesuré66,26Mo/227appels est indépendant du nombre de PRA.

Sélection envisagée, à valider sur support réel et comparaison : AROME court terme, ARPEGE intermédiaire, IFS jusqu’àJ+7, un seul modèle/run par journée. J−1 peut utiliser un ancien scénario, explicitement qualifié d’estimation issue de prévisions, si aucune série d’analyse n’est démontrée. Les sources individuelles restent exposées.

Conservation : agrégats PRA compressés, références sources mutualisées, aucun GRIB brut dans Supabase. Archives exactes26B réutilisées pour le lecteur froid et une restauration vérifiable. Aucune purge des anciennes données autorisée ; la conservation24mois doit être chiffrée avec les limites des services existants avant planification DEV.

CI : Task12 devient définitivement dispatch-only avec autorisation DEV explicite. Quality/Security restent inchangées après rejet automatique d’une tentative de report de ces contrôles. Les développements seront regroupés pour limiter les campagnes imposées par les pushes ; vérifications ciblées locales entre jalons. Aucun calendrier national activé avant les critères de recette.

## Implémentation finale vérifiée

Le budget candidat a été respecté par le cycle réel6novembre00UTC :413requêtes/95,18Mo/694,65s. La sélection désormais réalisée est AROMEJ−1/J0/J+1,ARPEGEJ+2/J+3,IFSJ+4..7 ; chaque modèle reste exposé séparément. Les 713PRA sont traitées, les absences restent NULL. Le contrat scientifique demeure `pra-weather-1`, la sélection `pra-national-weather-daily-1`.

Chaîne : champs WCS/indexRange partagés → caches SHA/run immuables → réductions natives UTC → intersections de grille propres → contrôles indépendants → archive PRA compacte vérifiée → catalogue privé → serveur Next strict → réponses713/date/variable → canevas national existant. La publication n'embarque aucune grille dans Supabase ni clé côtéclient. Conservation et lecteurs froids réutilisent les enveloppes exactes26B ; pas de nouvelle architectureDB.

Le catalogue est mis en cache15min, un cycle parSHA, trois archivesERA au maximum. Les historiques s'ouvrent via les API existantes, un ancien scénario via `run`. L'opt-in `experimental=weather` et les trois espaces actuels restent conservés ; aucun score agronomique nouveau.

Quality/Security n'ont pas été désactivés : Quality a ensuite été renforcé par ruff/mypy sur les nouveaux modules. Les automatismes nationaux restent désactivés pour les limites documentées dans STORAGE_AND_AUTOMATION.md. Les résultats, limites et décisions indépendantes se trouvent dans les six autres livrables nationaux.
