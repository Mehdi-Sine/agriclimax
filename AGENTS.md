# AGENTS.md — règles du dépôt AgriclimaX

Ces règles s'appliquent à tout agent de codage.

## Avant toute modification
- Lire le fichier task associé.
- Inspecter le code existant et les tests.
- Lister les frontières de responsabilité affectées.
- Ne jamais supposer qu'une règle scientifique est correcte parce qu'elle existe dans une fixture.

## Naming
- Marque UI/documentation : **AgriclimaX**.
- Slug/package/db prefix : `agriclimax`.
- Ne créer aucune nouvelle référence à un ancien nom de projet. Une référence historique éventuelle doit être explicitement marquée `legacy` dans un document de migration et non dans l'UI.

## Science
- `hazard` = intensité/probabilité du phénomène climatique.
- `exposure` = présence/importance de la production concernée.
- `sensitivity` = dépendance au stade/contexte biologique.
- `risk` = résultat explicite d'une règle versionnée combinant les éléments requis.
- `confidence` = qualité/complétude de la donnée et niveau de validation scientifique, jamais intensité du risque.
- Chaque résultat calculé doit transporter `rule_version`, `data_freshness`, `provenance` et `quality_flags`.

## Architecture
- TypeScript strict ; pas de `any` sans justification.
- Python typé ; fonctions scientifiques pures dès que possible.
- UTC en stockage ; fuseau explicite à l'affichage.
- Unités explicites ; conversions centralisées.
- Idempotence des pipelines.
- Migrations forward-only ; pas de modification d'une migration déjà appliquée.

## UI
- Couleurs via tokens uniquement.
- WCAG AA ; navigation clavier ; focus visible.
- `prefers-reduced-motion` respecté.
- Mobile : aucun panneau desktop compressé tel quel.
- Tout état de donnée doit être explicite : loading, absent, insufficient, processing, no-risk, risk, stale, error.

## IA
- La génération narrative prend un `EvidenceBundle` structuré ; aucun accès libre à la DB depuis le prompt.
- Ne jamais inventer source, date, chiffre, incertitude ou causalité.
- Marquer visiblement le contenu généré avec assistance IA.
- Conserver le payload factuel, le modèle/version si disponible, le prompt template version et le timestamp.

## Done
Une tâche n'est terminée qu'avec tests, documentation impactée, vérification responsive si UI, et résumé PR conforme.
