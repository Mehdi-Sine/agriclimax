# Task 19 — PRA, agrégation ERA5 et stockage compact

**NOT READY — référence officielle bloquée par le proxy ; validation opérationnelle
nationale en attente.** Aucun 713-polygones fictif, aucune donnée synthétique utilisée
comme preuve de couverture. Aucun merge, schéma distant ou lancement national.

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
