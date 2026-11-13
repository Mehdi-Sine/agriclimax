# COUV-01 — recette et verdict

Le pilote est implémenté et réellement exécuté. **La fondation nationale complète
et scientifiquement qualifiée sur 713 PRA n'est pas achevée.** Aucune bascule de
production, fusion, écriture distante ou adaptation métier/UI de #61/#62.

## Avant / après

« Complet » dans ce tableau signifie fermeture du support numérique à 1e-4 près,
indépendamment de la validation scientifique. Les définitions SIM et ERA ne sont
pas substituables ; les colonnes comparent leur disponibilité, pas leur égalité.

| Critère | Avant, voie ERA/AGRO-01 | Après, pilote local COUV-01 |
|---|---|---|
| PRA historiques complètes | 645 | SIM 675 |
| PRA historiques partielles | 67 | SIM 38 |
| PRA sans information historique native | Crozon, 1 | SIM 0 ; Crozon reste partiel |
| Corse | 0 complètes / 6 partielles | SIM 1 complète / 5 partielles |
| 68 PRA problématiques | 0 complète / 67 partielles / 1 absente | SIM 30 complètes / 38 partielles |
| Fenêtre 7 jours | 645 strictes ERA | 675 supports SIM complets |
| Fenêtre 14 jours | 14 dates accessibles Storage | 675 supports SIM complets ; 60 dates réelles |
| Fenêtre 30 jours | 0 par lecture Storage AGRO-01 | 675 SIM ; 645 ERA legacy restaurées séparément |
| Prévisions quotidiennes | J+1 : 713 numériques | Inchangé ; candidat IFS quatre variables 713 × 7 jours |
| Continuité sur sept jours | Sélection multi-modèles refusée | Candidat IFS même run démontré, qualité côtière non validée |
| Durée et stockage | Preuves antérieures, non remesurées ici | SIM 25,167 s ; archives 4 116 872 octets / 60 jours |

## Verdicts distincts

| Verdict | Résultat | Obstacle mesuré |
|---|---|---|
| READY_HISTORICAL_713 | NOT_READY | 38 supports partiels ; extrema SIM différents des extrema existants ; validation indépendante manquante |
| READY_COASTAL_QUALIFICATION | NOT_READY | Petites surfaces manquantes, résolution, datum à confirmer et validation indépendante hors assimilation non obtenue |
| READY_30_DAY_HISTORY | NOT_READY pour 713 | 30 jours réels sur 675 SIM et 645 ERA legacy, pas 713 |
| READY_FORECAST_DAILY_713 | NOT_READY scientifiquement | 713 numériques pour quatre variables IFS ; qualification terrestre insuffisante |
| READY_FORECAST_MULTI_DAY | NOT_READY | IFS compatible techniquement ; humidité incomplète et échantillonnage/terrestrialité non qualifiés |
| READY_FOR_AGROCLIMATIC_EXPANSION | NOT_READY | Les critères nationaux scientifiques ci-dessus restent ouverts |

A — non atteint pour les 713 ; B — démontré sur les sous-ensembles précisés,
non atteint nationalement ; C — présence numérique seulement ; D — composants
réutilisables et reprise locale livrés, alimentation pérenne non activée ;
E — respecté : pas de remplissage, pas de seuil 90 %, pas de séries raccordées.

## Preuves et limites

- Matrice nominative 713 PRA et matrice compressée de 213 900 PRA/date/variable.
- 60 dates × 9 892 centres contrôlés ; six PRA corses et identifiants conservés.
- 60 archives quotidiennes avec vérification de restitution exacte.
- 105 calculs indépendants NumPy, erreur maximale 4,27e-14 ; sept PRA contrastées.
- 1 922 lignes du gzip Météo-France comparées au Parquet : 11 532 champs exacts ;
  pas de revendication de comparaison intégrale des deux transports.
- 9 030 différences Tmoy ERA/SIM, avec biais, MAE, percentiles et cas extrêmes.
- Anciennes données présentes réellement : trente journées, 21 390 lignes,
  645 PRA complètes sur toute la période ; pas seulement un ancien catalogue.
- Cartes avant/après : `evidence/coverage-before.svg`, `coverage-after.svg`.
  La simplification SVG de rendu n'intervient jamais dans les intersections.
- Accès DPClim en échec, puis repli officiel public réussi : 84 diagnostics
  station/SIM sur sept PRA, sans les présenter comme validation hors assimilation.
- 229 tests climat/territoires passent, dont 28 nouveaux ; typage strict des trois
  modules ajoutés, Ruff et gardes sources/YAML passent. La suite web/build n'a pas
  été relancée : aucun code web, contrat existant ou dépendance frontend modifié.

Les tests unitaires couvrent lacunes calendaires, doublons, supports/versions
incompatibles, changements de source et de run, valeurs non finies, composantes
pluie absentes, extrema explicitement nommés et archives corrompues. La validation
technique ne remplace pas une validation climatique ou agronomique indépendante.

## Revue et suites concrètes

La PR doit rester draft. Il reste à obtenir la confirmation géodésique de
Météo-France, qualifier les 38 surfaces résiduelles et disposer de témoins
indépendants avant de certifier une estimation. La rétention quotidienne doit
être dédupliquée et durable avant activation. La sélection IFS doit faire l'objet
d'une recette terrestre et temporelle avant consommation par des indicateurs.
Ces obligations ne sont pas contournées en changeant le mot « couvert ».
