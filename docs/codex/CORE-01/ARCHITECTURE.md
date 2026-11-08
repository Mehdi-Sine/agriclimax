# Architecture CORE-01

`config/climate-coverage-1.json` porte les paramètres et familles, consommés par
TypeScript et Python. `climate-coverage-1.schema.json` définit la qualification
additive. `qualifyCoverage` / `qualify_coverage` sont des fonctions pures, testées
sur les mêmes cas. `calculateQualified` réutilise les formules existantes ; il
qualifie l'admissibilité et transporte la portée sans dupliquer le calcul.

Chaque nouvelle règle peut déclarer `coverage_family` ; les règles 2.1 la déclarent
explicitement. Une règle inconnue sans déclaration exige un support complet
(famille specific), sans ouverture implicite.

Les adaptateurs fournissent identité de support, méthode, fraction, temporalité,
masque et preuves. Les résultats enveloppants portent déjà PRA officielle,
période, unité, source/version, nature, run, provenance et fraîcheur ; les clés de
support incluent modèle, grille, pondération, méthode et référence. Les poids et
masques géométriques sont distincts des masques terrestres physiques. Une surface
inconnue reste NULL : aucune aire n'est déduite d'une fraction sans aire officielle.

Version additive agroclimatic-1.3.0, wheat-descriptive-2.1.0, national-watch-1.1.0.
Les anciennes fonctions et versions 1.0–1.2 et blé 2.0 restent exécutables ; aucune
valeur ancienne persistée n'est réécrite. Le schéma agroclimatique accepte le
nouveau champ optionnel quality ; les clients anciens gardent value/observed_value.
La branche demandée CORE-01 prévaut sur le nom générique contract-change prescrit
par CONTRACT_CHANGE_PROCESS ; aucun merge sans revue des propriétaires.

Une source future doit fournir les mêmes métadonnées via un adaptateur. Elle ne
peut réutiliser un identifiant de variable dont la définition ou fenêtre UTC
diffère. SAFRAN reste une candidate distincte, sans branche opérationnelle active.
Les caches restent bornés par archive immuable et version de règle ; les lectures
sont mutualisées par variable/date, jamais par PRA ou par visite individuelle.

Les preuves de veille utilisent des dictionnaires de modèles de qualifications
(`PackedCoverageQuality`) et des références de segments. Les fractions exactes et
identifiants de supports sont conservés dans `quality_fractions` et
`quality_supports` ; `qualityForEvidence` reconstitue le contrat complet sans
arrondi. Un modèle mutualisé n'est pas, à lui seul, une qualification complète.
Cette factorisation évite de répéter tous les libellés pour chaque PRA/segment.
