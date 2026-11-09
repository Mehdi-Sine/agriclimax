# Sélection des prévisions

Service pur `features/nightly/snapshot.ts`. Modèles natifs conservés, familles
explicites AROME/ARPEGE/IFS. Âges maximum initiaux : 36/60/72 h. Ces plafonds sont
une **politique éditoriale conservatrice configurable dans POLICY**, pas les
horizons physiques des modèles ; revoir après mesures. Validité = dates réellement
archivées, jamais émission + durée supposée. Besoin minimal : jour J et J+1,
Tmin/Tmax/pluie, support national 713 identités et qualification CORE-01.

Choisir l’archive nationale qualifiée la plus récente couvrant le besoin. La
sélection nationale existante peut passer explicitement d’un modèle court terme
à un modèle long terme par journée. Conserver chaque modèle, émission et validité ;
ne jamais assembler silencieusement des releases incompatibles. Vérifier l’âge
de **toutes** les lignes futures utilisées par les détecteurs existants.

`fresh` : émissions sélectionnées du jour Paris ; `fallback_valid` : cycle antérieur
encore pertinent ; `insufficient` : aucun dossier fiable, aucun appel payant.
La date d’émission réelle est ajoutée aux limitations T33 transmises au modèle.
Pas de fausse évolution déduite d’une révision ou d’une collecte absente.

Preuve réelle en lecture seule : le 9/11, sélection de l’archive du 8/11 06:00 UTC,
`b4ca62bf…`, avec vraies émissions de chaque modèle. ERA5 historique utilise
15 jours / 10 695 lignes qualifiées, pas de journée J−1 inventée. Les états partiels,
littoraux, absents (dont Crozon) passent par les validateurs/détecteurs existants.
Aucune nouvelle règle scientifique ni substitution à une PRA non évaluable.
