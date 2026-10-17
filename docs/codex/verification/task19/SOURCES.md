# Références et limites d’accès

## PRA

Référence demandée : Agreste, année 2017, 713 PRA attendues en métropole, Corse
incluse. Une PRA est le croisement département × région agricole ; ne pas
confondre RA, PRA, regroupement de PRA, commune ou station.

- https://agreste.agriculture.gouv.fr/agreste-web/methodon/Z_PRA_2017/methodon/
- https://www.data.gouv.fr/datasets/petites-regions-agricoles-source-ministere-de-lagriculture-2017
- Diffusion OFB / droits Ministère de l’Agriculture, Licence Ouverte 2.0, d’après
  les métadonnées consultées via le navigateur le 17 octobre 2026.

**Mise à jour : fichiers INRAE et nomenclature Agreste 2017 fournis par l’utilisateur.**
Voir [analyse détaillée](PRA_INRAE_VALIDATION.md) et preuves par code :
713 PRA concordantes + Paris 75000, contours répétés par cellule SAFRAN,
un multipolygone sans code non résolu. Aucun contour promu comme officiel validé.

**État antérieur, avant réception des pièces jointes :** Le proxy d’exécution refuse
CONNECT vers data.gouv.fr (403), et le lien OFB n’a pas pu être téléchargé par
l’outil web. Extension de la configuration réseau demandée. Ne pas contourner
le proxy ni substituer un fond communal simplifié ou un jeu communautaire.
713 n’est donc pas un compte mesuré dans cette PR. Les contours, trous, comptes,
codes, hiérarchie et couverture Corse officiels restent à vérifier.

`scripts/pra_reference.py` accepte un export GeoJSON officiel, son CRS explicite,
un mapping des six attributs et les métadonnées source. Il reprojette vers WGS84,
refuse les géométries invalides/chevauchements/codes numériques, conserve les
multipolygones, génère les intersections et un manifeste SHA256. Aucun repair,
buffer(0), simplification ou ajout de PRA pour atteindre un compte n’est effectué.
Un référentiel départemental officiel indépendant peut mesurer les lacunes,
la couverture et la cohérence administrative ; son absence reste explicite.
Le drapeau `reference_verified_national` reste false jusqu’à revue de ces preuves.
La géométrie d’affichage dispose d’un emplacement distinct, non rempli par défaut.

## ERA5-Land

- Catalogue : https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land
- DOI : https://doi.org/10.24381/cds.e2161bac
- Source conventions: https://confluence.ecmwf.int/display/CKB/ERA5-Land%3A+data+documentation

Provider Task12 réutilisé : grille CDS 0,1°, sans rééchantillonnage ; température
horaire K → °C, réduction UTC exigeant les 24 heures, pluie accumulée m → mm au
00 UTC du jour suivant. Les requêtes, checksums des fichiers et dates de récupération
restent dans des reçus privés côté batch. Le nom de snapshot est choisi par
l’opérateur et ne prétend pas être une release officielle immuable de CDS.
Une modification de source impose une nouvelle version explicite.

Pilote réel : 1er octobre 2026, quatre boîtes de 0,2° × 0,2°, plaine, montagne,
littoral et Corse. 36 cellules reçues ; 34 complètes. Agrégations calculées sur
ces boîtes explicitement **non PRA**. Ces preuves ne valident aucun territoire
PRA officiel. Fichiers horaires conservés seulement dans work, hors PostgreSQL
et hors des preuves publiées ; checksums et résultats compacts archivés.

## Documentation infrastructure consultée

- Free 500 MB DB, 1 GB Storage : https://supabase.com/pricing (17 octobre 2026).
- RLS et grants : https://supabase.com/docs/guides/database/postgres/row-level-security
- Tables : https://supabase.com/docs/guides/database/tables
- GitHub Actions limits : https://docs.github.com/en/actions/reference/limits
- Vercel plans/usage : https://vercel.com/docs/plans

Le changelog Supabase markdown n’était pas accessible ; aucune API Supabase
nouvelle non documentée n’a été supposée. SQL PostgreSQL/PostGIS standard et
RPC SECURITY INVOKER, testés localement. Aucun plan payant activé. Les quotas
réels du compte Actions/Vercel n’ont pas été mesurés ; le budget mensuel doit
être approuvé avant activation quotidienne nationale, pas inféré d’un job vert.
