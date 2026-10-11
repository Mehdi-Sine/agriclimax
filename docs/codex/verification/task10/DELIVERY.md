# Livraison

Branche demandée : `codex/10-integration-v01`, base `main c2b203a`.
PR draft vers main uniquement ; aucun merge autorisé ou effectué.

La Preview est déclenchée par l’intégration GitHub/Vercel existante au push de la
branche. Le statut Vercel et les checks GitHub doivent être vérifiés sur le commit
livré ; un build local n’est pas une preuve de déploiement.

L’environnement initial n’autorise ni vercel.com ni les hôtes Preview vercel.app :
le proxy refuse la connexion (HTTP 403). Une demande de configuration réseau a
été transmise pendant la validation. Les liens et le résultat distant seront
consignés après le push ; une Preview inaccessible ne sera pas déclarée validée.
