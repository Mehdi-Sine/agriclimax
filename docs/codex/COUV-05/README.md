# COUV-05B — supports natifs réels ; PARTIAL / activation NO-GO

La draft #97 est poursuivie sur sa branche existante. Aucun merge, déploiement, activation, workflow climatique distant, acquisition fournisseur, publication de pointeur ou réécriture d'archive n'a été exécuté.

## Résultat national réel

Un checkpoint GitHub existant a permis une reprise **entièrement hors ligne** des champs AROME, ARPEGE et IFS. Les **49 910 lignes scientifiques** reproduites sont identiques aux réductions d'origine. L'archive compacte du checkpoint a exactement le SHA-256 de l'archive privée auditée : `ed93ab41472f81cec83a6039d8634133fa1feb42fe71d6513090d74d6985a398`.

Les 70 combinaisons modèle/journée/variable couvrent les **713 PRA, dont les six corses**, les cinq variables natives et toutes les échéances de ce cycle. Les cycles d'émission réellement différents sont conservés : aucune conversion artificielle de H18 en H00.

| Source | demonstrated ≥90 % | partial >0–<90 % | absent | unknown |
| --- | ---: | ---: | ---: | ---: |
| AROME | 10 412 | 280 | 3 | 0 |
| ARPEGE | 14 057 | 203 | 0 | 0 |
| IFS | 24 135 | 799 | 21 | 0 |
| Total | **48 604** | **1 282** | **24** | **0** |

Il s'agit de la validité des cellules natives pour la variable et la journée, pas d'un masque terre/mer ni d'une certification de représentativité agronomique. La disponibilité d'une valeur numérique reste indépendante : 47 552 valeurs exploitables dans l'archive, sans nouvelle imputation.

## Recettes

La matrice réelle de **758 632 lignes** examine les 28 recettes AGRO-03 sur toutes les fenêtres contiguës compatibles des cycles disponibles. Elle utilise l'intersection des cellules et ne mélange pas les cycles. Résultats spatiaux : **739 567 demonstrated, 15 828 partial, 660 absent, 2 577 unknown**. Une géométrie déjà vérifiée n'est réutilisée que pour un ensemble de cellules **strictement identique**, avec une nouvelle identité de support attachée à la recette, sa définition, ses entrées et sa période. Les 2 577 nouveaux supports communs non certifiés restent inconnus.

Les valeurs des recettes ne sont **pas** recalculées depuis des agrégats sur des surfaces différentes. Aucun indicateur AGRO-03 hors production n'est activé. La qualification des valeurs sur les supports communs et leur raccordement à toutes les cartes restent bloquants.

## Livraison technique

- Capture native v2 avec empreinte des reçus sources, distinction preuve manquante / cellules vides / erreur, empreintes globale et PRA distinctes, identités composites non ambiguës.
- Intersections EPSG:3035, contrôle de topologie et d'aire, rendu calculé à partir des mêmes cellules en WGS84 puis contrôlé en aire contre l'intersection EPSG:3035. Aucune réparation des contours officiels.
- **260 objets candidats conservés dans le bucket privé existant**, avec relecture exacte ; `catalogue.json` et `current.json` inchangés. Rendu inactif.
- Géométries fragmentées, immuables et dédupliquées par SHA-256 ; identité climatique séparée des coordonnées partagées. Limite d'objet existante de 8 Mio conservée. Index immuable lié à l'archive numérique exacte.
- Reconstruction depuis les preuves spatiales conservées dans cette PR, sans données numériques de grille météo ni dépendance à la conservation indéfinie du checkpoint GitHub.
- Lecteur serveur et carte météo raccordés au **seul** moteur `coverage.ts`, inchangé. `COUV05_RENDER_ENABLED` reste distinct et inactif par défaut. Un support absent ou incompatible devient inconnu ; ≥90 % agrégés seuls ne suffisent plus dans ce chemin activé.
- Comparaisons de miniatures réelles et de repli gris à **1440, 768 et 390 px** : 713 contours, six PRA corses incluses, valeurs préservées. Ces captures ne certifient pas les cartes interactives, le Journal ou les recettes.

## Preuves et limites

- [Audit initial et corrections](AUDIT-05B.md)
- [Validation et reproduction](VALIDATION.md)
- [Coûts, limites et décision](COSTS-LIMITS.md)
- [Activation / rollback](ACTIVATION-ROLLBACK.md)
- `evidence/native-matrix.csv.gz` : 49 910 lignes de preuve native réelle.
- `evidence/recipe-matrix.csv.gz` : 758 632 lignes de qualification spatiale des recettes ; colonnes d'identité dérivables omises pour éviter 67,8 Mo de redondance. Le SHA de la matrice complète et son générateur sont conservés.
- `evidence/archive-matrix.csv.gz` : diagnostic de ce que **l'archive agrégée seule** permet de prouver, avant consultation des captures ; ses états inconnus ne sont pas les résultats de la qualification native.
- `evidence/provenance.json`, captures natives, poids certifiés et index : preuve durable et reconstruction sans réacquisition.

**PARTIAL** : la preuve native de ce cycle est constituée et vérifiée. **NO-GO pour activation** : valeurs composites non qualifiées sur support commun, 2 577 supports de recettes encore inconnus, raccordement et tests réels de toutes les surfaces non terminés, rétention Storage inter-cycles à résoudre. La prévisualisation Vercel automatique est bloquée uniquement sur cette branche, conformément à l’interdiction de déploiement. Aucun GO national ni validation multi-cycles exhaustive n'est revendiqué.
