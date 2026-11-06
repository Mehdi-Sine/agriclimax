# ERA5-Land — rattrapage national terminé le 5 novembre 2026

Dernière journée réellement publiée : **30 octobre 2026**. Les 24h de température et le 31 octobre 00UTC nécessaire à la pluie ont été vérifiés dans les axes des fichiers sources ; aucune publication sur la seule cible d’horloge.

**11 journées rattrapées, du 20 au 30 octobre inclus** : chacune comporte exactement les 713 identités PRA attendues, dont 645 disponibles, 67 partielles et Crozon29102 indisponible. Les trois enveloppes pilotes du20 octobre restent octet-identiques. 7840 nouvelles lignes et1426 nouveaux lots ; ni réacquisition de ces pilotes ni réingestion du19 octobre.

## Acquisition groupée et reprises réelles

Une emprise2° couvre jusqu’à7 jours contigus, avec séparation mensuelle et heure complémentaire pluie. Décodage mutualisé, tuiles quotidiennes compatibles avec Task26, SHA256 et collisions immuables conservés. Les seuls nouveaux lots mutualisent les descriptions sources par empreinte. Les jours déjà publiés sont exclus avant acquisition ; les sous-tuiles vérifiées sont réutilisées. Garde375Mo, concurrence1 et plafonds source/workspace maintenus.

| Run GitHub Actions | Période | Résultat | Invocations CDS | Octets fichiers sources | Programme, s |
|---|---|---|---:|---:|---:|
|42091357008|20–26 octobre|arrêt borné, checkpoints conservés|21|4267533|1319,756|
|42095551736|20–26 octobre|reprise et publication des7 jours|17|3972929|1280,822|
|42099133896|27–30 octobre|arrêt borné, checkpoints conservés|23|3069328|1310,401|
|42103633624|27–30 octobre|reprise et publication des4 jours|7|1003666|667,098|

Total : **68 invocations CDS,12313456octets,4578,076s** de programme, dont3799,260s acquisition,335,036s persistance,103,314s lecture et0,463s agrégation pure. Le reste inclut préparation/validation. Les compteurs ne recensent pas les polls/retries HTTP internes au SDK ni les en-têtes réseau. Base théorique quotidienne froide :30emprises×11jours=330invocations ; le cache pilote et les reprises rendent cette comparaison indicative, pas un SLA quotidien.

Le run initial42087102375 a échoué avant nouvelle acquisition/publication : lecture répétée des manifestes dans une boucle de14541poids. Correction aec6c00 : une lecture par date, test de non-régression ; le vieux run.json récupéré n’est pas présenté comme un succès de cette tentative. Temps de l’étape1395,006s. Les deux autres arrêts ont préservé leurs tuiles et n’ont pas publié de journées incomplètes.

## Vérification indépendante et rejeu

Pour chacune des11dates, comparaison réelle des713×4 valeurs natives et des713×4 champs DTO : **31372 comparaisons natives et31372 comparaisons unifiées**, NULL/statuts/comptages/identités de lots contrôlés. Tolérance de transport PostgreSQL real limitée à1ULP float32. Preuves `operational-evidence/era5-values-20261020.json` à `era5-values-20261030.json`.

Rejeux avec racines locales initialement vides :20–26 en61,504s et27–30 en45,150s, **0 acquisition,0 octet source,0 écriture,0 nouveau lot**. Empreintes globales avant/après identiques :32136lignes quotidiennes,6072lots ; normales et anciens jours intacts. Preuves `database-after-eleven-days.json`, `database-after-replay.json`, `replay-seven-days.json`, `replay-four-days.json`.

Recette historique locale et Preview réelle : trois espaces×trois tailles1440/768/390, fenêtres7/30jours, catalogue30octobre,713PRA, valeurs et routes station/blé/THI contrôlées, aucun débordement ni erreurJS. Rapports et18captures dans `final-local/` et `final-preview/`. La fraîcheur reste explicitement périmée au5novembre ; elle n’est pas changée par le rejeu. TLS normal et gateway lecture seule de Task25.

Artefacts de reprise :13447760693,13448541085,13450332612,13450584616 ; rétention7jours, pas une archive annuelle. Aucun autre rattrapage n’est requis pour cette cible. L’activation quotidienne reste conditionnée à la conservation documentée séparément.
