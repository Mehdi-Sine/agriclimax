# Migration depuis un ancien starter

Ce dépôt est une nouvelle base. Ne pas faire un search/replace aveugle d'un prototype antérieur.

1. Importer seulement les formules/tests scientifiquement utiles après revue.
2. Importer les migrations uniquement si elles ont déjà été appliquées sur une base persistante ; dans ce cas conserver les identifiants physiques et créer une migration additive.
3. Ne conserver aucune référence de marque historique dans l'UI, les métadonnées, assets ou nouveaux packages.
4. Vérifier secrets/env avant copie.
5. Comparer les contrats avant de réutiliser du code.
