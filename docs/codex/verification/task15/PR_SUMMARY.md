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

**Validation réelle du 16 octobre 2026 réussie :** téléchargement CDS complet
(49 431 octets), SHA256 local vérifié, décodage NetCDF et recalcul indépendant
Tmin/Tmax/Tmean/pluie pour le 1er octobre 2026. Une tuile autour de Paris,
trois mailles seulement persistées dans Supabase DEV ; rejeu RPC `false`,
checkpoint sans réacquisition, trois lignes/une acquisition/zéro doublon.
`/api/climate/france` : HTTP 200 sur page réellement remplie, cinq mesures,
médiane 363.29 ms, pagination 2 + 1 vérifiée, valeurs conformes au NetCDF.
Mesure sur Next.js production local vers Supabase DEV, proxy inclus ; pas un SLA
national. `make check` (116 Python / 176 web), Ruff et mypy relancés avec succès.
Aucune nouvelle implémentation ni migration ; aucune extension nationale ou
historique 1991–2020. La PR reste draft, sans merge.
Miroir objet et purge ne sont pas automatisés ; les quotas arrêtent le pipeline.

Deux migrations additives appliquées sur agriclimax-dev. Détails et preuves :
`docs/codex/verification/task15/VERIFICATION.md` et `STRATEGY.md`.
