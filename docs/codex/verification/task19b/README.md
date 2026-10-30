# Task 19B — pilote réel de 73 PRA

Branche `codex/19b-national-pilot`, créée depuis `main` après merge de #40,
base `ee92399c94156cf89d0ad6316c84c9af5e4b4a5e`.

Périmètre autorisé : 73 PRA × sept journées UTC, du 12 au 18 octobre 2026.
Réanalyse ERA5-Land, variables existantes, grille et poids Task19 inchangés.
Le 19 octobre est également téléchargé pour l'accumulation de pluie au 00 UTC.
Aucune acquisition climatique des 713 PRA, aucune interpolation, aucune purge,
aucun service payant, aucun merge de cette PR.

- [Échantillon](PRA_SAMPLE.md)
- [Exécution réelle et reprise](REAL_RUN.md)
- [Stockage et scénarios](STORAGE.md)
- [Performances](PERFORMANCE.md)
- [Résilience](RESILIENCE.md)
- [Décision et extension](DECISION.md)
- [Plan 30 jours non exécuté](EXTENSION_30_DAYS.md)
- [Preuves compactes](evidence.json) et [disponibilité observée par PRA](availability.csv)

Les dates et périodes scientifiques sont UTC. Les diagnostics blé restent
exploratoires et descriptifs, selon `config/wheat-mvp.json` ; aucun risque nouveau.
THI bovin territorial reste non supporté faute d'humidité et de validation du
support grille. Les stations Météo-France et la démonstration restent distinctes.

Les réserves Marseille/Lyon et le millésime géométrique inconnu sont acceptés
comme limites de ce pilote par instruction utilisateur, sans contour modifié.
Cette instruction ne transforme pas le snapshot en couverture nationale exhaustive.

Résultat : **READY_WITH_LIMITS pour le pilote DEV**. 73 lots, 511 journées et
584 diagnostics persistés/rejoués sans doublon ; 56 PRA complètes, 16 partielles,
Crozon indisponible. La réserve de sécurité PostGIS préexistante reste explicite
dans la décision ; aucune activation publique nouvelle n’est validée ici.
