# OFB / MASA — snapshot fourni le 17 octobre 2026

713 PRA, codes officiels conservés, identifiants `pra:CODE`.
Paris 75000 reste hors de la liste PRA. Aucun contour INRAE ni cellule SAFRAN
n’est utilisé pour les poids ERA5-Land.

- `reference.json` : RFC7946 EPSG:4326, coordonnées originales sans simplification,
  attributs PRA OFB et hiérarchie Agreste 2017 / libellés COG Etalab.
- `source-properties.json` : attributs OFB d’origine, y compris `surf_ha` et `code_ra`.
- `weights.json` : 14 541 intersections, 6 861 cellules CDS ERA5-Land 0,1°,
  poids de surface totale en EPSG:3035, bords de cellules densifiés à 0,01°.
- `manifest.json` : version, méthode, contrôles et provenance. La date de réception
  ne prétend pas être une date de publication géométrique. Le SHA de l’XML WFS
  est une déclaration du fournisseur, non vérifiée sans l’original.
- `checksums.json` : SHA256 des quatre fichiers de données et manifeste.

**Contrôle administratif indépendant en attente.** `reference_verified_national`
reste false. Le paquet est préparé et importé dans PostGIS local, sans déploiement
Supabase ni activation d’un traitement climatique national. Ne pas assimiler le
compte de 713 contours à une couverture climatique ou administrative certifiée.
Les 713 objets ont le type MultiPolygon ; 143 ont effectivement plusieurs parties.

Provenance déclarée : WFS OFB/MASA, couche
`ref_met_petite_region_agricole_masa_pol_3857`, conversion EPSG:3857 → CRS84 fournie
par l’utilisateur. Les trois fichiers de l’archive ont été contrôlés par CRC et
SHA256. La géométrie XML originale et son millésime exact restent à confirmer.
Licence Ouverte 2.0 selon les métadonnées du jeu ministériel ; pas de document de
licence dans l’archive. Référence de diffusion :
https://www.data.gouv.fr/datasets/petites-regions-agricoles-source-ministere-de-lagriculture-2017

Voir `docs/codex/verification/task19/OFFICIAL_PRA_INTEGRATION.md` pour les preuves,
les commandes de reproduction, le pilote réel et les limites restantes.
Ce fichier n’est jamais importé dans un bundle navigateur. La géométrie
cartographique simplifiée reste séparée et n’est pas générée ici.
