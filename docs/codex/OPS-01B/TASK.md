# OPS-01B — Supervision weather-health

Demande : partir du dernier main après #66 ; corriger le faux échec du contrôle
manuel 42508300423 (#34) sans affaiblir les contrôles quotidiens.

Distinguer health_only / daily_pipeline ; conserver les échecs historiques comme
avertissements traçables, vérifier les reprises ERA5, maintenir les erreurs de
publication, intégrité, fraîcheur, continuité et retard. Examiner les derniers
runs programmés et documenter toute limite d'accès aux causes détaillées.

Frontières affectées : politique du superviseur, sélection du mode par le workflow,
tests et documentation. Aucune modification des données, calculateurs, crons,
secrets ou publications. Validations complètes, petite PR draft dédiée, sans merge.
