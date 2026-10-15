La couverture pilote ne permet pas de planifier la métropole sans multiplier les
révisions JSON et la taille de base. Cette PR prépare 6 429 mailles ERA5-Land
natives, une acquisition progressive bornée et un cache SQL compact, ainsi qu'un
catalogue officiel de 96 stations sélectionnées géographiquement.

Le plan Free impose une fenêtre SQL initiale de 30 jours, des quotas physiques et
l'archivage des NetCDF/historiques hors Postgres. Nouvelle lecture carte paginée,
références calendaires préparables avec seuil de complétude, stations et grille
séparées sans interpolation. Aucun historique massif ni règle scientifique modifiée.

Validation : make check (116 Python / 176 web), Ruff/mypy, SQL/PostGIS public et
extensions, benchmark 45 004 lignes (~434 octets/ligne, page JSON ~10 ms en local),
audits et vérification HTTP. Dix stations réellement ingérées puis rejouées sans
doublons ; DB distante ~22,1 Mo.

**Blocage explicite :** CDS traite la petite requête mais son hôte de livraison
`object-store.os-api.cci2.ecmwf.int` n'est pas autorisé dans l'environnement.
Aucune nouvelle ligne ERA5 France acquise. La PR reste draft ; acquisition réelle
et temps HTTP sur page grille remplie restent à vérifier après ajout de l'hôte.
Miroir objet et purge ne sont pas automatisés ; les quotas arrêtent le pipeline.

Deux migrations additives appliquées sur agriclimax-dev. Détails et preuves :
`docs/codex/verification/task15/VERIFICATION.md` et `STRATEGY.md`.
