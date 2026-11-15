# COUV-05 — Première livraison candidate : PARTIAL / activation NO-GO

Base : `main` après #96 (`874e561`). Aucun merge, déploiement, flag public, job Actions, ni écriture Supabase déclenchés par cette PR.

## Résultat réalisé

- `forecast_masks.py` : identité de support par **modèle, cycle, variable, date, grille, référence et poids**, avec 713 lignes PRA exactes. Le support de cellules explicitement capturé est comparé aux poids surfaciques de la grille ; `None` = inconnu, ensemble vide = preuve d'absence de cellule valide. À partir de 90 % la géométrie existe mais le moteur COUV-04 décidera de colorer le contour entier ; de 0 à moins de 90 % la géométrie partielle est calculée par intersection des *empreintes natives* avec la PRA en EPSG:3035. Aucune extrapolation.
- `combine` : intersection des ensembles de cellules natifs d'un **même modèle/cycle/grille/référence/poids** ; une preuve manquante impose `unknown`. Les journées non consécutives et supports hétérogènes sont refusés.
- Capture facultative `COUV05_CAPTURE_NATIVE_MASKS=true` dans AROME/ARPEGE/IFS **avant l'agrégation** : enregistre uniquement l'identité des cellules qualifiées par variable/date dans l'espace de travail local `couv05-native/`, sans grille de valeurs. Par défaut cette capture est inactive ; cycles météo, calculs, archive et publication sont inchangés.
- `scripts/couv05_masks.py` : construit une matrice **candidate** des 713 PRA × 5 variables × horizons natifs de chaque modèle et, si demandé, des GeoJSON compressés partiels. Vérifie identités des poids, références et correspondance avec les agrégats du cycle d'origine. Lorsque la capture manque, le résultat est **unknown**, jamais absence climatique.
- Six tests synthétiques de garde-fous, sans prétendre qualifier un cycle réel.

## Sources, limites et risques scientifiques

| Source | Preuve exploitable dès maintenant | Déficit à résoudre |
| --- | --- | --- |
| AROME (0,025°) | Cellules numériques valides lors de la réduction WCS, empreintes de grille et poids propres au modèle | Pas de capture dans les anciens checkpoints réduits, ni de support public par cycle/date/variable |
| ARPEGE (0,1°) | Même mécanisme natif à la résolution du modèle | Idem |
| IFS (0,25°) | Cellules de la réduction GRIB, pondération EPSG:3035, cache natif local | Pas de sidecar support publié et rattaché aux archives |
| Masques terre/mer | Fractions de terre ou métadonnées officielles utiles à l'audit côtier | Une fraction de terre ne prouve **pas** la validité d'un champ thermique ou pluvieux |
| Anciennes archives | Valeur, proportion, identités partielles | Ne contiennent pas les cellules valides nécessaires à un dessin correct des portions manquantes |

**Précision** : "support démontré" signifie cellules de grille ayant réellement des données natives utilisables ; il ne certifie ni représentativité agronomique terrestre ni qualité de la valeur dans toute la PRA. Les modèles prédictifs ne sont pas complétés par SAFRAN/SIM. Une géométrie n'autorise pas, seule, à transformer une valeur agrégée nulle en valeur exploitable.

## Contrat de présentation

`apps/web/features/cartography/coverage.ts` est conservé à l'identique. En l'absence d'un document de support persistant, versionné et accessible au serveur, **aucune nouvelle géométrie n'est branchée au moteur**. Toutes les cartes et miniatures publiées conservent leur rendu courant. Les 713 contours de référence restent propriété de COUV-04.

## GO / PARTIAL / NO-GO

**PARTIAL** sur la fondation de preuve. **NO-GO** sur le rendu prévisionnel national et toute activation. Manquent : acquisition candidate complète vérifiée AROME/ARPEGE/IFS, stockage immuable/versionné, lien `support_id` ↔ qualité scientifique dans tous les calculateurs, intersections des 28 recettes, tests réels des 713 PRA et comparaisons visuelles MapLibre/miniatures/Journal. Ces éléments ne sont **ni exécutés ni prétendus validés** dans cette draft.

La capture facultative n'est pas une activation du rendu. Aucun changement au flag `NEXT_PUBLIC_COUV04_RENDER_ENABLED`. Une nouvelle PR ou révision approuvée de cette draft est nécessaire avant tout GO.
