# Sources agricoles Task25

Base : `78e2881ba072b0a468e782018689fff70c13c5dc` (PR53). Aucun jeu de démonstration ne remplit les cartes agricoles.

## Agreste / SSP — SAA

- Page : https://agreste.agriculture.gouv.fr/agreste-web/disaron/SAA-SeriesLongues/detail/
- Archive effectivement acquise : https://agreste.agriculture.gouv.fr/agreste-web/download/publication/publie/SAA-SeriesLongues/SAA-SeriesLongues-2010-2025_DonneesProvisoires-DepartementalesRegionales.zip
- Catalogue/licence : https://www.data.gouv.fr/datasets/agreste-statistique-agricole-annuelle-saa (`fr-lo`, Licence Ouverte).
- Diffusion : 10 juillet 2026. Les deux classeurs indiquent « données arrêtées au 30/03/2026, données 2025 provisoires ». Le statut définitif des années antérieures n'est pas inventé : `revised_historical`. Séries 2010–2019 rétropolées après cohérence RA2020.
- SHA256 de l'archive : `46e2ea9493ae34fac5d343e6cef51ac08a455d970ce78611c5d3b2365650d76f`.
- Onglets intégrés : COP, FOU, EFA, EFV (régional seulement), LAI, VIG. 128 productions source ; 496 combinaisons production/variable/maille, 29 350 séries et 436 761 valeurs numériques avant ajout RPG.
- Fourrages/prairies : le libellé « production fourragère » respecte la distinction source entre récolte des fourrages et production disponible des prairies ; détail conservé dans la note de définition.
- Unités conservées : surfaces ha ; récoltes végétales q ; rendements q/ha ; cheptels EFA têtes, EFV milliers de têtes ; lait hl. Pas de conversion implicite q → tonnes.
- Les lignes France sont des contrôles, jamais des polygones régionaux. Les codes départementaux SSP sont normalisés sans perdre 2A/2B ; les codes régionaux DROM 971/972/973/974/976 sont rattachés aux codes région 01/02/03/04/06. Les cartes restent dans l'emprise produit métropole + Corse, les séries sources conservent les DROM.
- Les cellules vides restent NULL (`unavailable`), les conventions explicites de secret restent `suppressed`. Le statut qualité SSP est conservé brut. La cellule négative de FOU est conservée dans `source_anomalies`, restituée NULL et explique un écart de contrôle de 2 ha en 2010.

## IGN / ASP — RPG2025, niveau 1

- Publication : https://cartes.gouv.fr/aide/fr/partenaires/ign/generalites-ign/actualites/2026-10-rpg2025/ (23 octobre 2026).
- Catalogue : https://www.data.gouv.fr/datasets/rpg ; https://cartes.gouv.fr/rechercher-une-donnee/dataset/IGNF_RPG
- Documentation du millésime réellement acquis : https://data.geopf.fr/annexes/ressources/documentation/DC_DL_RPG_4.0.pdf (version 4.0, septembre 2026). La documentation 3.0 du catalogue n'est pas employée comme définition du millésime 2025.
- Livraisons régionales officielles : `https://data.geopf.fr/telechargement/resource/RPG/RPG_4-0__GPKG_LAMB93_R{code}_2025-01-01` ; leur flux Atom fournit l'URL 7z et sa taille. Seul `RPG_Parcelles.gpkg` est exploité.
- Nomenclature 2025 : service WFS `LANDUSE.AGRICULTURE2025:codes_cultures`. Les libellés viennent du service, sans catégories agricoles inventées. Le groupe25 a deux libellés contradictoires : son aire contribue au dénominateur RPG, mais ce groupe n'est pas proposé comme production qualifiée.
- Licence Ouverte 2.0. Mesure : hectares géométriques des parcelles déclarées PAC, pas toute la surface agricole, pas rendement, récolte, exploitation ou cheptel.
- Couverture effectivement publiée : `rpg-import.json`, `rpg-manifest.json` et bannière produit. Un lot incomplet n'est jamais publié. Une couverture partielle n'est jamais appelée nationale.

## Cartographie

- PRA : snapshot OFB/MASA versionné de Task19–24, 713 géométries d'origine inchangées, dont six corses. SHA256 de `reference.json` : `51bfc7b24222819a24dab1bdb5e6ffcdc483f8371e14a3c4ac9adddbc0f9d669`.
- Départements/régions : https://etalab-datasets.geo.data.gouv.fr/contours-administratifs/2025/geojson/ (fichiers 100m). 96 départements et 13 régions cartographiés. Simplification réalisée par le producteur, réservée à la restitution, jamais employée pour calculer une surface RPG/PRA. Provenance et empreintes : `geography.json`.

## Rejouer / actualiser annuellement

Installer les locks `requirements-dev.lock`, `requirements-geo.lock`, `requirements-agriculture.lock` ; `PYTHONPATH=engine/src`.

1. `python scripts/agriculture_saa.py --download` acquiert/rejoue la version qualifiée (32 Mio maximum). Les changements de colonnes/date/statut doivent être revus, puis versionnés ; aucune sélection automatique d'une édition non qualifiée.
2. Acquérir la nomenclature WFS2025 dans `work/task25/rpg-codes.json`, conserver la documentation et le manifeste des livraisons.
3. `python scripts/agriculture_rpg.py --compact-cache` parcourt les 13 régions en conservant les couches Parcelles originales sans perte dans le cache compact. `--regions 94` permet une reprise explicite de lot. Les archives, GeoPackages et identités de contrôle restent dans `work/`, jamais dans Git/Postgres/Storage.
4. Exécuter `python scripts/agriculture_cross_region.py` pour vérifier les recouvrements entre les lots acquis, puis `python scripts/agriculture_publish_rpg.py` publie seulement les checkpoints terminés. Exécuter ensuite `python scripts/agriculture_server_index.py` pour enregistrer les imports serveur statiques tracés par Next/Vercel. Un nouvel ensemble de lots impose de republier les agrégats et de refaire la recette avant Preview.
5. `python scripts/agriculture_geography.py` prépare les deux couches administratives depuis les fichiers acquis, sans toucher aux PRA.

Le workflow `agriculture-annual.yml`, manuel ou deux fois par an, vérifie seulement les catalogues (2 Mio/source, délais bornés). Il n'importe pas de nouveau millésime et ne déclenche pas un téléchargement RPG massif. Une publication reste un commit revu dans la PR, jamais un changement automatique de production.
