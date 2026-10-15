# Task 12 — Climatology / anomalies

Base distante confirmée par GitHub le 15 octobre 2026 :
`main 6c77faf4cf5d80508cbb34ce7e776d9230508f87`, merge Task 11 PR #27.
Worktree `/workspace/work/agriclimax-task12`, branche
`codex/12-climatology-anomalies`, identité locale Mehdi-Sine
<mehdi.sine@acta.asso.fr>. Aucun changement des contrats partagés.

## Inspection préalable et frontières

Lecture des consignes AGENTS/START_HERE/README/ORCHESTRATION, Tasks 03/04/11,
contrats V1 et processus d'évolution, architecture, gouvernance scientifique et
migrations existantes. Le prompt utilisateur définit Task 12 climatologie ; les
anciens intitulés Sentinel/RPG restent des tâches futures, hors périmètre.

Task 11 vérifiée avant code : main distant égal au checkout ; source quotidienne
réelle Brest 14 octobre : complete, six valeurs, dry-run sans écriture ; RPC stations
200 ; endpoints Next locaux avec Supabase réel : stations 200 / cinq points,
archives Brest septembre 200 / trente lots. Inspection SQL distante : 185 lots
archive (1–30 septembre et 7–13 octobre), cinq lots récents, cinq stations.
L'existence du cron est confirmée dans main ; son activation GitHub n'est pas
attestée par ces vérifications. Aucune activation effectuée.

Frontières : `climate/` acquisition et référence historique, statistiques pures,
comparaison descriptive et persistance privée. `ingestion/` Task 11 conserve
les observations live. Les indicateurs climatologiques ne sont pas des résultats
scientifiques validés ni des risques agricoles. Aucun changement web métier.

## Proposition de migration initiale (historique avant création/application)

Schéma inspecté via fichiers et inventaire SQL distant : cinq tables publiques,
huit tables privées ; stations et lots Task 11 séparés de la grille historique.
Les index existants incluent les PK station/source/date, reçus idempotents et
index temps/source/run des observations et indicateurs. Ils restent inchangés.

Ajouts prévus exclusivement dans `agriclimax_private` :

- `climate_references` : révisions immuables par contenu, dataset/cell/date,
  coordonnées EPSG:4326 et JSON normalisé avec receipts/checksums.
- `climate_indicators` : résultats descriptifs séparés, version de méthode,
  période de référence et provenance dans le payload.
- index de lecture `(dataset_version,cell_id,valid_date)` sur références ;
  `(cell_id,target_date,variable)` sur indicateurs ; PK SHA-256 sur chaque table.
- RPC INVOKER `agriclimax_persist_climate`, serveur uniquement, taille bornée,
  tables privées RLS forcées, aucun grant client ; écriture append-only.

Aucun DROP, TRUNCATE, DELETE, renommage, modification de migration historique ou
mise à jour d'une table métier existante. Aucune donnée insérée par la migration.
Désactivation possible par révocation EXECUTE en migration corrective ; pas de
migration DOWN destructive. Application distante seulement après tests SQL locaux.

## État de livraison

Le détail scientifique, les commandes et prochaines étapes sont dans
[la documentation du module](../../../../engine/src/agriclimax/climate/README.md).
Les vérifications actualisées sont dans [VERIFICATION.md](VERIFICATION.md).
Task 12 est mergée dans `main` via la PR #28, commit
`ccbf4805bf07f5b3ed3590d8e9c3ca92d51a51c3`. L'accès CDS, le téléchargement
ERA5-Land, le NetCDF réel (`t2m`, `tp`, latitude/longitude), le smoke test continental,
la persistance Supabase DEV et le replay/idempotence ont été validés via GitHub
Actions. Les tests climatologiques et les checks Quality, Security, Vercel et
Task12 ERA5 real validation sont verts. Les sections initiales ci-dessus
conservent le contexte historique ; le blocage CDS/DEV est levé.
Le smoke test ne constitue pas une normale complète 1991–2020 ni une validation
scientifique pour l'usage agronomique.
