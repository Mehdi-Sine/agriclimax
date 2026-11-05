# Audit Task26

Base : `d9c936ede556648f090445f9e158827472db0379`, main après fusion de #54. Branche unique : `codex/26-national-daily-climate`.

| Travaux | Réutilisé | Manque traité |
|---|---|---|
| 19D | `Era5LandProvider`, tuiles compactes SHA256, `run_batch`, `PraRepository`, 713 contours / 14541 intersections EPSG:3035 | Adaptateur quotidien, reprise inter-runs et plafond de publication |
| 20 | `territoryData`, pagination 8×100, statuts, carte et fiches | Date de fin dynamique et preuve de publication des 713 PRA |
| 21 | Calculs et garde de normales homologues | Aucune acquisition ni réduction historique nouvelle |
| 22 | Climatologie compacte annuelle active, 260958 lignes ; édition supplantée conservée | Aucun changement |
| 23 | RPC climatologie jour/série, normalisation serveur des couvertures et anomalies | Périodes hors de l'archive initiale |
| 24 | DTO `TerritorialValue`, 3 espaces, même canvas, cache 60 jours / 5 minutes | Dernier jour, fenêtres calendaires 7/30, horodatages et état retardé |
| 25 | RPG2025 national, SAA native, contexte blé | Données et design conservés |

`daily-live.yml` acquiert les stations Météo-France et leurs diagnostics. Il ne rafraîchit pas les 713 PRA et ne constitue aucune preuve nationale. `pra-climate.yml` reste le seul workflow climatique PRA ; le nouvel adaptateur y est un mode, avec la même concurrence globale.

Caches effectivement présents au début : ni ancien cache national ni normales sources dans work/. Référence et poids sont versionnés. Le premier essai local a produit une seule tuile compacte et son reçu ; son NetCDF reste dans work/, pas Git. Les anciens artefacts de Tasks19–25 ne sont pas supposés restaurables.

État DEV lu avant ingestion : dernière date 2026-10-18, 21390 lignes nationales (713×30), 23580 lignes avec pilotes, base 145520307 octets. Les preuves de Tasks antérieures sont des références historiques, pas une validation Task26.

Frontières : acquisition CDS/transport, orchestration/checkpoints, RPC serveur, DTO et sélection temporelle commune. Pas de nouveaux calculs agricoles, géométries, poids, THI PRA ou architecture nationale concurrente.
