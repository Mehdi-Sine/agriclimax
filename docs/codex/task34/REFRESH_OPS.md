# Actualisation après OPS-01 et OPS-01B

Le 8 novembre 2026 : intégration de `origin/main` à `57f159c` dans la branche T34, fusion Git sans conflit. Aucun changement fonctionnel du moteur documentaire.

Les contrats et lecteurs du Journal ne sont pas modifiés par OPS-01/OPS-01B. L’adaptateur documentaire conserve la lecture seule des archives Journal/Veille, les périodes et les provenances, et reste indépendant de la supervision climatique `health_only` / `daily_pipeline`. Aucun appel du collecteur depuis une requête du Journal, aucune intégration implicite au pipeline climatique.

La fenêtre documentaire proposée à 05 h 45 Europe/Paris est indépendante de l’acquisition climatique proposée par OPS-01 à 02 h : le gel éditorial commun à 06 h 15 reste une hypothèse à mesurer, pas un horaire activé ni une garantie de fraîcheur. Le moteur conserve son lancement manuel.

Les workflows climatiques présents dans la branche sont strictement ceux de `origin/main` : aucune différence introduite par T34. Aucun calculateur, contrat scientifique ou code web du Journal modifié. Les nouvelles preuves locales sont dans `evidence/refresh-ops/` ; la PR #67 consigne les résultats CI sur la branche actualisée.
