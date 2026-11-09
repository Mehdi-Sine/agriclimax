# Premier essai réel — échec conservé

Le secret OpenAI existant a été confirmé présent par GitHub Actions ; aucune nouvelle clé n'est nécessaire. Le modèle qualifié gpt-6.1-terra a reçu un unique appel autorisé à partir du dossier réel T33 du 9 novembre.

- Run Actions : 42610453514 ; run financier `9da626c533c6e928ee5d768a21b79a4d1fe290e6356345a2faac3f8e73a0e671`.
- Résultat : `PROVIDER_HTTP_400`, `outcome_unknown`, provision 0,094549 €, coût réel et tokens inconnus.
- Aucun article réel ni reçu OpenAI. Archive de fallback seulement, exclue de la lecture des brouillons IA et de la publication.
- IA arrêtée immédiatement ; aucune seconde requête. Ne pas effacer le run ni ramener arbitrairement son coût à zéro.

L'ancien code ne conservait pas le corps de rejet : la cause exacte reste indéterminée. Le code conserve désormais uniquement code/type/param/request_id assainis, sans message brut ni secret. Le schéma envoyé normalise const/enum avec type explicite ; c'est une correction hors ligne testée, **pas une cause prouvée du HTTP 400 ni une correction validée par un nouvel appel**. La réponse réussie future est archivée avant validation du modèle/usage.

Le propriétaire doit rapprocher les journaux et la facturation OpenAI de la tentative avant une nouvelle autorisation bornée. Les gardes financières et l'unicité quotidienne ne doivent pas être contournées. Aucun texte simulé n'est livré comme premier article.
