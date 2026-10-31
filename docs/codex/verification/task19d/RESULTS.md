# Task19D — exécution nationale réelle DEV

**713 PRA × 30 jours, du 19 septembre au 18 octobre 2026 UTC : 21 390 journées nationales uniques, 3 565 lots.**
Référentiel accepté de 713 PRA  / 14 541 poids, inchangé. Aucune migration, aucun diagnostic systématique.

L’ancien blocage de caches absents est levé par l’autorisation explicite de réacquisition complète. Aucun cache Task19B/19C n’a été recherché ou restauré pour cette reprise. Les éditions pilotes sont conservées.

Acquisition : **60 requêtes logiques CDS, 60 réussies, 0 échec(s), 24.31 Mo NetCDF reçus**. Concurrence 1, plafond 100. Les 30 jours sont acquis une fois par emprise, en deux mois, puis découpés en cinq lots de sept jours maximum : 60 requêtes attendues au lieu de 90. Durée instrumentée (attente incluse) 78.6 min ; RSS parent maximale 488.0 MiB. Les retries/polls HTTP internes restent opaques, pas de compteur zéro inventé.

Validation indépendante : **205 830 cellules-jours, 823 320 comparaisons natives**, écarts maximaux natif 0, spatial 0 (tolérance existante 1e-6). Reçus et identité de l’édition, SHA256, heures UTC exactes, grille et unités contrôlés ; aucune fusion de révisions, interpolation ou trou silencieux. Pluie du 30 septembre issue du 1er octobre à 00 UTC. La dernière pluie exige le 19 octobre source.

Persistance/rejeu réels : **21 390 journées uniques  / 713 PRA**, comptes et empreintes identiques après replay. Les données pilotes, les 584 diagnostics antérieurs et les snapshots daily v0.2.0 gardent leur empreinte. Le garde d’écriture lie le rapport indépendant aux octets des tuiles et archives utilisés. DEV uniquement.

Disponibilité observée : **{'complete': 645, 'partial': 67, 'unavailable': 1}** par PRA sur la période ; **{'complete': 19350, 'partial': 2010, 'unavailable': 30}** par journée-PRA. Les 713 états et leurs comptes/couvertures sont dans [availability.csv](availability.csv). NULL, valid_counts, coverage, qualité, provenance et fraîcheur historique/stale restent explicites. Ces observations ne certifient pas un masque permanent.

Les métriques blé restent exploratoires, aucun risque nouveau ou THI territorial. Aucun audit géographique/documentaire clos n’est rouvert ; aucune géométrie, poids ou règle scientifique modifiés.

Reproduction : `scripts/pra_national_30day.py --phase plan` ; puis `acquire`, `aggregate`, validation indépendante indiquée dans le plan, `persist`, snapshot DEV et `replay` avec `--execute-national`. Configuration `config/pilots/pra713-30day-prepared-v1.json`. Les caches/archives lourds restent dans work/, hors Git. Les preuves synthétiques sont dans [measurements.json](measurements.json).
