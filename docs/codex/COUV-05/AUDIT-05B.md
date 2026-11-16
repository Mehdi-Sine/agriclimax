# COUV-05B — audit et corrections

Base auditée : branche de la draft #97, commit initial `81e360925445a1e7b6d2f8434da309295e376055`. Les six tests de cette base ont été rejoués isolément : 6/6. Les frontières modifiées sont la preuve native locale, sa qualification spatiale, les sidecars immuables et l'adaptateur météo. Les calculateurs, catalogues scientifiques, sélections de modèles, workflows, archives et moteur de peinture COUV-04 sont préservés ; voir `evidence/preservation.json`.

## Constats corrigés

| Point | Correction et contrôle |
| --- | --- |
| Empreinte globale / PRA | La capture certifie les poids nationaux ; les agrégats portent les poids **propres à chaque PRA**. Export distinct `weights_sha256` / `pra_weights_sha256`, vérification de chacun à son niveau. Aucune comparaison d'une empreinte globale avec une empreinte PRA. |
| Support composite ambigu | L'identité conserve l'association variable/jour, l'empreinte de chaque source et des ensembles valides, ainsi que l'indicateur versionné. Permuter température et humidité entre deux jours change l'identité. L'ordre des entrées ne la change pas. |
| Dépendances manquantes | `combine_required` impose exactement variables × jours explicites. Intersection des cellules uniquement ; doublons, journées manquantes et modèles/cycles/grilles incompatibles rejetés. |
| Provenance native absente | Schéma `couv05-native-cells-2` : SHA-256 des reçus sources obligatoire pour une preuve connue. AROME/ARPEGE et IFS capturent l'empreinte qui accompagne réellement leurs agrégats. Les anciens sidecars v1 ne sont pas promus en v2. |
| Preuve à ≥90 % | Toute surface positive destinée à la persistance exige une géométrie vérifiée, y compris au-dessus du seuil. Le lecteur activé ne transforme jamais une fraction agrégée en preuve. `coverage.ts` reste inchangé. |
| Géométries littorales | Contrôles WGS84, projection et intersection EPSG:3035, validité et aire, puis intersection des mêmes cellules avec le contour WGS84 et contrôle indépendant d’aire. Les composantes linéaires sans aire d'une GeometryCollection sont retirées sans modifier sa surface polygonale. Aucune réparation silencieuse, simplification ou buffer. |
| Intégrité | Empreinte des poids réellement fournis, ensemble attendu exact, poids PRA/cellule non dupliqués et positifs, fractions finies, bornes de lecture comprimées/décomprimées. |
| Cache AROME/ARPEGE | Le retour anticipé depuis une réduction reste sans capture native. Test avec capture demandée et acquisition interdite : aucun faux fichier de preuve. Pour obtenir une preuve il faut les champs natifs vérifiés, pas le checkpoint réduit seul. |
| Reprise IFS | Le mode capture vérifie aussi le SHA natif porté par le manifeste original et son empreinte de provenance. `--offline-native` existant vérifie cache, cycle/grille, manifeste, provenance, variables/échéances et cellules ; la capture intervient ensuite avant agrégation. Ce chemin permet la procédure sans réseau, sous réserve de disposer du cache national complet. |
| Archives | Nouveaux objets uniquement dans `forecast-masks/blobs/` et `forecast-masks/indexes/`. Index immuable lié au SHA de l'archive numérique. Aucun remplacement de `current.json`, `catalogue.json`, archive ou édition. |
| Raccordement | Adaptateur partagé + lecteur serveur borné ; drapeau distinct inactif par défaut. Vérification PRA, modèle, source, cycle, variable, journée UTC, grille, empreintes globale/PRA, référence, source et géométrie. Toute erreur renvoie une qualité inconnue, sans repli vers les agrégats. |

## Distinctions scientifiques conservées

`valid_cells=None` signifie absence de preuve. Un ensemble vide capturé avec une provenance valide démontre l'absence de cellules qualifiées. Une acquisition échouée ne produit aucune capture et reste une erreur d'acquisition, jamais une absence climatique. Une valeur numérique nulle reste une valeur ; une valeur manquante n'est pas l'absence du phénomène.

Un masque composite démontre un **support spatial commun**, pas une valeur recalculée sur ce support. Des agrégats calculés sur des surfaces différentes ne permettent pas de recalculer correctement une recette commune. Le moteur refuse de certifier ces agrégats au moyen du seul masque composite. Ce volet reste bloquant pour l'intégration complète agroclimatique.


La CI de la base #97 échouait sur trois constats Ruff (ordre des imports et itération des paires de dates). Ils sont corrigés ; les contrôles locaux sont joints. Une seconde reproduction après passage de minuit UTC conserve le classement temporel d'origine et vérifie à nouveau les 49 910 lignes et les captures. Le garde Vercel ajouté est limité à cette branche : il répond à la contrainte explicite de ne pas déployer automatiquement.

La version de preuve v2 certifie les contrats de réduction `pra-national-weather-daily-1` pour AROME/ARPEGE et `pra-weather-daily-2` pour IFS. Un résultat d'une autre règle est refusé ; une évolution de contrat scientifique devra versionner la preuve.

Le contrôle final conserve aussi la famille scientifique `mean_sum` des précipitations et refuse une unité ou une échéance discordante. Ces contrôles ne changent pas les règles de qualification existantes ; ils renforcent la liaison d'identité du lecteur candidat.
