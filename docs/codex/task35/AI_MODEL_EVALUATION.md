# Évaluation des modèles

**READY_FOR_LIVE_AI_TEST**. Aucun modèle OpenAI réellement appelé, aucun titre ou article présenté comme une génération réelle. Coût réel de génération : 0 €. Les deux textes en Preview sont des réponses de simulation écrites pour la recette.

Le modèle par défaut est `unconfigured`, volontairement inutilisable en mode réel. Aucun identifiant disponible ou tarif actuel n'est supposé. Sélectionner, dans le projet OpenAI concerné, un modèle économique compatible Responses + JSON Schema strict puis un modèle plus performant. Vérifier séparément l'accès avec `--verify-model` (GET explicite, aucune génération) et documenter tarif euro et version. Le batch quotidien ne fait que son unique POST.

Comparer sur le même bundle, le même prompt et les mêmes paramètres : titre, sélection, récit, chapeau, intérêt agronomique, exactitude, sources, incertitudes, répétitions, coût et latence. L'option interne `experiment` impose un identifiant et un plafond spécifique ; ses dépenses restent aussi comprises dans le plafond mensuel global. Aucun essai multi-modèle n'est lancé automatiquement.

Conditions manquantes : clé OpenAI autorisée côté serveur, modèle vérifié, tarifs explicites et activation réelle plafonnée par l'utilisateur. La qualité rédactionnelle réelle ne peut pas être validée par les tests simulés.

Le CLI expose l'activation exceptionnelle `--comparison-authorized --experiment-id IDENTIFIANT --experiment-budget EUROS`, en plus de `--live-authorized` pour dépenser. Chaque exécution compare un modèle configuré explicitement ; aucun second modèle n'est appelé par défaut. Les brouillons et métriques se conservent dans un store commun afin de maintenir le plafond global.
