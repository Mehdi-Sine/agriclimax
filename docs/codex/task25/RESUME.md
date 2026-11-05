# Reprise du 5 novembre 2026

Le workspace initial, les modifications non poussées et les sources compactes ont persisté. La reprise conserve la branche `codex/25-national-agriculture-data` et la PR draft #54, depuis `5c6f3050b03fc224911f968b34544cf9ff3b6884`.

Les six caches régionaux 11/24/27/75/84/94 ont été vérifiés contre leurs SHA256 et les empreintes d’archives des checkpoints (`resume-integrity.json`). Aucun de ces six lots n’a été recalculé. Ils représentent 4 256 355 parcelles lues. L’audit interrégional version2 recharge les sources uniquement pour la validation des frontières, sans remplacer leurs résultats d’intersection.

L’Occitanie reprend son téléchargement déjà partiel. Les plages complètes sont vérifiées avant assemblage ; une plage lente peut être divisée en sous-plages vérifiées. Le cache des plages terminées est réutilisé après interruption. L’empreinte de livraison complète reste obligatoire avant extraction.

La cible demeure treize régions, suivies de l’audit national et de la recette Preview finale. Aucun merge ni changement en production.
