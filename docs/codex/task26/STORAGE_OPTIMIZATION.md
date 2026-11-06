# Conservation compacte et réversible

## Effectif et testé

Nouveaux lots ERA5 de1à7jours, compatibles RPC existant, descriptions sources communes mutualisées par SHA256. Valeurs, versions, reçus complets et anciens lots conservés. Preuve DEV avant source ; aucune suppression, aucune migration nécessaire à ces optimisations.

`scripts/pra_lossless_archive.py` produit une archive gzip `pra-exact-bytes-1`, SHA256 externe et par enveloppe. Validation de toutes les entrées avant restauration ; chemins contraints, doublons/collisions refusés. Les octets d'origine sont conservés, pas une conversion de floats ni seulement des empreintes. Pas d'écriture DB lors de la restauration locale.

Mesure réelle716sorties Task26 :2183082octets →258289octets ;716/716restaurées octet-identiques. Preuve `operational-evidence/task26-baseline-exact.json`. Tests corruption/collision/idempotence. Checkpoints originaux conservés. Cette archive restaure les sorties scientifiques, pas les NetCDF horaires.

## Capacité et décision

Task26 :2,015Mo/jour,735Mo/an ; base au début26B149337779octets. Groupage/déduplication réduisent les métadonnées, sans prouver375Mo sur24mois. Les lignes quotidiennes et index continuent de croître. Pas de hausse de garde, purge, migration destructive ou infrastructure payante.

Option froide indicative depuis la journée mesurée :≈94Mo/an d'archives de sorties,≈189Mo/24mois, hors tuiles/sources et autres pipelines. DB glissante30–60jours + archives mensuelles immuables disponibles au serveur, catalogue combiné, restauration vérifiable. Le dépôt public existant pourrait héberger les archives sans nouvel abonnement, sous limites GitHub/Vercel/egress à vérifier ; aucun stockage illimité promis. Les artefacts Actions7jours ne sont pas une archive annuelle.

Contrôle DEV supplémentaire : les trois enveloppes restaurées19octobre (Beauce complète, littoral partiel, Crozon indisponible) sont soumises au RPC existant et renvoient toutes `inserted=false`. Aucun DELETE ni nouvelle ligne ; preuve `operational-evidence/archive-dev-idempotence.json`. Ce contrôle valide la compatibilité/idempotence en DEV, pas une restauration complète sur base vide.

**Reste à valider** : lecture d'archive des liens datés, politique de rétention DB et restauration complète après archivage. Aucun DELETE n'est exécuté. La compression portable testée ne suffit pas à autoriser la planification nationale.

## Mesure finale des11 journées

Avant rattrapage :149960371octets DB ; tables quotidiennes21667840, lots11182080. Après : **163337907octets DB**, quotidiennes29810688, lots15228928 ; normales51740672inchangées. Delta des deux relations12189696octets pour7840nouvelles lignes, soit **1108578octets par journée713PRA normalisée**, environ404631050octets/an. Ce gain concerne le rattrapage groupé : il ne démontre pas le coût d’un nouveau jour singleton. Même cette projection dépasse375Mo avant ajout du socle existant. La référence prudente quotidienne735460000octets/an reste applicable ; aucune trajectoire12–24mois sous la garde n’est validée.

Archives supplémentaires vérifiées :716sorties de la fenêtre20–26 (dont3anciennes pilotes),4470914→474556octets ;713sorties27–30,3148893→351528octets. Toutes restaurées octet-identiques, SHA256 respectifs `b52eb1ab39cffc56774386b81e62aca94013c66b06a19bb51d05dc4b7790114a` et `32a3ededfdf741ed9c7b23201da256a3c2652a781f479b676770830e3c3e512c`. Preuves `archive-seven-days.json`, `archive-four-days.json`, `storage-eleven-days.json`.

Le snapshot exporte uniquement les dates de récupération demandées et contrôle les SHA des tuiles ; il ne supprime aucun original. Le workflow conserve un chemin de récupération des originaux si l’export échoue. L’archive exacte fonctionne ; **lecteur historique froid, rétention DB et restauration complète après suppression ne sont pas implémentés/validés**. Ces opérations constituent le verrou de conservation, pas un motif pour répéter les acquisitions réussies.
