# Ressources et mesures

Aucun service payant ajouté, aucun pipeline météo/RPG/SAA relancé. La couche de veille réutilise les archives compressées déjà publiées et leur cache de vérification. Une lecture du manifeste par minute au maximum par instance chaude ; archive rechargée seulement si l’empreinte change. Une synthèse par identité, trois identités en mémoire. Les réponses d’erreur ne restent pas en cache.

Le temps du moteur et de la jointure agricole est exposé dans `compute_ms`, la durée API et les volumes sont mesurés par les scripts de recette. Le GeoJSON existant reste le transfert cartographique principal et bénéficie déjà de son cache HTTP. Aucune grille supplémentaire dans Supabase ; stockage persistant supplémentaire : zéro. Les preuves de recette versionnées sont des documents et captures, pas de nouvelles grilles météo.

Projection : le nombre de calculs dépend des démarrages d’instances serverless, et non seulement du nombre de cycles. Le cache est local à l’instance ; aucun coût monétaire garanti sans métriques de facturation Vercel/Supabase. Les lectures froides répétées restent possibles après éviction ou redémarrage. Les résultats mesurés sont ajoutés dans ACCEPTANCE.md.
