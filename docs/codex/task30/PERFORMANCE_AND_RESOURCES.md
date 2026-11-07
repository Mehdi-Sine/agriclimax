# Ressources et mesures

Aucun service payant ajouté, aucun pipeline météo/RPG/SAA relancé. La couche de veille réutilise les archives compressées déjà publiées et leur cache de vérification. Une lecture du manifeste par minute au maximum par instance chaude ; archive rechargée seulement si l’empreinte change. Une synthèse par identité, trois identités en mémoire. Les réponses d’erreur ne restent pas en cache.

Le temps du moteur et de la jointure agricole est exposé dans `compute_ms`, la durée API et les volumes sont mesurés par les scripts de recette. Le GeoJSON existant reste le transfert cartographique principal et bénéficie déjà de son cache HTTP. Aucune grille supplémentaire dans Supabase ; stockage persistant supplémentaire : zéro. Les preuves de recette versionnées sont des documents et captures, pas de nouvelles grilles météo.

Projection : le nombre de calculs dépend des démarrages d’instances serverless, et non seulement du nombre de cycles. Le cache est local à l’instance ; aucun coût monétaire garanti sans métriques de facturation Vercel/Supabase. Les lectures froides répétées restent possibles après éviction ou redémarrage. Les résultats mesurés sont ajoutés dans ACCEPTANCE.md.

Mesure sur le cycle du 7 novembre, après mutualisation des preuves : réponse nationale ≈668 ko au lieu de 4,24 Mo. Calcul moteur et contexte agricole : 947 ms localement pour ce cycle ; ces durées ne sont pas une garantie serverless. Chargement API froid local 4,60 s, chaud 85 ms ; Preview mesurée séparément dans `evidence/preview/api-report.json`. Le bundle client complet reste sous 630 ko gzip (budget 2 Mio).

Les API de veille utilisent un ETag lié à l’identité vérifiée et `Cache-Control: private, no-cache`. Le manifeste est toujours revalidé par le lecteur existant ; une synthèse inchangée produit HTTP 304 sans corps. Ce comportement réduit le transfert des relectures par minute, sans cacher un nouveau cycle après expiration du cache de manifeste. Le test serveur vérifie aussi qu’une nouvelle identité repasse à HTTP 200.
