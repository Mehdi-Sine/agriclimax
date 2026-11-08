# Accès fournisseurs — 8 novembre 2026

Base : `c837fcd`, PR DATA-01 #65 fusionnée. Preuves nouvelles dans `evidence/` ; les preuves DATA-01 restent historiques. Aucun secret enregistré.

| Source / variable attendue | Qualification de cette session | Action opérateur |
|---|---|---|
| AROME / METEOFRANCE_AROME_API_KEY | Binding absent des variables déclarées Codex ; état GitHub inconnu | Souscrire au produit AROME sur le portail MF et lier sa clé au nom exact dans Codex et GitHub |
| ARPEGE / METEOFRANCE_ARPEGE_API_KEY | Même limite | Souscrire séparément ARPEGE ; ne pas substituer une clé stations |
| DPClim quotidien / METEOFRANCE_CLIMATOLOGY_API_KEY | Binding prêt ; HTTP 401, voir provider-access.json | Vérifier abonnement au produit, validité de la clé et injection au job |
| DPObs / METEOFRANCE_OBSERVATIONS_API_KEY | Binding prêt ; HTTP 401, voir provider-access.json | Vérifier version et abonnement DPObs / paquet ; clés non interchangeables par supposition |
| ERA5-Land / CDSAPI_KEY | Binding prêt ; voir cds-access.json pour lecture de métadonnées | Vérifier compte CDS, conditions ERA5-Land acceptées ; une métadonnée accessible ne prouve pas le droit de récupérer un champ |
| IFS Open Data | Utilisé par la chaîne nationale ; voir ifs-access.json | Index public, pas de clé ; lecture d'index ne qualifie pas tout un cycle |

Un 401 signifie authentification refusée sur cette requête. Il ne permet pas de départager expiration, clé invalide et mauvais produit sans diagnostic du portail. Un 403 GitHub sur secrets/variables est une limite des droits du client ; ce n'est pas une preuve de secret absent. L'état `ready` signifie liaison configurée, pas autorisation fournisseur. Un binding absent de Codex n'établit rien sur GitHub.

Procédure : Settings → Secrets and variables → Actions : contrôler les noms ci-dessus, leur portée repository/environment et l'éventuel environnement protégé. Contrôler les blocs `env` des jobs réellement exécutés. Dans le portail MF, vérifier chaque abonnement et renouveler une clé uniquement si sa validité est infirmée. Injecter les valeurs par les réglages sécurisés, jamais en commentaire ou dans la PR. Rejouer weather-preflight en lecture seule avant toute acquisition. En cas de 5xx/timeout, conserver code, durée et Retry-After et comparer au statut fournisseur ; ne pas diagnostiquer une panne générale avec une seule requête.

Aucun changement de clé, de permissions ou d'abonnement effectué. Le succès du job national-weather distant du 8 novembre constitue une preuve d'exécution dans ce contexte-là, distincte des sondes Codex.
