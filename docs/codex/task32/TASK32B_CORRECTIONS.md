# T32B — correction de la PR draft #61

La direction graphique de T32 est conservée. La carte régionale de une est remplacée par l’explorateur PRA MapLibre existant, chargé à la demande. Le graphique régional et les treize régions narratives restent en place. Sur grand écran, les trois chiffres occupent désormais l’espace sous le texte de une, à côté de la carte plus haute ; sur mobile les blocs restent verticaux.

## Frontières de responsabilité

Modifications : présentation du Journal, utilitaires et tests spécifiques, adaptateur API compact `/api/journal/map`, géométrie cartographique dérivée et documentation T32. Les documents et captures T32 restent conservés comme historique. L’ancien `RegionalMap` et son artefact de contours régionaux ont été retirés de l’interface.

Aucun changement à `national-watch`, aux calculateurs scientifiques, au catalogue agroclimatique, au registre de contributions, aux contrats éditoriaux, au lecteur `lib/server/journal.ts`, aux workflows ou à Supabase. Aucune acquisition météo, aucun service ajouté, aucune IA. La PR #62 / AGRO-01 reste hors périmètre. Même branche `codex/32-journal-editorial-ux`, même PR draft #61, sans merge ni production.

## Résultat

- Carte physique à la maille des 713 PRA, avec les valeurs exactes du résultat national vérifié, une palette sémantique existante, zoom, sélection cartographique et sélection clavier.
- Cycle, période et empreinte source verrouillés sur l’article ; absence explicite sans substitution si le contexte n’est plus reconstituable.
- Dates françaises centralisées, y compris dans les phrases factuelles héritées.
- Chiffres de une fondés sur les nombres de PRA concernées / évaluables ; les extrêmes localisés restent dans les preuves et sur la carte physique.

Détails : `DYNAMIC_PRA_MAP.md`, `EDITORIAL_DATES.md`, `KEY_FIGURES_QUALITY.md`. Recette et réserves : `TASK32B_ACCEPTANCE.md`.
