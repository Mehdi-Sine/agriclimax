> Acceptation géographique, recherche officielle complémentaire du 29 octobre :
> **[BLOCKED — Marseille/Lyon rattachées par Agreste, omissions OFB non qualifiées](GEOGRAPHIC_ACCEPTANCE_20261029.md)**.
> Contours, poids, manifeste d'exécution et migrations intégralement inchangés.
>
> État technique du 29 octobre : [revue finale et décision](FINAL_ACCEPTANCE_REVIEW_20261029.md),
> [réconciliation daily](SUPABASE_RECONCILIATION_20261029.md), [cadrage Task19B](TASK19B_START.md).
> NOT READY : acceptation géographique non close (trous terrestres Marseille/Lyon).
> Voir les checks du SHA final dans la PR ; les runs daily récents ont subi un
> incident de runner, tandis que les nouveaux workflows de PR démarrent. Daily : DDL présent
> et conforme, historique incomplet ; ne pas rejouer ces migrations.
> Les résultats ci-dessous restent les preuves datées des étapes précédentes.

# Task 19 — PRA, agrégation ERA5 et stockage compact

**NOT READY pour validation finale nationale — 713 contours OFB/MASA intégrés
localement, poids calculés, pilote réel sur quatre PRA et APIs/UI locales vérifiés.
Contrôle administratif indépendant et provenance WFS originale encore en attente.**

- [Intégration officielle, pilote réel et bilan courant](OFFICIAL_PRA_INTEGRATION.md)
- [Analyse des fichiers PRA INRAE et Agreste fournis](PRA_INRAE_VALIDATION.md)
- [Audit avant implémentation](AUDIT.md)
- [Sources officielles et limites d’accès](SOURCES.md)
- [Méthodes scientifiques](METHODOLOGY.md)
- [Schéma, sécurité et rollback](SCHEMA.md)
- [Budget, mesures et coûts](STORAGE.md)
- [Commandes, reprises et exploitation progressive](RUNBOOK.md)
- [Rapport complet de vérification et blocages](VERIFICATION.md)
- [Couverture machine](evidence/national-coverage.json), [rapport humain](evidence/national-coverage.md)

Les preuves `real-era5-*` sont des lectures réelles sur quatre boîtes, pas des PRA.
Les logs SQL et les captures territoriales portent sur du staging synthétique /
un état sans référentiel ; leur compte n’est pas la couverture réelle du territoire.
Les checks du dernier commit sont consignés sur le PR draft et restent distincts
de l’import géographique et du déploiement national autorisé.

Les preuves courantes sont dans `evidence/official/`, `logs/official/` et
`screenshots/official/`. Elles portent sur les 713 contours fournis et un pilote
CDS réel de sept jours : deux PRA complètes, Crozon sans valeur, Corse partielle.
Les anciens relevés décrivent les étapes antérieures et ne sont pas remplacés.
Aucun backfill national ni déploiement Supabase Task19 effectué.
